/* ── Emondt Materiaalapp — api.js ──
 * Google Sheets API calls en TU CSV import
 */

// ── LADEN UIT GOOGLE SHEETS ───────────────────────────────────
function laadArtikelenUitSheets() {
  // Één eenvoudige regel: cache < 24 uur? Tonen. Anders: ophalen.
  try {
    const cached = localStorage.getItem('emondt_artikelen_cache');
    const ts     = localStorage.getItem('emondt_artikelen_ts');
    const cacheGeldig = cached && ts && (Date.now() - parseInt(ts)) < 86400000;

    if (cacheGeldig) {
      ARTIKELEN = JSON.parse(cached);
      renderArtikelen(ARTIKELEN);
      _naArtikelenGeladen();
      return; // Klaar — geen fetch
    }
  } catch(e) {}

  // Cache verlopen of leeg → toon spinner en haal op
  const lijst = document.getElementById('artikel-lijst');
  if (lijst) lijst.innerHTML = `
    <div class="laad-indicator" style="padding:60px 20px">
      <div class="laad-spinner"></div>
      <span>Artikelen laden...</span>
    </div>`;
  fetchSheets();
}

function fetchSheets() {
  if (!SHEETS_API_URL || SHEETS_API_URL === 'JOUW_WEBAPP_URL_HIER') {
    // Geen URL — toon cache of uitlegmelding
    try {
      const cached = localStorage.getItem('emondt_artikelen_cache');
      if (cached) {
        ARTIKELEN = JSON.parse(cached);
        renderArtikelen(ARTIKELEN);
        _naArtikelenGeladen();
        showToast('📦 Gecachte database geladen');
        return;
      }
    } catch(e) {}
    const lijst = document.getElementById('artikel-lijst');
    if (lijst) lijst.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--muted);font-size:.86rem">⚙️ Koppel de Google Sheets API via Beheer.</div>';
    return;
  }

  fetch(SHEETS_API_URL + '?actie=lezen&t=' + Date.now())
    .then(r => r.json())
    .then(data => {
      if (data.status === 'ok' && Array.isArray(data.artikelen)) {
        ARTIKELEN = data.artikelen.map(a => ({
          code:        a.code        || '',
          naam:        a.naam        || '',
          cat:         a.cat         || '',
          subcat:      a.subcat      || '',
          eenheid:     a.eenheid     || 'stuk',
          leverancier: a.leverancier || '',
          warning:     a.warning     || '',
          verpakking:  a.verpakking  || '',
          afbeelding:  a.afbeelding  || '',
          subsubcat:   a.subsubcat   || '',
          link:        a.link        || '',
          linktoitems: a.linktoitems || '',
          trefwoorden: a.trefwoorden || '',
          details:     a.details     || '',
          icon:        ICONS[a.cat] || ICON_DEFAULTS[a.cat] || '📦',
        })).filter(a => a.code && a.naam);

        // Sla op in localStorage met timestamp
        try {
          localStorage.setItem('emondt_artikelen_cache', JSON.stringify(ARTIKELEN));
          localStorage.setItem('emondt_artikelen_ts', Date.now().toString());
        } catch(e) {}

        renderArtikelen(ARTIKELEN);
        _naArtikelenGeladen();
        showToast('✓ ' + ARTIKELEN.length + ' artikelen geladen');
      } else {
        laadUitCache();
      }
    })
    .catch(() => laadUitCache());
}

function laadUitCache() {
  try {
    const cached = localStorage.getItem('emondt_artikelen_cache');
    if (cached) {
      ARTIKELEN = JSON.parse(cached);
      renderArtikelen(ARTIKELEN);
      _naArtikelenGeladen();
      const ts = localStorage.getItem('emondt_artikelen_ts');
      const leeftijd = ts ? Math.round((Date.now() - parseInt(ts)) / 60000) : '?';
      showToast(`📦 Cache geladen (${leeftijd} min oud)`);
      return;
    }
  } catch(e) {}
  const lijst = document.getElementById('artikel-lijst');
  if (lijst) lijst.innerHTML = `
    <div class="laad-indicator" style="padding:60px 20px">
      <div class="laad-spinner"></div>
      <span>Artikelen laden...</span>
    </div>`;
}


