/* ── Emondt Materiaalapp — beheer.js ──
 * Beheerpaneel: artikelen beheren, bestellingenoverzicht
 */

// ── BESTELLINGENOVERZICHT (ADMIN) ─────────────────────────────
async function laadBestellingenOverzicht() {
  const statusEl = document.getElementById('bestellingen-status');
  const lijstEl  = document.getElementById('bestellingen-lijst');

  statusEl.innerHTML = '<span style="color:var(--muted)">⏳ Bestellingen ophalen...</span>';
  lijstEl.innerHTML = '';

  let bestellingen;
  try {
    const { data, error } = await sb
      .from('bestellingen')
      .select('*')
      .order('aangemaakt_op', { ascending: false });
    if (error) throw error;
    bestellingen = data || [];
  } catch(err) {
    statusEl.innerHTML = `<span style="color:var(--danger)">❌ ${err.message}</span>`;
    return;
  }

  if (!bestellingen.length) {
    statusEl.innerHTML = '<span style="color:var(--muted)">Geen bestellingen gevonden.</span>';
    return;
  }
  statusEl.innerHTML = `<span style="color:green">✅ ${bestellingen.length} bestelling${bestellingen.length !== 1 ? 'en' : ''} gevonden.</span>`;

  const fmtDatum = (raw) => {
    if (!raw) return '—';
    const d = new Date(raw);
    if (isNaN(d)) return String(raw).substring(0, 10);
    return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getFullYear()).slice(-2)}`;
  };
  const fmtLever = (raw) => (!raw || raw === 'zsm') ? 'z.s.m.' : fmtDatum(raw);

  lijstEl.innerHTML = bestellingen.map((b, i) => {
        const naam        = b.monteur_naam || '—';
        const afdeling    = b.afdeling     || '';
        const projectnaam = b.projectnaam  || '';
        const locatie     = b.afleveradres || '—';
        const opmerkingen = b.opmerkingen  || '';
        const besteldatum = fmtDatum(b.aangemaakt_op);
        const leverdatum  = fmtLever(b.leverdatum);

        const titel = [naam, projectnaam].filter(Boolean).join(' – ');

        const artikelItems = Array.isArray(b.artikelen) ? b.artikelen : [];

        let artikelRegels = '';
        if (artikelItems.length) {
          artikelRegels = artikelItems.map(a => `
            <div class="best-artikel-rij">
              <span class="best-artikel-qty">${a.qty}×</span>
              <span style="flex:1;font-size:.82rem;color:var(--text)">${a.naam || a.code || '—'}${a.code ? ' (' + a.code + ')' : ''} per ${a.eenheid || 'stuk'}${a.leverancier ? ' – ' + a.leverancier : ''}</span>
            </div>`).join('');
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

async function exporteerBesteldeArtikelen() {
  const statusEl = document.getElementById('export-status');
  const setStatus = (html) => { if (statusEl) statusEl.innerHTML = html; };

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

  let bestellingen;
  try {
    const { data, error } = await sb
      .from('bestellingen')
      .select('*')
      .order('aangemaakt_op', { ascending: false });
    if (error) throw error;
    bestellingen = data || [];
  } catch(err) {
    setStatus(`<span style="color:var(--danger)">❌ ${err.message}</span>`);
    return;
  }

  if (!bestellingen.length) {
    setStatus('<span style="color:var(--muted)">Geen bestellingen gevonden.</span>');
    return;
  }

  {
      let aantalBestellingen = 0;
      let overgeslagenZonderDatum = 0;
      // Sleutel = artikelcode + eenheid, zodat hetzelfde artikel in
      // verschillende eenheden (bv. "stuk" vs "meter") niet vermengd wordt.
      const totalen = {};

      bestellingen.forEach(b => {
        // Bij een actief datumfilter tellen alleen bestellingen met een
        // leesbare datum die binnen het bereik valt. Zonder filter tellen alle.
        if (vanD || totD) {
          const d = _parseBestelDatum(b.aangemaakt_op);
          if (!d) { overgeslagenZonderDatum++; return; }
          if (vanD && d < vanD) return;
          if (totD && d > totD) return;
        }
        aantalBestellingen++;

        const items = Array.isArray(b.artikelen) ? b.artikelen : [];

        items.forEach(a => {
          const eenheid = (a.eenheid || 'stuk').trim() || 'stuk';
          const key = (a.code || a.naam || '—') + '\u0000' + eenheid;
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
  }
}

// Beheer blijft na één geslaagde wachtwoordcontrole ontgrendeld voor de
// rest van de sessie (tot herladen/uitloggen). sessionStorage overleeft
// een navigatie, maar niet het sluiten van de app.
// Toegang tot het beheerpaneel loopt via de rol 'admin' in Supabase.
// Er is geen apart beheerwachtwoord meer; showTab() controleert isAdmin().

// ── BEHEERDERSPANEEL ──────────────────────────────────────────
function corsErrorMsg(err) {
  if (err.message?.includes('NetworkError') || err.message?.includes('Failed to fetch') || err.message?.includes('fetch resource')) {
    return '❌ CORS-fout: de app mag de Sheets API niet bereiken vanuit deze omgeving. Deploy de app op GitHub Pages of een webserver.';
  }
  return '❌ Verbindingsfout: ' + err.message;
}

// ── AUTOMATISERINGEN (voorheen Google Sheet-formules) ─────────
// Bouwt automatisch de webshop-link op basis van leverancier + code.
function _genereerArtikelLink(code, leverancier) {
  const c = (code || '').trim();
  if (!c) return '';
  const ec = encodeURIComponent(c);
  switch ((leverancier || '').trim().toLowerCase()) {
    case 'mupro':            return `https://www.muepro.nl/index.php?lang=2&cl=search&searchparam=${ec}`;
    case 'technische unie':  return `https://www.technischeunie.nl/zoeken?Q=${ec}`;
    case 'coolmark':         return `https://www.coolmark.nl/nl/artnr/${ec}`;
    case 'wasco':            return `https://www.wasco.nl/artikel/${ec}`;
    default:                 return '';
  }
}

