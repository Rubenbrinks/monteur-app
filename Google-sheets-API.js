/**
 * ══════════════════════════════════════════════════════════════
 *  Emondt Materiaalapp — Google Apps Script API  v3
 *  Plak dit script in: script.google.com → Nieuw project
 * ══════════════════════════════════════════════════════════════
 *
 *  STAP 1 — Vul SHEET_ID in (zie URL van jouw Google Sheet)
 *  STAP 2 — Kies MAIL_PROVIDER: 'gmail', 'resend' of 'sendgrid'
 *  STAP 3 — Vul de bijbehorende API-sleutel in
 *  STAP 4 — Deploy als Web App:
 *            Implementeren → Nieuwe implementatie → Webapplicatie
 *            Uitvoeren als : Ik
 *            Toegang       : Iedereen   ← BELANGRIJK
 *  STAP 5 — Kopieer de Web App URL en plak in de app (Beheer)
 *
 *  LET OP: na elke codewijziging opnieuw deployen via
 *          Implementeren → Bestaande implementaties beheren → Bewerken
 */

// ── CONFIGURATIE ──────────────────────────────────────────────
const SHEET_ID   = '1c7GeL9KG60aJDRGzoObfnDjOhTj-UKaGGIOSmGwiFvM';
const SHEET_NAAM = 'Artikelen';            // ← tabblad naam

// ── MAIL CONFIGURATIE ─────────────────────────────────────────
// Kies één provider: 'gmail' | 'resend' | 'sendgrid'
const MAIL_PROVIDER = 'gmail';

// Resend.com (aanbevolen)
const RESEND_API_KEY = 'JOUW_RESEND_API_KEY';     // ← re_xxxxxxxxxxxx
const RESEND_FROM    = 'bestelling@emondt.nl';    // ← geverifieerd domein

// SendGrid
const SENDGRID_API_KEY = 'JOUW_SENDGRID_API_KEY'; // ← SG.xxxxxxxxxxxx
const SENDGRID_FROM    = 'bestelling@emondt.nl';  // ← geverifieerd adres

// Ontvanger(s)
const MAIL_ONTVANGER = ' ';  // ← bestemmingsadres

// ── CORS / JSON OUTPUT HELPER ─────────────────────────────────
function jsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── MAIL VERZENDEN (multi-provider) ──────────────────────────
function stuurMail(ontvanger, onderwerp, body, htmlBody, cc) {
  if (!ontvanger || !ontvanger.trim()) {
    throw new Error('Geen ontvanger opgegeven. Controleer MAIL_ONTVANGER in het script.');
  }
  if (MAIL_PROVIDER === 'resend') {
    return stuurViaResend(ontvanger, onderwerp, htmlBody, body, cc);
  } else if (MAIL_PROVIDER === 'sendgrid') {
    return stuurViaSendGrid(ontvanger, onderwerp, htmlBody, body, cc);
  } else {
    // Standaard: Gmail
    const opties = { name: 'Emondt Materiaalapp', htmlBody };
    if (cc) opties.cc = cc;
    GmailApp.sendEmail(ontvanger, onderwerp, body, opties);
    return { ok: true };
  }
}

function stuurViaResend(ontvanger, onderwerp, htmlBody, textBody, cc) {
  const payload = {
    from: `Emondt Materiaalapp <${RESEND_FROM}>`,
    to: [ontvanger],
    subject: onderwerp,
    html: htmlBody,
    text: textBody,
  };
  if (cc) payload.cc = [cc];

  const response = UrlFetchApp.fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const code = response.getResponseCode();
  const result = JSON.parse(response.getContentText());
  if (code !== 200 && code !== 201) {
    throw new Error(`Resend fout (${code}): ${JSON.stringify(result)}`);
  }
  return result;
}

function stuurViaSendGrid(ontvanger, onderwerp, htmlBody, textBody, cc) {
  const tos = [{ email: ontvanger }];
  const payload = {
    personalizations: [{ to: tos, ...(cc ? { cc: [{ email: cc }] } : {}) }],
    from: { email: SENDGRID_FROM, name: 'Emondt Materiaalapp' },
    subject: onderwerp,
    content: [
      { type: 'text/plain', value: textBody },
      { type: 'text/html',  value: htmlBody },
    ],
  };

  const response = UrlFetchApp.fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const code = response.getResponseCode();
  if (code !== 202) {
    throw new Error(`SendGrid fout (${code}): ${response.getContentText()}`);
  }
  return { ok: true };
}