// ── TU CSV IMPORT ─────────────────────────────────────────────
let TU_GEVONDEN_ARTIKELEN = [];

// Kolomnamen die TU gebruikt — meerdere varianten opvangen
const TU_KOLOM_MAP = {
  code:    ['artikelnummer'],
  naam:    ['artikelomschrijving'],
  eenheid: ['verpakkingseenheid'],
};

function detecteerKolom(headers, type) {
  const mogelijkheden = TU_KOLOM_MAP[type] || [];
  for (const h of headers) {
    if (mogelijkheden.includes(h.toLowerCase().trim())) return h;
  }
  return null;
}

function parseerCsvRegel(regel, sep) {
  // Verwerkt CSV-velden correct: aanhalingstekens worden gerespecteerd,
  // komma's binnen aanhalingstekens worden NIET als scheidingsteken gezien.
  const velden = [];
  let huidig = '';
  let inQuote = false;
  for (let i = 0; i < regel.length; i++) {
    const c = regel[i];
    if (c === '"') {
      if (inQuote && regel[i + 1] === '"') {
        // Escaped aanhalingsteken ("") binnen quoted veld
        huidig += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (c === sep && !inQuote) {
      velden.push(huidig.trim());
      huidig = '';
    } else {
      huidig += c;
    }
  }
  velden.push(huidig.trim());
  return velden;
}

function normaliseerEenheid(waarde) {
  // "1 stuk(s)", "2 stuk(s)" etc. → "stuks"
  if (/^\d+\s+stuk\(s\)$/i.test(waarde.trim())) return 'stuks';
  return waarde;
}

function parseerCsv(tekst) {
  // Detecteer scheidingsteken: ; of ,
  const eersteLijn = tekst.split(/\r?\n/)[0];
  const sep = eersteLijn.includes(';') ? ';' : ',';

  const regels = tekst.split(/\r?\n/).filter(r => r.trim());
  const headers = parseerCsvRegel(regels[0].replace(/^\uFEFF/, ''), sep).map(h => h.replace(/^"|"$/g, '').trim());

  return regels.slice(1).map(regel => {
    const velden = parseerCsvRegel(regel, sep);
    const obj = {};
    headers.forEach((h, i) => obj[h] = velden[i] !== undefined ? velden[i] : '');
    return obj;
  }).filter(r => Object.values(r).some(v => v));
}

function verwerkTuCsv(bestand) {
  if (!bestand) return;
  const statusEl = document.getElementById('tu-import-status');
  const dropzone  = document.getElementById('tu-dropzone');
  statusEl.innerHTML = '<span style="color:var(--muted)">⏳ Bestand verwerken...</span>';

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const tekst   = e.target.result;
      const rijen   = parseerCsv(tekst);
      const headers = Object.keys(rijen[0] || {});

      const kCode  = detecteerKolom(headers, 'code');
      const kNaam  = detecteerKolom(headers, 'naam');
      const kEenh  = detecteerKolom(headers, 'eenheid');

      if (!kNaam && !kCode) {
        statusEl.innerHTML = '<span style="color:var(--danger)">❌ Geen herkende kolommen gevonden. Controleer of het een TU-export is.</span>';
        return;
      }

      TU_GEVONDEN_ARTIKELEN = rijen
        .map(r => ({
          code:    kCode ? r[kCode].trim() : '',
          naam:    kNaam ? r[kNaam].trim() : '',
          eenheid: kEenh ? normaliseerEenheid(r[kEenh].trim()) : 'stuk',
        }))
        .filter(a => a.code && a.naam);

      if (!TU_GEVONDEN_ARTIKELEN.length) {
        statusEl.innerHTML = '<span style="color:var(--danger)">❌ Geen artikelen gevonden in het bestand.</span>';
        return;
      }

      // Toon preview
      statusEl.innerHTML = `<span style="color:green">✅ ${TU_GEVONDEN_ARTIKELEN.length} artikel${TU_GEVONDEN_ARTIKELEN.length !== 1 ? 'en' : ''} gevonden.</span>`;
      dropzone.style.borderColor = 'var(--green)';

      const previewEl = document.getElementById('tu-preview-lijst');
      previewEl.innerHTML = TU_GEVONDEN_ARTIKELEN.map((a, i) => `
        <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);${i === TU_GEVONDEN_ARTIKELEN.length - 1 ? 'border-bottom:none' : ''}">
          <span style="color:var(--muted);font-family:'DM Mono',monospace;font-size:.74rem;min-width:70px">${a.code}</span>
          <span style="flex:1">${a.naam}</span>
          <span style="color:var(--muted);font-size:.74rem">${a.eenheid}</span>
        </div>`).join('');

      document.getElementById('tu-preview').style.display = 'block';

    } catch(err) {
      statusEl.innerHTML = `<span style="color:var(--danger)">❌ Fout bij verwerken: ${err.message}</span>`;
    }
  };
  reader.readAsText(bestand, 'UTF-8');
}