// Past de automatiseringen toe op een artikel-object vóór opslaan:
//  - lege link → automatisch invullen uit leverancier + code
//  - eenheid "meter" met lege warning → '*' (bestel per meter)
function _pasArtikelAutomatiseringenToe(artikel, code) {
  const c = code || artikel.code || '';
  if (!artikel.link) {
    const auto = _genereerArtikelLink(c, artikel.leverancier);
    if (auto) artikel.link = auto;
  }
  if ((artikel.eenheid || '').trim().toLowerCase() === 'meter' && !artikel.warning) {
    artikel.warning = '*';
  }
  return artikel;
}

// ── DROPDOWN-SUGGESTIES (datalists uit bestaande database) ────
function _distinctVeld(veld) {
  // Hoofdletter-ongevoelig ontdubbelen; behoud de meest voorkomende schrijfwijze
  // (zodat bv. "Mupro" en "mupro" één optie worden).
  const groepen = new Map(); // kleine letters → Map(origineel → aantal)
  ARTIKELEN.forEach(a => {
    const raw = (a[veld] || '').trim();
    if (!raw) return;
    const k = raw.toLowerCase();
    if (!groepen.has(k)) groepen.set(k, new Map());
    const m = groepen.get(k);
    m.set(raw, (m.get(raw) || 0) + 1);
  });
  const resultaat = [];
  groepen.forEach(m => {
    let best = '', bestN = -1;
    m.forEach((n, orig) => { if (n > bestN) { best = orig; bestN = n; } });
    resultaat.push(best);
  });
  return resultaat.sort((x, y) => x.localeCompare(y, 'nl'));
}
function _vulDatalist(id, waarden) {
  const dl = document.getElementById(id);
  if (!dl) return;
  dl.innerHTML = waarden.map(w => `<option value="${w.replace(/"/g, '&quot;')}"></option>`).join('');
}
function vulBeheerDatalists() {
  _vulDatalist('dl-cat',         _distinctVeld('cat'));
  _vulDatalist('dl-subcat',      _distinctVeld('subcat'));
  _vulDatalist('dl-subsubcat',   _distinctVeld('subsubcat'));
  _vulDatalist('dl-eenheid',     _distinctVeld('eenheid'));
  _vulDatalist('dl-leverancier', _distinctVeld('leverancier'));
  _vulDatalist('dl-verpakking',  _distinctVeld('verpakking'));
}

