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
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.style.borderColor = 'var(--green)'; });
  dz.addEventListener('dragleave', () => { dz.style.borderColor = ''; });
  dz.addEventListener('drop', e => {
    e.preventDefault();
    const bestand = e.dataTransfer?.files?.[0];
    if (bestand) verwerkTuCsv(bestand);
  });
});

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
        const leverdatum    = data.leverdatum || localStorage.getItem('leverdatum') || 'zsm';
        const leverdatumTxt = !leverdatum || leverdatum === 'zsm'
          ? 'Zo snel mogelijk'
          : new Date(leverdatum + 'T12:00:00').toLocaleDateString('nl-NL', { day:'2-digit', month:'long', year:'numeric' });

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
          <div class="s-row"><span>Monteur</span><span>${data.naam || '—'}</span></div>
          <div class="s-row"><span>Project</span><span>${data.projectnaam || (data.projectnummer ? data.projectnummer : '—')}</span></div>
          <div class="s-row"><span>Leverdatum</span><span>${leverdatumTxt}</span></div>
          <div class="s-row"><span>Afleveradres</span><span>${data.locatie || '—'}</span></div>
          <div class="s-row total"><span>Totaal</span><span>${totaalStuks} stuks · ${histItems.length} artikel${histItems.length !== 1 ? 'en' : ''}</span></div>`;

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

function laadOpgeslagenIconen() {
  try {
    const opgeslagen = localStorage.getItem('emondt_icons');
    if (opgeslagen) {
      const parsed = JSON.parse(opgeslagen);
      Object.assign(ICONS, parsed);
    }
  } catch(e) {}
}

function updateOnlineStatus() {
  const bar = document.getElementById('pwa-banner');
  // Offline-status beïnvloedt de PWA-banner niet; log alleen voor debugging
}
window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();