function schrijfTuNaarDatabase() {
  const url = getSheetsUrl();
  const statusEl = document.getElementById('tu-import-status');
  if (!url) { statusEl.innerHTML = '<span style="color:var(--danger)">❌ Geen Web App URL ingesteld.</span>'; return; }
  if (!TU_GEVONDEN_ARTIKELEN.length) return;

  statusEl.innerHTML = `<span style="color:var(--muted)">⏳ ${TU_GEVONDEN_ARTIKELEN.length} artikelen schrijven naar database...</span>`;
  document.getElementById('tu-schrijf-btn').disabled = true;

  let succes = 0, fouten = 0;

  const schrijfVolgende = (index) => {
    if (index >= TU_GEVONDEN_ARTIKELEN.length) {
      statusEl.innerHTML = succes > 0
        ? `<span style="color:green">✅ ${succes} artikel${succes !== 1 ? 'en' : ''} opgeslagen in de database${fouten ? ` · ${fouten} overgeslagen` : ''}.</span>`
        : `<span style="color:var(--danger)">❌ Alle artikelen gefaald (${fouten} fouten).</span>`;
      document.getElementById('tu-schrijf-btn').disabled = false;
      herlaadArtikelen();
      return;
    }

    const a = TU_GEVONDEN_ARTIKELEN[index];
    const params = new URLSearchParams({
      actie:       'toevoegen',
      code:        a.code,
      naam:        a.naam,
      eenheid:     a.eenheid || 'stuk',
      leverancier: 'Technische Unie',
      cat:         'Technische Unie',
      t:           Date.now() + index,
    });

    fetch(`${url}?${params.toString()}`)
      .then(r => r.json())
      .then(r => {
        if (r.status === 'ok') succes++;
        else fouten++;
        statusEl.innerHTML = `<span style="color:var(--muted)">⏳ ${index + 1}/${TU_GEVONDEN_ARTIKELEN.length} verwerkt...</span>`;
        schrijfVolgende(index + 1);
      })
      .catch(() => {
        fouten++;
        schrijfVolgende(index + 1);
      });
  };

  schrijfVolgende(0);
}

function resetTuImport() {
  TU_GEVONDEN_ARTIKELEN = [];
  document.getElementById('tu-preview').style.display = 'none';
  document.getElementById('tu-import-status').innerHTML = '';
  document.getElementById('tu-csv-input').value = '';
  document.getElementById('tu-dropzone').style.borderColor = '';
}

// Drag & drop ondersteuning
document.addEventListener('DOMContentLoaded', () => {
  const dz = document.getElementById('tu-dropzone');
  if (!dz) return;
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.style.borderColor = 'var(--navy)'; });
  dz.addEventListener('dragleave', () => { dz.style.borderColor = ''; });
  dz.addEventListener('drop', e => {
    e.preventDefault();
    const bestand = e.dataTransfer?.files?.[0];
    if (bestand) verwerkTuCsv(bestand);
  });
});