// ── GEKOPPELDE ARTIKELEN — zoek & selecteer ──────────────────
// Elke koppeling onthoudt zijn eigen richting:
//   wederzijds: true  → het andere artikel krijgt dit artikel er ook bij
//   wederzijds: false → alleen dit artikel verwijst naar het andere
const _koppelState = { admin: [], bewerk: [] };
let _koppelEigenCode = ''; // code van het bewerkte artikel (niet aan zichzelf koppelen)

function _eigenCodeVoor(prefix) {
  return prefix === 'bewerk'
    ? _koppelEigenCode
    : (document.getElementById('admin-code')?.value.trim() || '');
}

function koppelInit(prefix, codesStr, eigenCode) {
  if (prefix === 'bewerk') _koppelEigenCode = eigenCode || '';
  const eigen = _eigenCodeVoor(prefix);
  // Bestaande koppelingen: wederzijds als het andere artikel nu al terugwijst.
  _koppelState[prefix] = _splitKoppel(codesStr).map(code => {
    const doel = ARTIKELEN.find(a => a.code === code);
    return {
      code,
      wederzijds: !!(eigen && doel && _splitKoppel(doel.linktoitems).includes(eigen)),
    };
  });
  const zoek = document.getElementById(prefix + '-koppel-zoek'); if (zoek) zoek.value = '';
  const res  = document.getElementById(prefix + '-koppel-resultaten'); if (res) res.innerHTML = '';
  _koppelRender(prefix);
}

function _koppelRender(prefix) {
  const hidden = document.getElementById(prefix + '-linktoitems');
  if (hidden) hidden.value = _koppelState[prefix].map(k => k.code).join(' / ');
  const chips = document.getElementById(prefix + '-koppel-chips');
  if (!chips) return;
  chips.innerHTML = _koppelState[prefix].length
    ? _koppelState[prefix].map(k => {
        const a = ARTIKELEN.find(x => x.code === k.code);
        const pijl  = k.wederzijds ? '⇄' : '→';
        const titel = k.wederzijds
          ? 'Beide artikelen verwijzen naar elkaar — klik om te wisselen'
          : 'Alleen dit artikel verwijst naar het andere — klik om te wisselen';
        return `<span class="koppel-chip"><button type="button" title="${titel}"
            onclick="koppelRichtingWissel('${prefix}','${k.code}')"
            style="background:none;border:none;padding:0 4px 0 0;cursor:pointer;color:inherit;font:inherit;opacity:.75">${pijl}</button>${a ? a.naam : k.code} <span style="opacity:.55">(${k.code})</span><button type="button" onclick="koppelVerwijder('${prefix}','${k.code}')">×</button></span>`;
      }).join('')
    : '<span style="color:var(--muted);font-size:.8rem">Nog geen gekoppelde artikelen.</span>';
}

function koppelZoek(prefix) {
  const q = (document.getElementById(prefix + '-koppel-zoek').value || '').toLowerCase().trim();
  const res = document.getElementById(prefix + '-koppel-resultaten');
  if (!res) return;
  if (!q) { res.innerHTML = ''; return; }
  const eigen   = _eigenCodeVoor(prefix);
  const gekozen = new Set(_koppelState[prefix].map(k => k.code));
  const gevonden = ARTIKELEN.filter(a =>
    a.code !== eigen && !gekozen.has(a.code) &&
    (a.naam.toLowerCase().includes(q) || a.code.toLowerCase().includes(q))
  ).slice(0, 8);
  res.innerHTML = gevonden.length
    ? gevonden.map(a => `<div class="koppel-resultaat" onclick="koppelVoegToe('${prefix}','${a.code}')"><span>${a.naam}</span><span class="koppel-resultaat-code">${a.code}</span></div>`).join('')
    : '<div style="padding:8px;color:var(--muted);font-size:.8rem">Geen artikelen gevonden.</div>';
}

