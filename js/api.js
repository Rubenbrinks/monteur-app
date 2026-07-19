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

async function fetchSheets() {
  try {
    const { data, error } = await sb
      .from('artikelen')
      .select('*')
      .eq('actief', true)
      .order('cat', { ascending: true })
      .limit(5000);
    if (error) throw error;

    ARTIKELEN = (data || []).map(a => ({
      code:         a.code         || '',
      naam:         a.naam         || '',
      cat:          a.cat          || '',
      subcat:       a.subcat       || '',
      subsubcat:    a.subsubcat    || '',
      subsubsubcat: a.subsubsubcat || '',
      eenheid:      a.eenheid      || 'stuk',
      leverancier:  a.leverancier  || '',
      warning:      a.warning      || '',
      verpakking:   a.verpakking   || '',
      afbeelding:   a.afbeelding   || '',
      link:         a.link         || '',
      linktoitems:  a.linktoitems  || '',
      trefwoorden:  a.trefwoorden  || '',
      details:      a.details      || '',
      icon:         ICONS[a.cat] || ICON_DEFAULTS[a.cat] || '📦',
    })).filter(a => a.code && a.naam);

    try {
      localStorage.setItem('emondt_artikelen_cache', JSON.stringify(ARTIKELEN));
      localStorage.setItem('emondt_artikelen_ts', Date.now().toString());
    } catch(e) {}

    renderArtikelen(ARTIKELEN);
    _naArtikelenGeladen();
    showToast('✓ ' + ARTIKELEN.length + ' artikelen geladen');
  } catch(e) {
    laadUitCache();
  }
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

async function schrijfTuNaarDatabase() {
  const statusEl = document.getElementById('tu-import-status');
  if (!TU_GEVONDEN_ARTIKELEN.length) return;

  statusEl.innerHTML = `<span style="color:var(--muted)">⏳ ${TU_GEVONDEN_ARTIKELEN.length} artikelen schrijven naar database...</span>`;
  document.getElementById('tu-schrijf-btn').disabled = true;

  const rijen = TU_GEVONDEN_ARTIKELEN.map(a => ({
    code:        a.code,
    naam:        a.naam,
    eenheid:     a.eenheid || 'stuk',
    leverancier: 'Technische Unie',
    cat:         'Technische Unie',
  }));

  try {
    // upsert op 'code' zodat bestaande artikelen worden bijgewerkt i.p.v. gedupliceerd.
    const { error } = await sb.from('artikelen').upsert(rijen, { onConflict: 'code' });
    document.getElementById('tu-schrijf-btn').disabled = false;
    if (error) {
      statusEl.innerHTML = `<span style="color:var(--danger)">❌ Fout: ${error.message}</span>`;
      return;
    }
    statusEl.innerHTML = `<span style="color:green">✅ ${rijen.length} artikel${rijen.length !== 1 ? 'en' : ''} opgeslagen in de database.</span>`;
    herlaadArtikelen();
  } catch(e) {
    document.getElementById('tu-schrijf-btn').disabled = false;
    statusEl.innerHTML = `<span style="color:var(--danger)">❌ Verbinding mislukt: ${e.message}</span>`;
  }
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
async function logBestellingSheets(data) {
  const sessie = getAuthSessie();

  // Bestelregels netjes als lijst (voor Supabase én de bevestiging).
  const bestelItems = (data.items || []).map(i => ({
    code:        i.code,
    qty:         parseInt(i.qty) || 0,
    naam:        i.naam || '',
    eenheid:     i.eenheid || 'stuk',
    leverancier: i.leverancier || '',
  }));
  const totaalStuks = bestelItems.reduce((s, i) => s + i.qty, 0);
  const leverdatum  = data.leverdatum || localStorage.getItem('leverdatum') || 'zsm';

  // 1. Opslaan in Supabase — de vaste registratie van de bestelling.
  let nieuweBestelling = null;
  try {
    const { data: rij, error } = await sb.from('bestellingen').insert({
      user_id:        sessie?.id || null,
      gebruikersnaam: sessie?.gebruiker || '',
      monteur_naam:   data.naam || '',
      telefoon:       data.telefoon || '',
      afdeling:       data.afdeling || '',
      projectnummer:  data.projectnummer || '',
      projectnaam:    data.projectnaam || '',
      afleveradres:   data.locatie || '',
      leverdatum:     leverdatum,
      opmerkingen:    data.opmerkingen || '',
      artikelen:      bestelItems,
      totaal:         totaalStuks,
    }).select('id, status_token').single();
    if (error) { showToast('⚠️ Opslaan mislukt: ' + error.message); return; }
    nieuweBestelling = rij;
  } catch(e) {
    showToast('⚠️ Verbinding mislukt: ' + e.message);
    return;
  }

  // 2. Mail versturen via het Google-script (ongewijzigd; alleen voor de mail).
  _verstuurBestelMail(data, nieuweBestelling);

  // 3. Bevestigingsscherm tonen.
  const leverdatumTxt = !leverdatum || leverdatum === 'zsm'
    ? 'Zo snel mogelijk'
    : new Date(leverdatum + 'T12:00:00').toLocaleDateString('nl-NL', { day:'2-digit', month:'long', year:'numeric' });

  document.getElementById('bevestiging-samenvatting').innerHTML = `
    <div class="s-row"><span>Monteur</span><span>${data.naam || '—'}</span></div>
    <div class="s-row"><span>Project</span><span>${data.projectnaam || (data.projectnummer ? data.projectnummer : '—')}</span></div>
    <div class="s-row"><span>Leverdatum</span><span>${leverdatumTxt}</span></div>
    <div class="s-row"><span>Afleveradres</span><span>${data.locatie || '—'}</span></div>
    <div class="s-row total"><span>Totaal</span><span>${totaalStuks} stuks · ${bestelItems.length} artikel${bestelItems.length !== 1 ? 'en' : ''}</span></div>`;

  document.getElementById('bevestiging-overlay').style.display = 'flex';

  // Winkelwagen legen.
  cart = {};
  saveCart();
  updateBadge();
  renderCart();

  // Project, levering en leverdatum wissen.
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
}

// De bestelmail loopt voorlopig nog via het Google Apps Script (alleen mail).
// De ontvangers komen uit Supabase en worden meegestuurd.
async function _verstuurBestelMail(data, bestelling) {
  const url = getSheetsUrl();
  if (!url) return;

  // Vaste ontvangers uit Supabase ophalen en meesturen naar het mailscript.
  let ontvangers = '';
  try {
    const { data: inst } = await sb
      .from('instellingen')
      .select('waarde')
      .eq('sleutel', 'mail_ontvangers')
      .maybeSingle();
    ontvangers = inst?.waarde || '';
  } catch(e) {}

  // Link voor de "In behandeling nemen"-knop in de mail → bevestigingspagina
  // op de eigen site (die roept daarna de Supabase-functie aan).
  let statusUrl = '';
  if (bestelling?.id && bestelling?.status_token) {
    const u = new URL('behandeling.html', location.href);
    u.searchParams.set('id', bestelling.id);
    u.searchParams.set('token', bestelling.status_token);
    statusUrl = u.href;
  }

  // Mail formaat: artikelnr×aantal×beschrijving×eenheid×leverancier
  const mailArtikelStr = (data.items || [])
    .map(i => [
      i.code,
      i.qty,
      (i.naam        || '').replace(/[×|]/g, ''),
      (i.eenheid     || 'stuk').replace(/[×|]/g, ''),
      (i.leverancier || '').replace(/[×|]/g, ''),
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
    opmerkingen:   data.opmerkingen    || '',
    ontvanger2:    data.ontvanger2     || '',
    ontvangers:    ontvangers,
    status_url:    statusUrl,
    gebruiker:     getAuthSessie()?.gebruiker || '',
    artikelen:     mailArtikelStr,
    totaal:        (data.items || []).reduce((s, i) => s + (parseInt(i.qty)||0), 0),
    t:             Date.now(),
  });

  fetch(`${url}?${params.toString()}`).catch(() => {});
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