// ── DEV BEHEER ────────────────────────────────────────────────
const DEV_PW = 'Eg@2026!#';

function getSheetsUrl() {
  return SHEETS_API_URL;
}

// Alle schrijfacties via GET (geen POST — werkt altijd cross-origin)
function sheetsRequest(params) {
  const url = getSheetsUrl();
  if (!url) return Promise.resolve({ status: 'geen_url' });
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(typeof v === 'object' ? JSON.stringify(v) : v)}`)
    .join('&');
  return fetch(`${url}?${qs}&t=${Date.now()}`).then(r => r.json());
}

// Bestelling loggen — compact GET request
function logBestellingSheets(data) {
  const url = getSheetsUrl();
  if (!url) return;

  // Log formaat: aantal-artikelnr-beschrijving
  const logArtikelStr = (data.items || [])
    .map(i => `${i.qty}-${i.code}-${(i.naam || '').replace(/[×|]/g, '')}`)
    .join('|');

  // Mail formaat: artikelnr×aantal×beschrijving×eenheid×leverancier
  const mailArtikelStr = (data.items || [])
    .map(i => [
      i.code,
      i.qty,
      (i.naam       || '').replace(/[×|]/g, ''),
      (i.eenheid    || 'stuk').replace(/[×|]/g, ''),
      (i.leverancier|| '').replace(/[×|]/g, ''),
    ].join('×'))
    .join('|');

  const params = new URLSearchParams({
    actie:         'bestelling',
    datum:         data.datum          || '',
    naam:          data.naam           || '',
    telefoon:      data.telefoon       || '',
    afdeling:      data.afdeling       || '',
    projectnummer: data.projectnummer  || '',
    projectnaam:   data.projectnaam    || '',
    locatie:       data.locatie        || '',
    leverdatum:    data.leverdatum     || '',
    opmerkingen:   data.opmerkingen   || '',
    ontvanger2:    data.ontvanger2     || '',
    gebruiker:     getAuthSessie()?.gebruiker || '',
    artikelen:     mailArtikelStr,
    log_artikelen: logArtikelStr,
    totaal:        (data.items || []).reduce((s, i) => s + (parseInt(i.qty)||0), 0),
    t:             Date.now(),
  });

  fetch(`${url}?${params.toString()}`)
    .then(r => r.json())
    .then(r => {
      if (r.status === 'ok') {
        // Gebruik data.items — niet cart (die wordt daarna pas geleegd)
        const histItems = (data.items || []).map(i => ({
          code:        i.code,
          qty:         i.qty,
          naam:        i.naam,
          eenheid:     i.eenheid,
          leverancier: i.leverancier || '',
        }));
        const leverdatum    = data.leverdatum || localStorage.getItem('leverdatum') || '';
        const leverdatumTxt = leverdatum
          ? new Date(leverdatum + 'T12:00:00').toLocaleDateString('nl-NL', { day:'2-digit', month:'long', year:'numeric' })
          : '—';

        slaHistorieOp({
          datum:         new Date().toLocaleString('nl-NL'),
          leverdatum,
          naam:          data.naam          || '',
          telefoon:      data.telefoon      || '',
          afdeling:      data.afdeling      || '',
          projectnummer: data.projectnummer || '',
          projectnaam:   data.projectnaam   || '',
          locatie:       data.locatie       || '',
          opmerkingen:   data.opmerkingen  || '',
          artikelen:     histItems,
        });

        // Bevestigingsscherm
        const totaalStuks = histItems.reduce((s, a) => s + a.qty, 0);
        document.getElementById('bevestiging-samenvatting').innerHTML = `
          <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 14px;margin-bottom:12px">
            <span style="color:var(--muted)">Monteur</span><span style="font-weight:600">${data.naam || '—'}</span>
            <span style="color:var(--muted)">Project</span><span style="font-weight:600">${data.projectnaam || '—'}</span>
            <span style="color:var(--muted)">Leverdatum</span><span style="font-weight:600;color:var(--navy)">${leverdatumTxt}</span>
            <span style="color:var(--muted)">Afleveradres</span><span style="font-weight:600">${data.locatie || '—'}</span>
          </div>
          <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--green);margin-bottom:6px">Bestelde artikelen</div>
          <div style="background:var(--white);border-radius:8px;overflow:hidden;border:1px solid var(--border)">
            ${histItems.map((a, i) => `
              <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:${i%2===0?'var(--white)':'var(--bg)'};font-size:.82rem">
                <span style="font-weight:700;color:var(--navy);min-width:28px">${a.qty}×</span>
                <span style="flex:1">${a.naam}</span>
                <span style="color:var(--muted);font-family:'DM Mono',monospace;font-size:.74rem">${a.code}</span>
              </div>`).join('')}
            <div style="background:var(--navy);color:var(--green);padding:7px 10px;font-size:.8rem;font-weight:700;display:flex;justify-content:space-between">
              <span>Totaal</span><span>${totaalStuks} stuks · ${histItems.length} artikel${histItems.length !== 1 ? 'en' : ''}</span>
            </div>
          </div>`;

        document.getElementById('bevestiging-overlay').style.display = 'flex';
        cart = {};
        saveCart();
        updateBadge();
        renderCart();

        // Project, levering en leverdatum wissen
        ['projectnummer','projectnaam','opmerkingen'].forEach(id => {
          const el = document.getElementById(id); if (el) el.value = '';
        });
        const locKeuze = document.getElementById('locatie-keuze');
        const locInput = document.getElementById('locatie');
        if (locKeuze) { locKeuze.value = ''; }
        if (locInput) { locInput.value = ''; locInput.style.display = 'none'; }
        const levEl = document.getElementById('leverdatum-static');
        if (levEl) levEl.value = '';
        try { localStorage.removeItem('leverdatum'); } catch(e){}
        updateCartSamenvatting();
      } else {
        showToast('⚠️ Fout: ' + (r.message || r.status));
      }
    })
    .catch(err => {
      showToast('⚠️ Verbinding mislukt: ' + err.message);
    });
}

function sluitBevestiging(naarOverzicht) {
  document.getElementById('bevestiging-overlay').style.display = 'none';
  if (naarOverzicht) {
    showTab('historie');
  } else {
    showTab('artikelen');
  }
}

function openDev() {
  // Al ingelogd in deze sessie?
  if (sessionStorage.getItem('dev_auth') === '1') {
    closeDrawer();
    showTab('dev');
      initDevPage();
    return;
  }
  closeDrawer();
  document.getElementById('dev-overlay').classList.add('open');
  document.getElementById('dev-pw').value = '';
  document.getElementById('dev-pw-err').style.display = 'none';
  setTimeout(() => document.getElementById('dev-pw').focus(), 100);
}

function initDevPage() {
  bouwIconKiezer();
}

function bouwIconKiezer() {
  const container = document.getElementById('cat-icon-lijst');
  if (!container) return;
  const cats = [...new Set(ARTIKELEN.map(a => a.cat))].filter(Boolean).sort();
  if (!cats.length) {
    container.innerHTML = '<div style="color:var(--muted);font-size:.8rem">Laad eerst artikelen om iconen in te stellen.</div>';
    return;
  }
  container.innerHTML = cats.map(cat => {
    const huidig = ICONS[cat] || ICON_DEFAULTS[cat] || '📦';
    const opties = ICOON_OPTIES.map(ic =>
      `<option value="${ic}"${ic===huidig?' selected':''}>${ic}</option>`
    ).join('');
    return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:1.1rem;width:28px;text-align:center">${huidig}</span>
      <span style="flex:1;font-size:.84rem">${cat}</span>
      <select data-cat="${cat}" style="background:var(--bg);border:1.5px solid var(--border);border-radius:6px;font-size:1rem;padding:4px 6px;color:var(--text);outline:none" onchange="previewIcon(this)">
        ${opties}
      </select>
    </div>`;
  }).join('');
}