// ── Keuzepopup: eenrichtings- of wederzijdse koppeling ────────
let _koppelKeuzeResolve = null;

function _vraagKoppelRichting(doelNaam, eigenNaam) {
  const overlay = document.getElementById('koppel-keuze-overlay');
  const tekst   = document.getElementById('koppel-keuze-tekst');
  if (!overlay) return Promise.resolve(true); // popup ontbreekt → oude gedrag
  if (tekst) {
    tekst.textContent = eigenNaam
      ? `Je koppelt "${doelNaam}" aan "${eigenNaam}". Moet "${doelNaam}" straks ook naar dit artikel verwijzen?`
      : `Je koppelt "${doelNaam}". Moet "${doelNaam}" straks ook terugverwijzen naar dit artikel?`;
  }
  overlay.style.display = 'flex';
  return new Promise(resolve => { _koppelKeuzeResolve = resolve; });
}

function koppelKeuzeAntwoord(wederzijds) {
  const overlay = document.getElementById('koppel-keuze-overlay');
  if (overlay) overlay.style.display = 'none';
  const klaar = _koppelKeuzeResolve;
  _koppelKeuzeResolve = null;
  if (klaar) klaar(wederzijds);
}

async function koppelVoegToe(prefix, code) {
  if (_koppelState[prefix].some(k => k.code === code)) return;

  const doelNaam  = ARTIKELEN.find(a => a.code === code)?.naam || code;
  const eigen     = _eigenCodeVoor(prefix);
  const eigenNaam = prefix === 'bewerk'
    ? (ARTIKELEN.find(a => a.code === eigen)?.naam || '')
    : (document.getElementById('admin-naam')?.value.trim() || '');

  const wederzijds = await _vraagKoppelRichting(doelNaam, eigenNaam);
  if (wederzijds === null) return; // geannuleerd

  _koppelState[prefix].push({ code, wederzijds });
  const zoek = document.getElementById(prefix + '-koppel-zoek'); if (zoek) zoek.value = '';
  const res  = document.getElementById(prefix + '-koppel-resultaten'); if (res) res.innerHTML = '';
  _koppelRender(prefix);
}

function koppelRichtingWissel(prefix, code) {
  const k = _koppelState[prefix].find(x => x.code === code);
  if (!k) return;
  k.wederzijds = !k.wederzijds;
  _koppelRender(prefix);
}

function koppelVerwijder(prefix, code) {
  _koppelState[prefix] = _koppelState[prefix].filter(k => k.code !== code);
  _koppelRender(prefix);
}

async function adminArtikelOpslaan() {
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
    trefwoorden: document.getElementById('admin-trefwoorden')?.value.trim() || '',
    linktoitems: document.getElementById('admin-linktoitems')?.value.trim() || '',
  };
  _pasArtikelAutomatiseringenToe(artikel, code);

  // Tegenkant van de koppelingen bepalen vóór het opslaan. Bij een bestaand
  // artikelnummer (upsert) telt wat er nu al gekoppeld staat als oude stand.
  const mutaties = _berekenKoppelMutaties(
    code, code,
    _splitKoppel(ARTIKELEN.find(x => x.code === code)?.linktoitems),
    _koppelState.admin,
  );

  status.innerHTML = '<span style="color:var(--muted)">⏳ Opslaan...</span>';

  const { error } = await sb.from('artikelen').upsert(artikel, { onConflict: 'code' });
  if (error) {
    status.innerHTML = `<span style="color:var(--danger)">❌ Fout: ${error.message}</span>`;
    return;
  }

  const koppelFout = await _pasKoppelMutatiesToe(mutaties);
  if (koppelFout) {
    status.innerHTML = `<span style="color:var(--danger)">⚠️ Artikel opgeslagen, maar ${koppelFout}</span>`;
    return;
  }

  status.innerHTML = '<span style="color:var(--green-dark)">✅ Artikel opgeslagen!</span>';
  ['admin-code','admin-naam','admin-cat','admin-subcat','admin-eenheid','admin-leverancier','admin-link','admin-verpakking','admin-trefwoorden','admin-linktoitems'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  koppelInit('admin', '');
  herlaadArtikelen();
}

