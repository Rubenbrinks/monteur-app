/* ── Emondt Materiaalapp — beheer.js ──
 * Beheerpaneel: artikelen beheren, bestellingenoverzicht
 */

// ── BESTELLINGENOVERZICHT (ADMIN) ─────────────────────────────
function laadBestellingenOverzicht() {
  const url = getSheetsUrl();
  const statusEl = document.getElementById('bestellingen-status');
  const lijstEl  = document.getElementById('bestellingen-lijst');
  if (!url) { statusEl.innerHTML = '<span style="color:var(--danger)">❌ Geen Web App URL ingesteld.</span>'; return; }

  statusEl.innerHTML = '<span style="color:var(--muted)">⏳ Bestellingen ophalen...</span>';
  lijstEl.innerHTML = '';

  fetch(`${url}?actie=lezen&blad=Bestellingen&t=${Date.now()}`)
    .then(r => r.json())
    .then(data => {
      if (data.status !== 'ok' || !data.artikelen?.length) {
        statusEl.innerHTML = '<span style="color:var(--muted)">Geen bestellingen gevonden.</span>';
        return;
      }

      const bestellingen = [...data.artikelen].reverse();
      statusEl.innerHTML = `<span style="color:green">✅ ${bestellingen.length} bestelling${bestellingen.length !== 1 ? 'en' : ''} gevonden.</span>`;

      const fmtDatum = (raw) => {
        if (!raw) return '—';
        const d = new Date(raw);
        if (isNaN(d)) {
          const m = String(raw).match(/(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{2,4})/);
          if (m) return `${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}-${m[3].slice(-2)}`;
          return String(raw).substring(0, 10);
        }
        return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getFullYear()).slice(-2)}`;
      };

      lijstEl.innerHTML = bestellingen.map((b, i) => {
        const naam        = b.monteur      || b.naam        || '—';
        const afdeling    = b.afdeling     || '';
        const projectnaam = b.projectnaam  || '';
        const locatie     = b.afleveradres || b.locatie     || '—';
        const opmerkingen = b.opmerkingen  || '';
        const besteldatum = fmtDatum(b.datum);
        const leverdatum  = fmtDatum(b.leverdatum);

        const titel = [naam, projectnaam].filter(Boolean).join(' – ');

        // Gebruik machine-leesbare ArtikelenData als die beschikbaar is, anders fallback op leesbare tekst
        const artikelItems = b.artikelendata
          ? _parseArtikelenData(b.artikelendata)
          : _parseArtikelenTekst(b.artikelen || '');

        let artikelRegels = '';
        if (artikelItems.length) {
          artikelRegels = artikelItems.map(a => `
            <div class="best-artikel-rij">
              <span class="best-artikel-qty">${a.qty}×</span>
              <span style="flex:1;font-size:.82rem;color:var(--text)">${a.naam || a.code || '—'}${a.code ? ' (' + a.code + ')' : ''} per ${a.eenheid || 'stuk'}${a.leverancier ? ' – ' + a.leverancier : ''}</span>
            </div>`).join('');
        } else if (b.artikelen) {
          artikelRegels = (b.artikelen).split('\n').filter(Boolean)
            .map(r => `<div style="font-size:.8rem;padding:3px 0;color:var(--text-secondary)">${r}</div>`).join('');
        }

        return `
        <div class="hist-item" style="cursor:default">
          <div onclick="toggleBestOverzicht(${i})" style="cursor:pointer">
            <div class="hist-datum">${besteldatum}${leverdatum !== '—' ? ' · Levering: ' + leverdatum : ''}</div>
            <div class="hist-project" style="font-size:.9rem">${titel || naam}</div>
            <div class="hist-meta">${afdeling ? afdeling + ' · ' : ''}${locatie}</div>
          </div>
          <div class="hist-detail" id="best-overzicht-${i}" onclick="event.stopPropagation()">
            <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 12px;font-size:.82rem;margin-bottom:10px">
              <span style="color:var(--muted)">Locatie</span><span style="font-weight:600">${locatie}</span>
              <span style="color:var(--muted)">Leverdatum</span><span style="font-weight:600;color:var(--green)">${leverdatum}</span>
              ${opmerkingen ? `<span style="color:var(--muted)">Opmerking</span><span style="font-style:italic">${opmerkingen}</span>` : ''}
            </div>
            <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--green);margin-bottom:6px">Artikelen</div>
            <div class="best-artikelen-wrap">${artikelRegels || '<span style="color:var(--muted);font-size:.8rem;padding:8px 0;display:block">Geen artikeldetails beschikbaar</span>'}</div>
          </div>
        </div>`;
      }).join('');
    })
    .catch(err => {
      statusEl.innerHTML = `<span style="color:var(--danger)">❌ ${corsErrorMsg(err)}</span>`;
    });
}

function toggleBestOverzicht(i) {
  const el    = document.getElementById('best-overzicht-' + i);
  const kaart = el?.closest('.hist-item');
  if (!el) return;
  el.classList.toggle('open');
  kaart?.classList.toggle('open', el.classList.contains('open'));
}

// ── BESTELDE ARTIKELEN EXPORTEREN (ADMIN) ─────────────────────
// Parse een besteldatum naar een Date (of null). De Bestellingen-cel kan
// in verschillende vormen binnenkomen, afhankelijk van hoe de sheet hem
// bewaart:
//   - "dd-mm-jjjj hh:mm"  (nl-NL tekst, zoals cart.js hem nu opslaat)
//   - "jjjj-mm-dd..."     (ISO, indien ooit zo opgeslagen)
//   - Engelse Date-string (als de cel een echt Date-object is → String())
// We proberen eerst het expliciete NL-formaat, daarna een generieke Date().
function _parseBestelDatum(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  // dd-mm-jjjj (met optionele tijd erachter) — dag eerst, niet ISO
  const m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) {
    let jaar = parseInt(m[3], 10);
    if (jaar < 100) jaar += 2000;
    const d = new Date(jaar, parseInt(m[2], 10) - 1, parseInt(m[1], 10),
      parseInt(m[4] || '0', 10), parseInt(m[5] || '0', 10));
    return isNaN(d.getTime()) ? null : d;
  }
  // ISO of Engelse Date-string
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function exporteerBesteldeArtikelen() {
  const url = getSheetsUrl();
  const statusEl = document.getElementById('export-status');
  const setStatus = (html) => { if (statusEl) statusEl.innerHTML = html; };
  if (!url) { setStatus('<span style="color:var(--danger)">❌ Geen Web App URL ingesteld.</span>'); return; }

  const vanRaw = document.getElementById('export-van')?.value || '';
  const totRaw = document.getElementById('export-tot')?.value || '';
  const vanD = vanRaw ? new Date(vanRaw + 'T00:00:00') : null;
  const totD = totRaw ? new Date(totRaw + 'T23:59:59') : null;
  if ((vanRaw && !vanD) || (totRaw && !totD) ||
      (vanD && isNaN(vanD.getTime())) || (totD && isNaN(totD.getTime()))) {
    setStatus('<span style="color:var(--danger)">❌ Ongeldige datum.</span>');
    return;
  }
  if (vanD && totD && vanD > totD) {
    setStatus('<span style="color:var(--danger)">❌ "Van"-datum ligt na "Tot"-datum.</span>');
    return;
  }

  setStatus('<span style="color:var(--muted)">⏳ Bestellingen ophalen...</span>');

  fetch(`${url}?actie=lezen&blad=Bestellingen&t=${Date.now()}`)
    .then(r => r.json())
    .then(data => {
      if (!data || data.status !== 'ok' || !Array.isArray(data.artikelen) || !data.artikelen.length) {
        setStatus('<span style="color:var(--muted)">Geen bestellingen gevonden.</span>');
        return;
      }

      let aantalBestellingen = 0;
      let overgeslagenZonderDatum = 0;
      // Sleutel = artikelcode + eenheid, zodat hetzelfde artikel in
      // verschillende eenheden (bv. "stuk" vs "meter") niet vermengd wordt.
      const totalen = {};

      data.artikelen.forEach(b => {
        // Bij een actief datumfilter tellen alleen bestellingen met een
        // leesbare datum die binnen het bereik valt. Zonder filter tellen alle.
        if (vanD || totD) {
          const d = _parseBestelDatum(b.datum);
          if (!d) { overgeslagenZonderDatum++; return; }
          if (vanD && d < vanD) return;
          if (totD && d > totD) return;
        }
        aantalBestellingen++;

        const items = b.artikelendata
          ? _parseArtikelenData(b.artikelendata)
          : _parseArtikelenTekst(b.artikelen || '');

        items.forEach(a => {
          const eenheid = (a.eenheid || 'stuk').trim() || 'stuk';
          const key = (a.code || a.naam || '—') + ' ' + eenheid;
          if (!totalen[key]) {
            totalen[key] = { code: a.code || '', naam: a.naam || '', eenheid, leverancier: a.leverancier || '', qty: 0 };
          }
          totalen[key].qty += (Number(a.qty) || 0);
          // Vul ontbrekende velden aan vanuit latere regels
          if (!totalen[key].naam && a.naam) totalen[key].naam = a.naam;
          if (!totalen[key].leverancier && a.leverancier) totalen[key].leverancier = a.leverancier;
        });
      });

      const rijen = Object.values(totalen)
        .filter(r => r.qty > 0)
        .sort((a, b) => (a.naam || a.code).localeCompare(b.naam || b.code, 'nl'));

      if (!rijen.length) {
        setStatus('<span style="color:var(--muted)">Geen artikelen in de gekozen periode.</span>');
        return;
      }

      // CSV opbouwen (puntkomma-scheiding — standaard voor NL-Excel)
      const esc = v => {
        const s = String(v ?? '');
        return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      };
      const koppen = ['Artikelnummer', 'Omschrijving', 'Totaal aantal', 'Eenheid', 'Leverancier'];
      const csvRegels = [koppen.join(';')];
      rijen.forEach(r => {
        csvRegels.push([esc(r.code), esc(r.naam), r.qty, esc(r.eenheid), esc(r.leverancier)].join(';'));
      });
      // Totaalregel: alleen zinvol als alle regels dezelfde eenheid hebben
      // (anders zou je bv. stuks en meters bij elkaar optellen).
      const eenhedenSet = new Set(rijen.map(r => r.eenheid));
      const totaalAantal = rijen.reduce((s, r) => s + r.qty, 0);
      const totaalEenheid = eenhedenSet.size === 1 ? [...eenhedenSet][0] : '';
      const totaalLabel = eenhedenSet.size === 1 ? 'TOTAAL' : 'TOTAAL (gemengde eenheden)';
      csvRegels.push(['', totaalLabel, totaalAantal, totaalEenheid, ''].join(';'));
      const csv = '﻿' + csvRegels.join('\r\n'); // BOM zodat Excel accenten toont

      // Downloaden
      const periode = (vanRaw || totRaw)
        ? `_${vanRaw || 'begin'}_tot_${totRaw || 'eind'}`
        : '';
      const bestandsnaam = `bestelde-artikelen${periode}.csv`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const objUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      // Fallback voor webviews zonder download-attribuut (bv. sommige iOS
      // in-app browsers): open de CSV in een nieuw tabblad.
      if (typeof link.download === 'undefined') {
        window.open(objUrl, '_blank');
      } else {
        link.href = objUrl;
        link.download = bestandsnaam;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      setTimeout(() => URL.revokeObjectURL(objUrl), 1000);

      const waarschuwing = overgeslagenZonderDatum
        ? ` <span style="color:var(--muted)">(${overgeslagenZonderDatum} bestelling${overgeslagenZonderDatum !== 1 ? 'en' : ''} zonder leesbare datum overgeslagen)</span>`
        : '';
      setStatus(`<span style="color:green">✅ ${rijen.length} artikel${rijen.length !== 1 ? 'en' : ''} uit ${aantalBestellingen} bestelling${aantalBestellingen !== 1 ? 'en' : ''} geëxporteerd.</span>${waarschuwing}`);
    })
    .catch(err => {
      setStatus(`<span style="color:var(--danger)">❌ ${corsErrorMsg(err)}</span>`);
    });
}

// Beheer blijft na één geslaagde wachtwoordcontrole ontgrendeld voor de
// rest van de sessie (tot herladen/uitloggen). sessionStorage overleeft
// een navigatie, maar niet het sluiten van de app.
function beheerUnlocked() {
  return sessionStorage.getItem('beheer_auth') === '1';
}

function openBeheerLogin() {
  // Alleen admins zien de beheerknop, maar we controleren de rol hier nogmaals.
  if (!isAdmin()) {
    showToast('⛔ Geen toegang — alleen beschikbaar voor admins. Vraag Ruben Brinks voor toegang.');
    return;
  }
  // Al ontgrendeld in deze sessie? → direct openen, geen wachtwoord vragen.
  if (beheerUnlocked()) { showTab('beheer-panel'); return; }

  const url = getSheetsUrl();
  if (!url) { showToast('❌ Geen databasekoppeling.'); return; }

  const pw = prompt('Voer het beheerwachtwoord in:');
  if (pw === null) return;                 // geannuleerd
  if (!pw.trim()) { showToast('❌ Geen wachtwoord ingevoerd.'); return; }

  showToast('⏳ Wachtwoord controleren...');
  fetch(`${url}?actie=beheer_login&wachtwoord=${encodeURIComponent(pw)}&t=${Date.now()}`)
    .then(r => r.json())
    .then(r => {
      if (r.status === 'ok') {
        sessionStorage.setItem('beheer_auth', '1');
        showTab('beheer-panel');
      } else if (r.status === 'niet_ingesteld') {
        showToast('⚠️ Er is nog geen beheerwachtwoord ingesteld in de Instellingen-tab.');
      } else {
        showToast('❌ Onjuist beheerwachtwoord.');
      }
    })
    .catch(err => showToast(corsErrorMsg(err)));
}

// ── BEHEERDERSPANEEL ──────────────────────────────────────────
function corsErrorMsg(err) {
  if (err.message?.includes('NetworkError') || err.message?.includes('Failed to fetch') || err.message?.includes('fetch resource')) {
    return '❌ CORS-fout: de app mag de Sheets API niet bereiken vanuit deze omgeving. Deploy de app op GitHub Pages of een webserver.';
  }
  return '❌ Verbindingsfout: ' + err.message;
}

function adminArtikelOpslaan() {
  const code = document.getElementById('admin-code').value.trim();
  const naam = document.getElementById('admin-naam').value.trim();
  const status = document.getElementById('admin-status');
  if (!code || !naam) { status.innerHTML = '<span style="color:var(--danger)">Vul minimaal artikelnummer en naam in.</span>'; return; }

  const artikel = {
    code, naam,
    cat:         document.getElementById('admin-cat').value.trim(),
    subcat:      document.getElementById('admin-subcat').value.trim(),
    eenheid:     document.getElementById('admin-eenheid').value.trim() || 'stuk',
    leverancier: document.getElementById('admin-leverancier').value.trim(),
    link:        document.getElementById('admin-link').value.trim(),
    verpakking:  document.getElementById('admin-verpakking').value.trim(),
  };

  const url = getSheetsUrl();
  if (!url) { status.innerHTML = '<span style="color:var(--danger)">Geen Web App URL ingesteld.</span>'; return; }

  status.innerHTML = '<span style="color:var(--muted)">⏳ Opslaan...</span>';
  const params = new URLSearchParams({ actie: 'toevoegen', ...artikel, t: Date.now() });
  fetch(`${url}?${params.toString()}`)
  .then(r => r.json())
  .then(r => {
    if (r.status === 'ok') {
      status.innerHTML = '<span style="color:var(--green-dark)">✅ Artikel opgeslagen!</span>';
      ['admin-code','admin-naam','admin-cat','admin-subcat','admin-eenheid','admin-leverancier','admin-link','admin-verpakking'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
      herlaadArtikelen();
    } else {
      status.innerHTML = `<span style="color:var(--danger)">❌ Fout: ${r.message || JSON.stringify(r)}</span>`;
    }
  })
  .catch(err => { status.innerHTML = `<span style="color:var(--danger)">${corsErrorMsg(err)}</span>`; });
}

function adminOpslaanBewerking(code) {
  const url = getSheetsUrl();
  const statusEl = document.getElementById('bewerk-status');
  if (!url) { statusEl.innerHTML = '<span style="color:var(--danger)">❌ Geen URL ingesteld.</span>'; return; }

  const artikel = {
    naam:        document.getElementById('bewerk-naam').value.trim(),
    cat:         document.getElementById('bewerk-cat').value.trim(),
    subcat:      document.getElementById('bewerk-subcat').value.trim(),
    subsubcat:   document.getElementById('bewerk-subsubcat').value.trim(),
    eenheid:     document.getElementById('bewerk-eenheid').value.trim(),
    leverancier: document.getElementById('bewerk-leverancier').value.trim(),
    verpakking:  document.getElementById('bewerk-verpakking').value.trim(),
    link:        document.getElementById('bewerk-link').value.trim(),
    warning:     document.getElementById('bewerk-warning').value.trim(),
  };

  if (!artikel.naam) { statusEl.innerHTML = '<span style="color:var(--danger)">❌ Naam is verplicht.</span>'; return; }
  statusEl.innerHTML = '<span style="color:var(--muted)">⏳ Opslaan...</span>';

  const params = new URLSearchParams({ actie: 'bijwerken', code, ...artikel, t: Date.now() });
  fetch(`${url}?${params.toString()}`)
  .then(r => r.json())
  .then(r => {
    if (r.status === 'ok') {
      statusEl.innerHTML = '<span style="color:green">✅ Opgeslagen!</span>';
      herlaadArtikelen();
      setTimeout(() => document.getElementById('admin-bewerk-form')?.remove(), 1500);
    } else {
      statusEl.innerHTML = `<span style="color:var(--danger)">❌ ${r.message || JSON.stringify(r)}</span>`;
    }
  })
  .catch(err => { statusEl.innerHTML = `<span style="color:var(--danger)">${corsErrorMsg(err)}</span>`; });
}

function adminVerwijder(code) {
  if (!confirm(`Artikel "${code}" verwijderen uit de database?`)) return;
  const url = getSheetsUrl();
  if (!url) { showToast('❌ Geen URL ingesteld'); return; }
  const params = new URLSearchParams({ actie: 'verwijderen', code, t: Date.now() });
  fetch(`${url}?${params.toString()}`)
  .then(r => r.json())
  .then(r => {
    if (r.status === 'ok') {
      showToast('🗑 Artikel verwijderd');
      document.getElementById('admin-zoek').value = '';
      document.getElementById('admin-zoek-resultaten').innerHTML = '';
      herlaadArtikelen();
    } else {
      showToast('❌ Fout: ' + (r.message || 'onbekend'));
    }
  })
  .catch(err => showToast(corsErrorMsg(err).substring(0, 60)));
}

function adminZoek() {
  const q = document.getElementById('admin-zoek').value.toLowerCase().trim();
  const el = document.getElementById('admin-zoek-resultaten');
  if (!el) return;
  if (!q) { el.innerHTML = ''; return; }
  const gevonden = ARTIKELEN.filter(a =>
    a.naam.toLowerCase().includes(q) || a.code.toLowerCase().includes(q)
  ).slice(0, 15);
  if (!gevonden.length) {
    el.innerHTML = '<p style="color:var(--muted);font-size:.84rem;padding:8px 0">Geen artikelen gevonden.</p>';
    return;
  }
  el.innerHTML = gevonden.map(a => `
    <div class="admin-artikel-rij">
      <div class="admin-artikel-info">
        <div class="admin-artikel-naam">${a.naam}</div>
        <div class="admin-artikel-code">${a.code}${a.cat ? ' · ' + a.cat : ''}${a.eenheid ? ' · per ' + a.eenheid : ''}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button onclick="adminBewerk('${a.code}')" style="background:var(--surface3);color:var(--text);border:1.5px solid var(--border-strong);border-radius:8px;padding:6px 10px;font-size:.76rem;font-weight:600;cursor:pointer">Bewerk</button>
        <button onclick="adminVerwijder('${a.code}')" style="background:var(--danger-light);color:var(--danger);border:1.5px solid #fca5a5;border-radius:8px;padding:6px 10px;font-size:.76rem;font-weight:600;cursor:pointer">🗑</button>
      </div>
    </div>`).join('');
}

function adminBewerk(code) {
  const a = ARTIKELEN.find(x => x.code === code);
  if (!a) return;

  // Verwijder eerder geopend bewerkformulier
  document.getElementById('admin-bewerk-form')?.remove();

  const form = document.createElement('div');
  form.id = 'admin-bewerk-form';
  form.style.cssText = 'background:var(--surface2);border-radius:12px;padding:16px;margin-top:12px;border:1.5px solid var(--border-strong)';
  form.innerHTML = `
    <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:var(--green);margin-bottom:12px">
      Bewerken: ${a.naam}
    </div>
    <div class="field"><label>Naam</label><input type="text" id="bewerk-naam" value="${a.naam || ''}" /></div>
    <div class="field-2">
      <div class="field"><label>Categorie</label><input type="text" id="bewerk-cat" value="${a.cat || ''}" /></div>
      <div class="field"><label>Subcategorie</label><input type="text" id="bewerk-subcat" value="${a.subcat || ''}" /></div>
    </div>
    <div class="field-2">
      <div class="field"><label>Subsubcategorie</label><input type="text" id="bewerk-subsubcat" value="${a.subsubcat || ''}" /></div>
      <div class="field"><label>Eenheid</label><input type="text" id="bewerk-eenheid" value="${a.eenheid || ''}" /></div>
    </div>
    <div class="field-2">
      <div class="field"><label>Leverancier</label><input type="text" id="bewerk-leverancier" value="${a.leverancier || ''}" /></div>
      <div class="field"><label>Verpakking</label><input type="text" id="bewerk-verpakking" value="${a.verpakking || ''}" /></div>
    </div>
    <div class="field-2">
      <div class="field"><label>Link (URL)</label><input type="url" id="bewerk-link" value="${a.link || ''}" /></div>
      <div class="field"><label>Warning (* = per meter)</label><input type="text" id="bewerk-warning" value="${a.warning || ''}" /></div>
    </div>
    <div id="bewerk-status" style="font-size:.82rem;margin-bottom:8px;min-height:20px"></div>
    <div style="display:flex;gap:8px">
      <button onclick="adminOpslaanBewerking('${code}')" class="btn btn-primary" style="margin-bottom:0;flex:1">💾 Opslaan</button>
      <button onclick="document.getElementById('admin-bewerk-form').remove()" class="btn btn-secondary" style="margin-bottom:0;flex:1">Annuleren</button>
    </div>`;

  document.getElementById('admin-zoek-resultaten').appendChild(form);
  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}



// ── TREFWOORDEN GENEREREN ─────────────────────────────────────
const _STOPWOORDEN = new Set([
  'de','het','een','en','in','op','voor','van','met','uit','bij','aan','per','te','of',
  'mm','cm','dm','m','stuks','stuk','set','paar','rol','bus','doos','zak',
]);

function startTrefwoordenGenereren() {
  const url      = getSheetsUrl();
  const statusEl = document.getElementById('trefwoorden-status');
  if (!url) { statusEl.innerHTML = '<span style="color:var(--danger)">❌ Geen Web App URL ingesteld.</span>'; return; }
  if (!ARTIKELEN.length) { statusEl.innerHTML = '<span style="color:var(--muted)">⚠️ Artikelen nog niet geladen — open eerst de artikelenpagina.</span>'; return; }

  const teVerwerken = ARTIKELEN.filter(a => !a.trefwoorden);
  if (!teVerwerken.length) { statusEl.innerHTML = '<span style="color:var(--green-dark)">✅ Alle artikelen hebben al trefwoorden.</span>'; return; }

  statusEl.innerHTML = `<span style="color:var(--muted)">⏳ 0/${teVerwerken.length} verwerkt...</span>`;
  let gedaan = 0, fouten = 0;

  const volgende = (index) => {
    if (index >= teVerwerken.length) {
      statusEl.innerHTML = `<span style="color:var(--green-dark)">✅ ${gedaan} trefwoorden opgeslagen${fouten ? `, ${fouten} mislukt` : ''}.</span>`;
      return;
    }
    const a = teVerwerken[index];
    const bronTekst = [a.naam, a.cat, a.subcat, a.subsubcat].join(' ');
    const woorden = bronTekst
      .toLowerCase()
      .replace(/[\/\-–]/g, ' ')
      .split(/[\s,.()\[\]]+/)
      .map(w => w.replace(/[^a-z0-9]/g, ''))
      .filter(w => w.length > 2 && !_STOPWOORDEN.has(w) && !/^\d+$/.test(w));
    const trefwoorden = [...new Set(woorden)].join(', ');

    if (!trefwoorden) { volgende(index + 1); return; }

    const params = new URLSearchParams({ actie: 'bijwerken', code: a.code, trefwoorden, t: Date.now() + index });
    fetch(`${url}?${params.toString()}`)
      .then(r => r.json())
      .then(r => {
        if (r.status === 'ok') { gedaan++; a.trefwoorden = trefwoorden; } else fouten++;
        statusEl.innerHTML = `<span style="color:var(--muted)">⏳ ${index + 1}/${teVerwerken.length} verwerkt...</span>`;
        volgende(index + 1);
      })
      .catch(() => { fouten++; volgende(index + 1); });
  };
  volgende(0);
}

// ── BEHEER UITVOUWBARE KAARTEN ────────────────────────────────
function toggleAdminKaart(id, btn) {
  const body = document.getElementById(id);
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  btn.classList.toggle('open', !open);
}

// ── EMAILADRESSEN BEHEREN ─────────────────────────────────────
function voegOntvangerToe(waarde) {
  const lijst = document.getElementById('email-ontvangers-lijst');
  const rij = document.createElement('div');
  rij.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px';
  rij.innerHTML = `
    <input type="email" class="email-ontvanger-input"
      placeholder="email@emondt.nl" value="${waarde || ''}"
      style="flex:1;padding:10px 12px;border:1.5px solid var(--border-strong);border-radius:10px;
             font-size:.9rem;font-family:'Inter','DM Sans',sans-serif;color:var(--text);
             background:var(--surface2);outline:none" />
    <button onclick="this.parentElement.remove()"
      style="width:34px;height:34px;border:1.5px solid var(--border-strong);border-radius:8px;
             background:var(--surface2);color:var(--muted);cursor:pointer;font-size:1.1rem;
             display:flex;align-items:center;justify-content:center;flex-shrink:0">×</button>`;
  lijst.appendChild(rij);
}