function previewIcon(sel) {
  const icoon = sel.value;
  const preview = sel.parentElement.querySelector('span:first-child');
  if (preview) preview.textContent = icoon;
}

function slaIconenOp() {
  const selects = document.querySelectorAll('#cat-icon-lijst select[data-cat]');
  selects.forEach(sel => {
    const cat = sel.dataset.cat;
    ICONS[cat] = sel.value;
  });
  // Opslaan in localStorage
  try { localStorage.setItem('emondt_icons', JSON.stringify(ICONS)); } catch(e) {}
  // Drawer vernieuwen
  bouwDrawerCats();
  // Artikellijst vernieuwen (iconen in kaartjes updaten)
  renderArtikelen(activeCat ? ARTIKELEN.filter(a=>a.cat===activeCat) : ARTIKELEN);
  showToast('✅ Iconen opgeslagen');
}

function laadOpgeslagenIconen() {
  try {
    const opgeslagen = localStorage.getItem('emondt_icons');
    if (opgeslagen) {
      const parsed = JSON.parse(opgeslagen);
      Object.assign(ICONS, parsed);
    }
  } catch(e) {}
}

function checkPw() {
  if (document.getElementById('dev-pw').value === DEV_PW) {
    sessionStorage.setItem('dev_auth', '1');
    document.getElementById('dev-overlay').classList.remove('open');
    showTab('dev');
      initDevPage();
  } else {
    document.getElementById('dev-pw-err').style.display = 'block';
    document.getElementById('dev-pw').value = '';
  }
}