function _splitKoppel(s) {
  return String(s || '').split(/[\/,]/).map(c => c.trim()).filter(Boolean);
}

// Artikelen die in hun linktoitems naar deze code verwijzen.
function _verwijzingenNaar(code) {
  return ARTIKELEN.filter(x => x.code !== code && _splitKoppel(x.linktoitems).includes(code));
}

// Bepaalt per geraakt artikel de nieuwe linktoitems — één schrijfactie per
// artikel. `nieuweState` is _koppelState[prefix]: per koppeling de code plus
// of hij wederzijds moet zijn.
//
// Alleen artikelen die in dit formulier zijn toegevoegd of weggehaald worden
// aangepast. Een bestaande eenzijdige koppeling van een ander artikel naar dit
// artikel blijft staan; die is ooit bewust zo gemaakt en wissen we niet stilletjes.
function _berekenKoppelMutaties(oudeCode, nieuweCode, oudeLijst, nieuweState) {
  const oud        = new Set(oudeLijst);
  const nieuw      = new Set(nieuweState.map(k => k.code));
  const wederzijds = new Set(nieuweState.filter(k => k.wederzijds).map(k => k.code));
  const hernoemen  = nieuweCode !== oudeCode;
  const mutaties   = [];

  const noteer = (doelCode, nieuweStr, huidig) => {
    if (nieuweStr !== String(huidig || '')) mutaties.push({ code: doelCode, linktoitems: nieuweStr });
  };

  for (const doelCode of new Set([...oud, ...nieuw])) {
    if (doelCode === oudeCode || doelCode === nieuweCode) continue;
    const doel = ARTIKELEN.find(a => a.code === doelCode);
    if (!doel) continue;

    // Eenrichtingskoppeling: het andere artikel bewust ongemoeid laten. Alleen
    // bij een hernoeming moet een bestaande verwijzing wél mee, anders wijst
    // die naar een artikelnummer dat niet meer bestaat.
    if (nieuw.has(doelCode) && !wederzijds.has(doelCode)) {
      if (hernoemen) {
        const str = _splitKoppel(doel.linktoitems)
          .map(c => (c === oudeCode ? nieuweCode : c)).join(' / ');
        noteer(doelCode, str, doel.linktoitems);
      }
      continue;
    }

    const lijst = _splitKoppel(doel.linktoitems).filter(c => c !== oudeCode && c !== nieuweCode);
    if (wederzijds.has(doelCode)) lijst.push(nieuweCode);
    noteer(doelCode, lijst.join(' / '), doel.linktoitems);
  }

  // Bij een hernoeming ook de artikelen meenemen die naar ons verwijzen zonder
  // dat wij ze in onze eigen lijst hebben staan — daar alleen het nummer omzetten.
  if (hernoemen) {
    for (const ref of _verwijzingenNaar(oudeCode)) {
      if (oud.has(ref.code) || nieuw.has(ref.code)) continue;
      const str = _splitKoppel(ref.linktoitems)
        .map(c => (c === oudeCode ? nieuweCode : c)).join(' / ');
      noteer(ref.code, str, ref.linktoitems);
    }
  }

  return mutaties;
}

async function _pasKoppelMutatiesToe(mutaties) {
  for (const m of mutaties) {
    const { error } = await sb.from('artikelen')
      .update({ linktoitems: m.linktoitems }).eq('code', m.code);
    if (error) return `koppeling in "${m.code}" bijwerken mislukte: ${error.message}`;
  }
  return null;
}