function laadEmailontvangers() {
  const statusEl = document.getElementById('email-status');
  statusEl.innerHTML = '<span style="color:var(--muted)">⏳ Laden...</span>';
  sheetsRequest({ actie: 'instellingen_lezen' })
    .then(r => {
      if (r.status === 'ok' && r.instellingen) {
        const lijst = document.getElementById('email-ontvangers-lijst');
        lijst.innerHTML = '';
        const inst = r.instellingen;
        const adressen = Object.keys(inst)
          .filter(k => k.startsWith('vastontvanger'))
          .sort()
          .map(k => inst[k])
          .filter(Boolean);
        if (adressen.length) { adressen.forEach(a => voegOntvangerToe(a)); }
        else { voegOntvangerToe(); }
        statusEl.innerHTML = '<span style="color:var(--green-dark)">✅ Geladen</span>';
      } else {
        statusEl.innerHTML = '<span style="color:var(--danger)">❌ Kon instellingen niet laden.</span>';
      }
    })
    .catch(err => { statusEl.innerHTML = `<span style="color:var(--danger)">${corsErrorMsg(err)}</span>`; });
}

function slaEmailontvangerOp() {
  const statusEl = document.getElementById('email-status');
  const adressen = [...document.querySelectorAll('.email-ontvanger-input')]
    .map(i => i.value.trim()).filter(a => a && a.includes('@'));
  if (!adressen.length) {
    statusEl.innerHTML = '<span style="color:var(--danger)">❌ Voer minimaal één geldig e-mailadres in.</span>';
    return;
  }
  const params = { actie: 'instellingen_opslaan', _aantalontvangers: adressen.length };
  adressen.forEach((a, i) => { params[`vastontvanger${i + 1}`] = a; });
  statusEl.innerHTML = '<span style="color:var(--muted)">⏳ Opslaan...</span>';
  sheetsRequest(params)
    .then(r => {
      if (r.status === 'ok') {
        statusEl.innerHTML = '<span style="color:var(--green-dark)">✅ Opgeslagen!</span>';
      } else {
        statusEl.innerHTML = `<span style="color:var(--danger)">❌ ${r.message || 'Onbekende fout'}</span>`;
      }
    })
    .catch(err => { statusEl.innerHTML = `<span style="color:var(--danger)">${corsErrorMsg(err)}</span>`; });
}