// ── INSTELLINGEN HELPER ───────────────────────────────────────
function leesInstellingen() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Instellingen');
  if (!sheet) return {};
  const rows = sheet.getDataRange().getValues();
  const inst = {};
  rows.slice(1).forEach(r => { if (r[0]) inst[String(r[0]).trim()] = String(r[1] || '').trim(); });
  return inst;
}

// ── GET: artikelen ophalen of bestelling verwerken ────────────
function doGet(e) {
  const actie = (e.parameter.actie || 'lezen');

  // ── REGISTRATIE ───────────────────────────────────────────
  if (actie === 'registreer') {
    try {
      const gebruiker  = (e.parameter.gebruiker || '').toLowerCase().trim();
      const wachtwoord = e.parameter.wachtwoord || '';
      const email      = e.parameter.email      || '';
      const telefoon   = e.parameter.telefoon   || '';
      const rol        = e.parameter.rol        || 'monteur';
      if (!gebruiker || !wachtwoord) return jsonOutput({ status: 'error', message: 'Vul alle velden in.' });

      const ss  = SpreadsheetApp.openById(SHEET_ID);
      let sheet = ss.getSheetByName('Gebruikers');
      if (!sheet) {
        sheet = ss.insertSheet('Gebruikers');
        sheet.appendRow(['gebruikersnaam', 'wachtwoord', 'rol', 'email', 'telefoon']);
      }
      const data    = sheet.getDataRange().getValues();
      const headers = data[0].map(h => String(h).trim().toLowerCase());
      const userIdx = headers.indexOf('gebruikersnaam');

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][userIdx]).trim().toLowerCase() === gebruiker) {
          return jsonOutput({ status: 'bestaat_al' });
        }
      }
      const velden = { gebruikersnaam: gebruiker, wachtwoord, rol, email, telefoon };
      const rij = headers.map(h => velden[h] || '');
      sheet.appendRow(rij);
      return jsonOutput({ status: 'ok', gebruiker, rol });
    } catch(err) {
      return jsonOutput({ status: 'error', message: err.message });
    }
  }
  // ── PROFIEL OPHALEN ───────────────────────────────────────
  if (actie === 'profiel') {
    try {
      const gebruiker = (e.parameter.gebruiker || '').toLowerCase().trim();
      if (!gebruiker) return jsonOutput({ status: 'error', message: 'Geen gebruiker opgegeven.' });

      const ss    = SpreadsheetApp.openById(SHEET_ID);
      const sheet = ss.getSheetByName('Gebruikers');
      if (!sheet) return jsonOutput({ status: 'error', message: 'Tabblad "Gebruikers" niet gevonden.' });

      const data    = sheet.getDataRange().getValues();
      const headers = data[0].map(h => String(h).trim().toLowerCase());
      const userIdx     = headers.indexOf('gebruikersnaam');
      const telIdx      = headers.indexOf('telefoon');
      const emailIdx    = headers.indexOf('email');
      const rolIdx      = headers.indexOf('rol');
      const naamIdx     = headers.indexOf('naam');
      const afdelingIdx = headers.indexOf('afdeling');

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][userIdx]).trim().toLowerCase() === gebruiker) {
          return jsonOutput({
            status:    'ok',
            gebruiker,
            naam:      naamIdx     >= 0 ? String(data[i][naamIdx]).trim()     : '',
            telefoon:  telIdx      >= 0 ? String(data[i][telIdx]).trim()      : '',
            email:     emailIdx    >= 0 ? String(data[i][emailIdx]).trim()    : '',
            rol:       rolIdx      >= 0 ? String(data[i][rolIdx]).trim()      : 'monteur',
            afdeling:  afdelingIdx >= 0 ? String(data[i][afdelingIdx]).trim() : '',
          });
        }
      }
      return jsonOutput({ status: 'niet_gevonden' });
    } catch(err) {
      return jsonOutput({ status: 'error', message: err.message });
    }
  }

  // ── WACHTWOORD WIJZIGEN ───────────────────────────────────
  if (actie === 'wachtwoord_wijzigen') {
    try {
      const gebruiker = (e.parameter.gebruiker || '').toLowerCase().trim();
      const huidig    = e.parameter.huidig || '';
      const nieuw     = e.parameter.nieuw  || '';
      if (!gebruiker || !huidig || !nieuw) return jsonOutput({ status: 'error', message: 'Ontbrekende gegevens.' });

      const ss    = SpreadsheetApp.openById(SHEET_ID);
      const sheet = ss.getSheetByName('Gebruikers');
      if (!sheet) return jsonOutput({ status: 'error', message: 'Tabblad "Gebruikers" niet gevonden.' });

      const data    = sheet.getDataRange().getValues();
      const headers = data[0].map(h => String(h).trim().toLowerCase());
      const userIdx = headers.indexOf('gebruikersnaam');
      const pwIdx   = headers.indexOf('wachtwoord');

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][userIdx]).trim().toLowerCase() === gebruiker) {
          if (String(data[i][pwIdx]).trim() !== huidig) {
            return jsonOutput({ status: 'error', message: 'Huidig wachtwoord onjuist.' });
          }
          sheet.getRange(i + 1, pwIdx + 1).setValue(nieuw);
          return jsonOutput({ status: 'ok' });
        }
      }
      return jsonOutput({ status: 'error', message: 'Gebruiker niet gevonden.' });
    } catch(err) {
      return jsonOutput({ status: 'error', message: err.message });
    }
  }

  // ── AUTHENTICATIE ─────────────────────────────────────────
  if (actie === 'login') {
    try {
      const gebruikersnaam = (e.parameter.gebruiker || '').toLowerCase().trim();
      const wachtwoord     = e.parameter.wachtwoord || '';
      if (!gebruikersnaam || !wachtwoord) {
        return jsonOutput({ status: 'error', message: 'Vul gebruikersnaam en wachtwoord in.' });
      }
      const ss = SpreadsheetApp.openById(SHEET_ID);
      const sheet = ss.getSheetByName('Gebruikers');
      if (!sheet) return jsonOutput({ status: 'error', message: 'Tabblad "Gebruikers" niet gevonden.' });

      const data    = sheet.getDataRange().getValues();
      const headers = data[0].map(h => String(h).trim().toLowerCase());
      const userIdx = headers.indexOf('gebruikersnaam');
      const pwIdx   = headers.indexOf('wachtwoord');
      const rolIdx  = headers.indexOf('rol');
      const telIdx  = headers.indexOf('telefoon');
      const emailIdx= headers.indexOf('email');

      for (let i = 1; i < data.length; i++) {
        const rij = data[i];
        if (String(rij[userIdx]).trim().toLowerCase() === gebruikersnaam &&
            String(rij[pwIdx]).trim() === wachtwoord) {
          const rol      = rolIdx   >= 0 ? String(rij[rolIdx]).trim().toLowerCase()  : 'monteur';
          const telefoon = telIdx   >= 0 ? String(rij[telIdx]).trim()                : '';
          const email    = emailIdx >= 0 ? String(rij[emailIdx]).trim()              : '';
          return jsonOutput({ status: 'ok', rol, gebruiker: gebruikersnaam, telefoon, email });
        }
      }
      return jsonOutput({ status: 'ongeldig', message: 'Onjuiste gebruikersnaam of wachtwoord.' });
    } catch(err) {
      return jsonOutput({ status: 'error', message: err.message });
    }
  }

  // ── BESTELLING VERWERKEN + MAIL STUREN ───────────────────
  if (actie === 'bestelling') {
    try {
      const p = e.parameter;

      // Artikelen parsen: code×qty×naam×eenheid×leverancier
      const regels = (p.artikelen || '').split('|').filter(Boolean).map(r => {
        const [code, qty, naam, eenheid, leverancier] = r.split('×');
        return { code: code||'', qty: parseInt(qty)||1, naam: naam||'', eenheid: eenheid||'stuk', leverancier: leverancier||'' };
      });

      // Bouw e-mailtekst (plain text fallback)
      const lijnen = regels.map(r => {
        const lev = r.leverancier ? `\n    Leverancier: ${r.leverancier}` : '';
        return `  ${r.code.padEnd(12)} ${String(r.qty).padStart(4)} x  ${r.naam}  [per ${r.eenheid}]${lev}`;
      }).join('\n');

      const leverdatumTekst = !p.leverdatum || p.leverdatum === 'zsm'
        ? 'Zo snel mogelijk'
        : isNaN(new Date(p.leverdatum))
          ? p.leverdatum
          : new Date(p.leverdatum).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });

      const body = [
        'MATERIAAL BESTELLEN – EMONDT GROEP',
        '='.repeat(46),
        '',
        `Datum:           ${p.datum || '—'}`,
        `Leverdatum:      ${leverdatumTekst}`,
        `Monteur:         ${p.naam || '—'}`,
        `Telefoon:        ${p.telefoon || '—'}`,
        `Afdeling:        ${p.afdeling || '—'}`,
        `Projectnummer:   ${p.projectnummer || '—'}`,
        `Projectnaam:     ${p.projectnaam || '—'}`,
        `Afleveradres:    ${p.locatie || '—'}`,
        '',
        'GEVRAAGDE ARTIKELEN',
        '─'.repeat(46),
        '',
        lijnen,
        '',
        '─'.repeat(46),
        `TOTAAL: ${p.totaal || regels.length} artikelen`,
        p.opmerkingen ? `\nOPMERKINGEN\n${p.opmerkingen}` : '',
        '',
        '='.repeat(46),
        'Emondt Materiaalapp · www.emondt.nl',
      ].join('\n');

      const onderwerp = `Materiaal bestellen${p.projectnummer ? ' ' + p.projectnummer : ''}${p.projectnaam ? ' – ' + p.projectnaam : ''} – ${p.naam || 'monteur'} – ${p.datum || ''}`;

      const htmlBody = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#22262A">
  <div style="background:#041c42;padding:20px 24px;border-radius:8px 8px 0 0">
    <div style="color:#AEC336;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px">Emondt Groep</div>
    <div style="color:#ffffff;font-size:20px;font-weight:bold">Materiaal bestelling</div>
  </div>
  <div style="background:#f8f8f8;padding:20px 24px;border-left:1px solid #dde1e6;border-right:1px solid #dde1e6">
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:6px 0;color:#7a8aa0;width:140px">Datum</td><td style="padding:6px 0;font-weight:600">${p.datum || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#7a8aa0">Leverdatum</td><td style="padding:6px 0;font-weight:600;color:#041c42">${leverdatumTekst}</td></tr>
      <tr><td style="padding:6px 0;color:#7a8aa0">Monteur</td><td style="padding:6px 0">${p.naam || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#7a8aa0">Telefoon</td><td style="padding:6px 0">${p.telefoon || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#7a8aa0">Afdeling</td><td style="padding:6px 0">${p.afdeling || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#7a8aa0">Projectnummer</td><td style="padding:6px 0">${p.projectnummer || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#7a8aa0">Projectnaam</td><td style="padding:6px 0">${p.projectnaam || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#7a8aa0">Afleveradres</td><td style="padding:6px 0">${p.locatie || '—'}</td></tr>
      ${p.opmerkingen ? `<tr><td style="padding:6px 0;color:#7a8aa0;vertical-align:top">Opmerkingen</td><td style="padding:6px 0;font-style:italic">${p.opmerkingen}</td></tr>` : ''}
    </table>
  </div>
  <div style="background:#ffffff;padding:20px 24px;border:1px solid #dde1e6">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#AEC336;margin-bottom:12px;font-weight:bold">Gevraagde artikelen</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:#f0f2f5">
          <th style="padding:8px 10px;text-align:left;color:#7a8aa0;font-weight:600">Artikel</th>
          <th style="padding:8px 10px;text-align:left;color:#7a8aa0;font-weight:600">Code</th>
          <th style="padding:8px 4px;text-align:center;color:#7a8aa0;font-weight:600">Aantal</th>
          <th style="padding:8px 10px;text-align:left;color:#7a8aa0;font-weight:600">Eenheid</th>
          <th style="padding:8px 10px;text-align:left;color:#7a8aa0;font-weight:600">Leverancier</th>
        </tr>
      </thead>
      <tbody>
        ${regels.map((r, i) => `
        <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8f8f8'}">
          <td style="padding:10px;border-bottom:1px solid #eee;font-weight:600">${r.naam}</td>
          <td style="padding:10px;border-bottom:1px solid #eee;color:#7a8aa0;font-family:monospace;font-size:12px">${r.code}</td>
          <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;font-weight:700;color:#041c42">${r.qty}</td>
          <td style="padding:10px;border-bottom:1px solid #eee;color:#7a8aa0">${r.eenheid}</td>
          <td style="padding:10px;border-bottom:1px solid #eee;color:#7a8aa0">${r.leverancier || '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div style="background:#041c42;color:#AEC336;padding:10px 14px;border-radius:6px;margin-top:14px;font-size:13px;font-weight:bold">
      Totaal: ${p.totaal || regels.length} artikel${(p.totaal || regels.length) !== 1 ? 'en' : ''}
    </div>
  </div>
  <div style="background:#f0f2f5;padding:12px 24px;border-radius:0 0 8px 8px;border:1px solid #dde1e6;border-top:none;font-size:11px;color:#7a8aa0;text-align:center">
    Emondt Materiaalapp · Automatisch gegenereerd
  </div>
</div>`;

      // Ontvangers: lees alle vastontvanger* uit Instellingen tab, fallback op MAIL_ONTVANGER
      const inst = leesInstellingen();
      const ontvanger = Object.keys(inst)
        .filter(k => k.startsWith('vastontvanger'))
        .sort()
        .map(k => inst[k])
        .filter(a => a && a.includes('@'))
        .join(', ') || (MAIL_ONTVANGER || '').trim();
      if (!ontvanger || !ontvanger.includes('@')) {
        return jsonOutput({ status: 'error', message: 'Geen ontvanger ingesteld. Stel een e-mailadres in via Beheer → Emailadressen.' });
      }

      // CC alleen meegeven als het een geldig adres is
      const cc = (p.ontvanger2 || '').trim();
      const ccGeldig = cc && cc.includes('@') ? cc : null;

      stuurMail(ontvanger, onderwerp, body, htmlBody, ccGeldig);

      // Log in tabblad Bestellingen
      try {
        const ss = SpreadsheetApp.openById(SHEET_ID);
        let logSheet = ss.getSheetByName('Bestellingen');
        if (!logSheet) {
          logSheet = ss.insertSheet('Bestellingen');
          logSheet.appendRow(['Datum','Naam','Telefoon','Afdeling','Projectnummer','Projectnaam','Locatie','Leverdatum','Artikelen','Opmerkingen','Gebruiker','ArtikelenData']);
        } else {
          // Voeg ontbrekende kolommen toe aan bestaande sheet
          const headerRij = logSheet.getRange(1, 1, 1, logSheet.getLastColumn()).getValues()[0];
          const headers = headerRij.map(h => String(h).trim().toLowerCase());
          if (!headers.includes('gebruiker')) {
            logSheet.getRange(1, logSheet.getLastColumn() + 1).setValue('Gebruiker');
          }
          if (!headers.includes('artikelendata')) {
            logSheet.getRange(1, logSheet.getLastColumn() + 1).setValue('ArtikelenData');
          }
        }
        // Lees kolomposities dynamisch zodat volgorde niet uitmaakt
        const hRow = logSheet.getRange(1, 1, 1, logSheet.getLastColumn()).getValues()[0];
        const hIdx = {};
        hRow.forEach((h, i) => { hIdx[String(h).trim().toLowerCase()] = i; });
        const artikelenTekst = regels.map(r =>
          `${r.qty}× ${r.naam} (${r.code})${r.eenheid ? ' per ' + r.eenheid : ''}${r.leverancier ? ' – ' + r.leverancier : ''}`
        ).join('\n');
        const logRij = new Array(hRow.length).fill('');
        logRij[hIdx['datum']]          = p.datum          || '';
        logRij[hIdx['naam']]           = p.naam           || '';
        logRij[hIdx['telefoon']]       = p.telefoon       || '';
        logRij[hIdx['afdeling']]       = p.afdeling       || '';
        logRij[hIdx['projectnummer']]  = p.projectnummer  || '';
        logRij[hIdx['projectnaam']]    = p.projectnaam    || '';
        logRij[hIdx['locatie']]        = p.locatie        || '';
        logRij[hIdx['leverdatum']]     = p.leverdatum     || '';
        logRij[hIdx['artikelen']]      = artikelenTekst;
        logRij[hIdx['opmerkingen']]    = p.opmerkingen    || '';
        logRij[hIdx['gebruiker']]      = p.gebruiker      || '';
        logRij[hIdx['artikelendata']]  = p.artikelen      || '';
        logSheet.appendRow(logRij);
      } catch(logErr) { /* logging is optioneel */ }

      return jsonOutput({ status: 'ok', provider: MAIL_PROVIDER });

    } catch(err) {
      return jsonOutput({ status: 'error', message: err.message });
    }
  }

  // ── BESTELLINGEN LEZEN (per monteur) ─────────────────────
  if (actie === 'bestellingen_lezen') {
    try {
      const gebruiker  = (e.parameter.gebruiker || '').toLowerCase().trim();
      const filterNaam = (e.parameter.naam      || '').toLowerCase().trim();
      const ss = SpreadsheetApp.openById(SHEET_ID);
      const sheet = ss.getSheetByName('Bestellingen');
      if (!sheet) return jsonOutput({ status: 'ok', bestellingen: [] });

      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) return jsonOutput({ status: 'ok', bestellingen: [] });

      // Kolomposities op naam zoeken (robuust bij ontbrekende/extra kolommen)
      const headers = data[0].map(h => String(h).trim().toLowerCase());
      const ci = name => headers.indexOf(name);

      const rijen = data.slice(1);
      const bestellingen = rijen
        .filter(r => {
          if (!gebruiker) return true;
          const opgeslagenGebruiker = String(r[ci('gebruiker')] || '').toLowerCase().trim();
          const opgeslagenNaam      = String(r[ci('naam')]      || '').toLowerCase().trim();
          // Nieuwe rijen: match op gebruiker-kolom (login-naam)
          // Oude rijen zonder gebruiker-kolom: match op naam-kolom (volledige naam)
          return opgeslagenGebruiker
            ? opgeslagenGebruiker === gebruiker
            : (filterNaam && opgeslagenNaam === filterNaam);
        })
        .map(r => {
          const datumRaw      = ci('datum')      >= 0 ? r[ci('datum')]      : '';
          const leverdatumRaw = ci('leverdatum') >= 0 ? r[ci('leverdatum')] : '';
          const fmtDatum = v => v instanceof Date
            ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd-MM-yyyy HH:mm')
            : String(v || '');
          const fmtLever = v => v instanceof Date
            ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd')
            : String(v || '');
          const cel = name => ci(name) >= 0 ? String(r[ci(name)] || '') : '';
          return {
            datum:          fmtDatum(datumRaw),
            naam:           cel('naam'),
            telefoon:       cel('telefoon'),
            afdeling:       cel('afdeling'),
            projectnummer:  cel('projectnummer'),
            projectnaam:    cel('projectnaam'),
            locatie:        cel('locatie'),
            leverdatum:     fmtLever(leverdatumRaw),
            opmerkingen:    cel('opmerkingen'),
            artikelenData:  cel('artikelendata'),
            artikelenTekst: cel('artikelen'),
          };
        })
        .reverse();

      return jsonOutput({ status: 'ok', bestellingen });
    } catch(err) {
      return jsonOutput({ status: 'fout', message: String(err) });
    }
  }

  // ── INSTELLINGEN LEZEN / OPSLAAN ─────────────────────────
  if (actie === 'instellingen_lezen') {
    try {
      const inst = leesInstellingen();
      if (!inst.vastontvanger1) {
        // Eerste gebruik: seed vanuit MAIL_ONTVANGER
        const adressen = (MAIL_ONTVANGER || '').split(',').map(a => a.trim()).filter(a => a.includes('@'));
        inst.vastontvanger1 = adressen[0] || '';
        inst.vastontvanger2 = adressen[1] || '';
        const ss = SpreadsheetApp.openById(SHEET_ID);
        let sheet = ss.getSheetByName('Instellingen');
        if (!sheet) {
          sheet = ss.insertSheet('Instellingen');
          sheet.appendRow(['sleutel', 'waarde']);
        }
        if (inst.vastontvanger1) sheet.appendRow(['vastontvanger1', inst.vastontvanger1]);
        if (inst.vastontvanger2) sheet.appendRow(['vastontvanger2', inst.vastontvanger2]);
      }
      return jsonOutput({ status: 'ok', instellingen: inst });
    } catch(err) {
      return jsonOutput({ status: 'error', message: err.message });
    }
  }

  if (actie === 'instellingen_opslaan') {
    try {
      const ss = SpreadsheetApp.openById(SHEET_ID);
      let sheet = ss.getSheetByName('Instellingen');
      if (!sheet) {
        sheet = ss.insertSheet('Instellingen');
        sheet.appendRow(['sleutel', 'waarde']);
      }
      const rows = sheet.getDataRange().getValues();
      for (let i = rows.length - 1; i >= 1; i--) {
        if (String(rows[i][0]).trim().startsWith('vastontvanger')) sheet.deleteRow(i + 1);
      }
      const aantal = parseInt(e.parameter._aantalontvangers || '0');
      for (let i = 1; i <= aantal; i++) {
        const waarde = (e.parameter['vastontvanger' + i] || '').trim();
        if (waarde) sheet.appendRow(['vastontvanger' + i, waarde]);
      }
      return jsonOutput({ status: 'ok' });
    } catch(err) {
      return jsonOutput({ status: 'error', message: err.message });
    }
  }

  // ── ARTIKEL BEHEER (GET) ──────────────────────────────────
  if (actie === 'toevoegen' || actie === 'bijwerken' || actie === 'verwijderen') {
    try {
      const sheet   = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAAM);
      const data    = sheet.getDataRange().getValues();
      const headers = data[0].map(h => String(h).trim().toLowerCase());
      const codeIdx = headers.indexOf('code');

      if (actie === 'toevoegen') {
        const rij = headers.map(h => e.parameter[h] || '');
        sheet.appendRow(rij);
        return jsonOutput({ status: 'ok', actie });
      }

      const zoekCode = String(e.parameter.code || '').trim();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][codeIdx]).trim() === zoekCode) {
          if (actie === 'verwijderen') {
            sheet.deleteRow(i + 1);
          } else {
            headers.forEach((h, j) => {
              if (e.parameter[h] !== undefined && h !== 'code') {
                sheet.getRange(i + 1, j + 1).setValue(e.parameter[h]);
              }
            });
          }
          return jsonOutput({ status: 'ok', actie });
        }
      }
      return jsonOutput({ status: 'niet_gevonden', code: zoekCode });
    } catch(err) {
      return jsonOutput({ status: 'error', message: err.message });
    }
  }
  try {
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const bladNaam = e.parameter.blad || SHEET_NAAM;
    const sheet = ss.getSheetByName(bladNaam);

    if (!sheet) {
      return jsonOutput({ status: 'error', message: `Tabblad "${bladNaam}" niet gevonden.` });
    }

    const data    = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());

    const artikelen = data
      .slice(1)
      .filter(rij => String(rij[0]).trim() !== '')
      .map(rij => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = String(rij[i] ?? '').trim(); });
        return obj;
      });

    return jsonOutput({ status: 'ok', artikelen, count: artikelen.length });

  } catch (err) {
    return jsonOutput({ status: 'error', message: err.message });
  }
}

// ── POST: artikel toevoegen, bijwerken of verwijderen ─────────
function doPost(e) {
  try {
    const body  = JSON.parse(e.postData.contents);
    const actie = body.actie;

    const sheet   = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAAM);
    const data    = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const codeIdx = headers.indexOf('code');

    if (actie === 'toevoegen') {
      const rij = headers.map(h => body.artikel[h] || '');
      sheet.appendRow(rij);
      return jsonOutput({ status: 'ok', actie });
    }

    if (actie === 'bijwerken' || actie === 'verwijderen') {
      const zoekCode = String(body.code).trim();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][codeIdx]).trim() === zoekCode) {
          if (actie === 'verwijderen') {
            sheet.deleteRow(i + 1);
          } else {
            headers.forEach((h, j) => {
              if (body.artikel[h] !== undefined) sheet.getRange(i + 1, j + 1).setValue(body.artikel[h]);
            });
          }
          return jsonOutput({ status: 'ok', actie });
        }
      }
      return jsonOutput({ status: 'niet_gevonden', code: body.code });
    }

    return jsonOutput({ status: 'error', message: `Onbekende actie: ${actie}` });

  } catch (err) {
    return jsonOutput({ status: 'error', message: err.message });
  }
}