async function adminOpslaanBewerking(oudeCode) {
  const statusEl   = document.getElementById('bewerk-status');
  const nieuweCode = document.getElementById('bewerk-code').value.trim();
  const fout = (tekst) => { statusEl.innerHTML = `<span style="color:var(--danger)">${tekst}</span>`; };

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
    trefwoorden: document.getElementById('bewerk-trefwoorden')?.value.trim() || '',
    linktoitems: document.getElementById('bewerk-linktoitems')?.value.trim() || '',
  };
  _pasArtikelAutomatiseringenToe(artikel, nieuweCode || oudeCode);

  if (!artikel.naam) { fout('❌ Naam is verplicht.');          return; }
  if (!nieuweCode)   { fout('❌ Artikelnummer is verplicht.'); return; }

  // Het artikelnummer is de sleutel waar alles aan hangt. Wijzigen mag,
  // maar alleen bewust en met de gevolgen op tafel.
  const hernoemen = nieuweCode !== oudeCode;
  if (hernoemen) {
    if (ARTIKELEN.some(x => x.code === nieuweCode)) {
      fout(`❌ Artikelnummer "${nieuweCode}" is al in gebruik.`);
      return;
    }
    const geraakt = _verwijzingenNaar(oudeCode).length;
    const extra = geraakt
      ? `\n\n${geraakt} artikel(en) die hieraan gekoppeld zijn, worden automatisch bijgewerkt.`
      : '';
    const akkoord = confirm(
      `Artikelnummer wijzigen van "${oudeCode}" naar "${nieuweCode}"?\n\n` +
      `De bestelhistorie blijft het oude nummer tonen, en het artikel verdwijnt ` +
      `uit winkelwagens en favorieten van monteurs.${extra}`
    );
    if (!akkoord) { statusEl.innerHTML = ''; return; }
    artikel.code = nieuweCode;
  }

  // Bereken de tegenkant vóór het opslaan, zolang ARTIKELEN nog de oude stand heeft.
  const mutaties = _berekenKoppelMutaties(
    oudeCode, nieuweCode,
    _splitKoppel(ARTIKELEN.find(x => x.code === oudeCode)?.linktoitems),
    _koppelState.bewerk,
  );

  statusEl.innerHTML = '<span style="color:var(--muted)">⏳ Opslaan...</span>';

  const { error } = await sb.from('artikelen').update(artikel).eq('code', oudeCode);
  if (error) { fout(`❌ ${error.message}`); return; }

  const koppelFout = await _pasKoppelMutatiesToe(mutaties);
  if (koppelFout) { fout(`⚠️ Artikel opgeslagen, maar ${koppelFout}`); return; }

  statusEl.innerHTML = '<span style="color:green">✅ Opgeslagen!</span>';
  herlaadArtikelen();
  setTimeout(() => document.getElementById('admin-bewerk-form')?.remove(), 1500);
}