function devZoek() {
  const q = document.getElementById('dev-zoek').value.toLowerCase().trim();
  const res = document.getElementById('dev-zoek-resultaten');
  if (!q) { res.innerHTML = ''; return; }
  const gevonden = ARTIKELEN.filter(a =>
    a.naam.toLowerCase().includes(q) || a.code.toLowerCase().includes(q)
  ).slice(0, 15);
  if (!gevonden.length) {
    res.innerHTML = '<div style="color:var(--muted);font-size:.84rem;padding:8px 0">Geen resultaten gevonden.</div>';
    return;
  }
  res.innerHTML = gevonden.map(a => `
    <div class="dev-artikel-row" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:6px;display:flex;align-items:center;gap:8px">
      <div class="info" style="flex:1;min-width:0">
        <strong style="font-size:.86rem;display:block;word-break:break-word">${a.naam}</strong>
        <span style="font-size:.7rem;color:var(--muted)">${a.code} · ${a.cat}${a.subcat ? ' › ' + a.subcat : ''}</span>
      </div>
      <button data-code="${a.code}" class="btn-del-artikel" style="background:#fdecea;border:1px solid #f5c6c2;color:var(--danger);padding:6px 10px;border-radius:6px;cursor:pointer;font-size:.82rem;flex-shrink:0">🗑 Verwijderen</button>
    </div>`).join('');

  // Bind events via delegation-safe approach
  res.querySelectorAll('.btn-del-artikel').forEach(btn => {
    btn.addEventListener('click', () => devVerwijderArtikel(btn.dataset.code));
  });
}

function devVerwijderArtikel(code) {
  const a = ARTIKELEN.find(x => x.code === code);
  if (!a || !confirm(`Artikel "${a.naam}" (${code}) verwijderen uit de database?`)) return;
  ARTIKELEN.splice(ARTIKELEN.findIndex(x => x.code === code), 1);
  if (cart[code]) { delete cart[code]; saveCart(); updateBadge(); }
  bouwDrawerCats();
  devZoek();

  // Verwijder uit Sheets
  sheetsRequest({ actie: 'verwijderen', code })
    .then(data => showToast(data.status === 'ok' ? '🗑 Verwijderd uit Sheets' : '⚠️ ' + (data.message||data.status)))
    .catch(() => showToast('🗑 Lokaal verwijderd (Sheets niet bereikbaar)'));
}

function updateOnlineStatus() {
  const bar = document.getElementById('pwa-banner');
  // Offline-status beïnvloedt de PWA-banner niet; log alleen voor debugging
}
window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();