function adminVerwijder(code) {
  if (!confirm(`Artikel "${code}" verwijderen uit de database?`)) return;
  sb.from('artikelen').delete().eq('code', code)
  .then(({ error }) => {
    if (!error) {
      showToast('🗑 Artikel verwijderd');
      document.getElementById('admin-zoek').value = '';
      document.getElementById('admin-zoek-resultaten').innerHTML = '';
      herlaadArtikelen();
    } else {
      showToast('❌ Fout: ' + error.message);
    }
  });
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
    <div class="field"><label>Artikelnummer <span style="font-weight:400;color:var(--muted)">(wijzigen = hernoemen)</span></label><input type="text" id="bewerk-code" value="${a.code || ''}" /></div>
    <div class="field"><label>Naam</label><input type="text" id="bewerk-naam" value="${a.naam || ''}" /></div>
    <div class="field-2">
      <div class="field"><label>Categorie</label><input type="text" id="bewerk-cat" list="dl-cat" value="${a.cat || ''}" /></div>
      <div class="field"><label>Subcategorie</label><input type="text" id="bewerk-subcat" list="dl-subcat" value="${a.subcat || ''}" /></div>
    </div>
    <div class="field-2">
      <div class="field"><label>Subsubcategorie</label><input type="text" id="bewerk-subsubcat" list="dl-subsubcat" value="${a.subsubcat || ''}" /></div>
      <div class="field"><label>Eenheid</label><input type="text" id="bewerk-eenheid" list="dl-eenheid" value="${a.eenheid || ''}" /></div>
    </div>
    <div class="field-2">
      <div class="field"><label>Leverancier</label><input type="text" id="bewerk-leverancier" list="dl-leverancier" value="${a.leverancier || ''}" /></div>
      <div class="field"><label>Verpakking</label><input type="text" id="bewerk-verpakking" list="dl-verpakking" value="${a.verpakking || ''}" /></div>
    </div>
    <div class="field-2">
      <div class="field"><label>Link (URL) <span style="font-weight:400;color:var(--muted)">(leeg = automatisch)</span></label><input type="url" id="bewerk-link" value="${a.link || ''}" /></div>
      <div class="field"><label>Warning (* = per meter)</label><input type="text" id="bewerk-warning" value="${a.warning || ''}" /></div>
    </div>
    <div class="field">
      <label>Trefwoorden <span style="font-weight:400;color:var(--muted)">(extra zoekwoorden, gescheiden door komma's)</span></label>
      <input type="text" id="bewerk-trefwoorden" value="${a.trefwoorden || ''}" />
    </div>
    <div class="field">
      <label>Gekoppelde artikelen</label>
      <div id="bewerk-koppel-chips" class="koppel-chips"></div>
      <input type="text" id="bewerk-koppel-zoek" class="koppel-zoek" placeholder="🔍 zoek artikel op naam of code..." oninput="koppelZoek('bewerk')" autocomplete="off" />
      <div id="bewerk-koppel-resultaten" class="koppel-resultaten"></div>
      <input type="hidden" id="bewerk-linktoitems" value="${a.linktoitems || ''}" />
    </div>
    <div id="bewerk-status" style="font-size:.82rem;margin-bottom:8px;min-height:20px"></div>
    <div style="display:flex;gap:8px">
      <button onclick="adminOpslaanBewerking('${code}')" class="btn btn-primary" style="margin-bottom:0;flex:1">💾 Opslaan</button>
      <button onclick="document.getElementById('admin-bewerk-form').remove()" class="btn btn-secondary" style="margin-bottom:0;flex:1">Annuleren</button>
    </div>`;

  document.getElementById('admin-zoek-resultaten').appendChild(form);
  vulBeheerDatalists();
  koppelInit('bewerk', a.linktoitems || '', code);
  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

async function laadEmailontvangers() {
  const statusEl = document.getElementById('email-status');
  const lijst = document.getElementById('email-ontvangers-lijst');
  statusEl.innerHTML = '<span style="color:var(--muted)">⏳ Laden...</span>';
  try {
    const { data, error } = await sb
      .from('instellingen')
      .select('waarde')
      .eq('sleutel', 'mail_ontvangers')
      .maybeSingle();
    if (error) throw error;
    lijst.innerHTML = '';
    const adressen = (data?.waarde || '')
      .split(/[,;]/).map(a => a.trim()).filter(Boolean);
    if (adressen.length) { adressen.forEach(a => voegOntvangerToe(a)); }
    else { voegOntvangerToe(); }
    statusEl.innerHTML = '<span style="color:var(--green-dark)">✅ Geladen</span>';
  } catch(err) {
    statusEl.innerHTML = `<span style="color:var(--danger)">❌ ${err.message}</span>`;
  }
}

async function slaEmailontvangerOp() {
  const statusEl = document.getElementById('email-status');
  const adressen = [...document.querySelectorAll('.email-ontvanger-input')]
    .map(i => i.value.trim()).filter(a => a && a.includes('@'));
  if (!adressen.length) {
    statusEl.innerHTML = '<span style="color:var(--danger)">❌ Voer minimaal één geldig e-mailadres in.</span>';
    return;
  }
  statusEl.innerHTML = '<span style="color:var(--muted)">⏳ Opslaan...</span>';
  try {
    const { error } = await sb
      .from('instellingen')
      .upsert({ sleutel: 'mail_ontvangers', waarde: adressen.join(', ') }, { onConflict: 'sleutel' });
    if (error) throw error;
    statusEl.innerHTML = '<span style="color:var(--green-dark)">✅ Opgeslagen!</span>';
  } catch(err) {
    statusEl.innerHTML = `<span style="color:var(--danger)">❌ ${err.message}</span>`;
  }
}
