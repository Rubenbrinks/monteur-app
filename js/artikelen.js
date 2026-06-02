/* ── Emondt Materiaalapp — artikelen.js ──
 * Artikelen renderen, filteren, categorie-navigatie
 */

// ── CATEGORIE FILTER ──────────────────────────────────────────
let _telData = []; // ruwe contactgegevens voor zoekfilter

function wisTelZoek() {
  document.getElementById('tel-zoek').value = '';
  document.getElementById('tel-zoek-wis').style.display = 'none';
  renderTelefoonlijst(_telData);
}

function filterTelefoonlijst() {
  const q = document.getElementById('tel-zoek').value.toLowerCase().trim();
  document.getElementById('tel-zoek-wis').style.display = q ? 'block' : 'none';
  if (!q) { renderTelefoonlijst(_telData); return; }
  const gefilterd = _telData.filter(r => {
    const tekst = [r.naam, r.functie, r.locatie, r.intern, r.telefoon, r.mobiel]
      .join(' ').toLowerCase();
    return q.split(' ').every(w => tekst.includes(w));
  });
  renderTelefoonlijst(gefilterd, q);
}

function renderTelefoonlijst(contacten, zoekterm='') {
  const lijst = document.getElementById('tel-lijst');
  if (!contacten.length) {
    lijst.innerHTML = `<p style="color:var(--muted);font-size:.9rem;text-align:center;padding:40px 20px">${zoekterm ? 'Geen resultaten voor "'+zoekterm+'"' : 'Geen contacten gevonden.'}</p>`;
    return;
  }
  const groepen = {};
  contacten.forEach(r => {
    const loc = r.locatie || Object.values(r)[0] || 'Overig';
    if (!groepen[loc]) groepen[loc] = [];
    groepen[loc].push(r);
  });
  let html = '';
  Object.entries(groepen).forEach(([locatie, leden]) => {
    html += `<div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:var(--green);padding:6px 0 8px;margin-top:12px">${locatie}</div>`;
    leden.forEach(r => {
      const naam     = r.naam      || Object.values(r)[1] || '';
      const functie  = r.functie   || Object.values(r)[2] || '';
      const intern   = r.intern    || Object.values(r)[3] || '';
      const telefoon = r.telefoon  || Object.values(r)[4] || '';
      const mobiel   = r.mobiel    || Object.values(r)[5] || '';
      if (!naam) return;
      html += `<div style="background:var(--surface);border-radius:var(--radius);padding:12px 14px;box-shadow:var(--shadow);border:1px solid var(--border);margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:${intern||telefoon||mobiel ? '10px' : '0'}">
          <div style="width:40px;height:40px;border-radius:50%;background:var(--green-dim);border:1px solid var(--green-border);display:flex;align-items:center;justify-content:center;font-size:1rem;font-weight:700;color:var(--green);flex-shrink:0">${naam.charAt(0).toUpperCase()}</div>
          <div>
            <div style="font-size:.95rem;font-weight:700;color:var(--text)">${naam}</div>
            ${functie ? `<div style="font-size:.76rem;color:var(--muted);margin-top:1px">${functie}</div>` : ''}
          </div>
        </div>
        ${intern||telefoon||mobiel ? `<div style="display:flex;flex-wrap:wrap;gap:6px">
          ${intern   ? `<a href="tel:${intern.replace(/\s/g,'')}"   style="display:inline-flex;align-items:center;gap:5px;background:var(--surface2);border:1.5px solid var(--border-strong);border-radius:8px;padding:6px 10px;text-decoration:none;color:var(--text-secondary);font-size:.76rem;font-weight:600"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.38 2 2 0 0 1 3.61 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>Intern ${intern}</a>` : ''}
          ${telefoon ? `<a href="tel:${telefoon.replace(/\s/g,'')}" style="display:inline-flex;align-items:center;gap:5px;background:var(--surface2);border:1.5px solid var(--border-strong);border-radius:8px;padding:6px 10px;text-decoration:none;color:var(--text-secondary);font-size:.76rem;font-weight:600"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.38 2 2 0 0 1 3.61 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>${telefoon}</a>` : ''}
          ${mobiel   ? `<a href="tel:${mobiel.replace(/\s/g,'')}"   style="display:inline-flex;align-items:center;gap:5px;background:var(--green-dim);border:1.5px solid var(--green-border);border-radius:8px;padding:6px 10px;text-decoration:none;color:var(--green);font-size:.76rem;font-weight:600"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>${mobiel}</a>` : ''}
        </div>` : ''}
      </div>`;
    });
  });
  lijst.innerHTML = html || '<p style="color:var(--muted);font-size:.9rem;text-align:center;padding:40px 20px">Geen contacten gevonden.</p>';
}

function laadTelefoonlijst() {
  const url = getSheetsUrl();
  const lijst = document.getElementById('tel-lijst');
  const indicator = document.getElementById('tel-laad-indicator');
  if (!url || !lijst) return;
  _telData = [];
  if (indicator) indicator.style.display = 'flex';
  lijst.innerHTML = '';

  fetch(url + '?actie=lezen&blad=Telefoonlijst&t=' + Date.now())
    .then(r => r.json())
    .then(data => {
      if (indicator) indicator.style.display = 'none';
      if (data.status !== 'ok' || !data.artikelen?.length) {
        lijst.innerHTML = '<p style="color:var(--muted);font-size:.9rem;text-align:center;padding:40px 20px">Geen contacten gevonden in tabblad "Telefoonlijst".</p>';
        return;
      }
      _telData = data.artikelen;
      renderTelefoonlijst(_telData);
    })
    .catch(() => {
      if (indicator) indicator.style.display = 'none';
      if (lijst) lijst.innerHTML = '<p style="color:var(--danger);font-size:.9rem;text-align:center;padding:40px 20px">Fout bij laden van telefoonlijst.</p>';
    });
}

function filterCategorie(cat) {
  activeCat = cat;
  activeSubcat = null; activeSubsubcat = null;
  filterPad = cat ? [{ cat }] : [];
  closeDrawer();
  updateFilterUI();
  showTab('artikelen');
  applyFilters();
}


// ── DRAWER CATEGORIEËN DYNAMISCH OPBOUWEN ─────────────────────


// ── FILTER BOTTOM SHEET ───────────────────────────────────────
let filterPad = []; // breadcrumb: [{label, niveau, cat, sub, subsub}]

function openFilterSheet() {
  filterPad = [];
  if (activeCat) filterPad.push({ cat: activeCat });
  if (activeSubcat) filterPad.push({ sub: activeSubcat });
  toonFilterNiveau();
  _sheetOpen('filter-overlay');
}

function sluitFilterSheet() {
  _sheetSluit('filter-overlay', () => applyFilters());
}

function filterSheetTerug() {
  filterPad.pop();
  toonFilterNiveau();
}

function toonFilterNiveau() {
  const inhoud  = document.getElementById('filter-sheet-inhoud');
  const titel   = document.getElementById('filter-sheet-titel');
  const terugBtn = document.getElementById('filter-terug-btn');
  inhoud.innerHTML = '';

  const niveau = filterPad.length;
  terugBtn.style.display = niveau > 0 ? 'flex' : 'none';

  if (niveau === 0) {
    // Niveau 0: hoofdcategorieën
    titel.textContent = 'Categorie';
    const cats = [...new Set(ARTIKELEN.map(a => a.cat).filter(Boolean))].sort();

    // "Alles" optie
    const alleRij = maakFilterRij('📋', 'Alle artikelen', ARTIKELEN.length, false, null,
      () => { wisFilter(); sluitFilterSheet(); });
    if (!activeCat && !activeSubcat) alleRij.classList.add('actief');
    inhoud.appendChild(alleRij);

    cats.forEach(cat => {
      const n = ARTIKELEN.filter(a => a.cat === cat).length;
      const heeftSubs = ARTIKELEN.some(a => a.cat === cat && a.subcat);
      const ico = ICONS[cat] || ICON_DEFAULTS[cat] || '📦';
      const rij = maakFilterRij(ico, cat, n, heeftSubs, cat === activeCat,
        () => {
          if (heeftSubs) {
            filterPad.push({ cat });
            activeCat = cat; activeSubcat = null; activeSubsubcat = null;
            toonFilterNiveau();
          } else {
            activeCat = cat; activeSubcat = null; activeSubsubcat = null;
            updateFilterUI(); sluitFilterSheet();
          }
        });
      inhoud.appendChild(rij);
    });

  } else if (niveau === 1) {
    // Niveau 1: subcategorieën van activeCat
    const cat = filterPad[0].cat;
    titel.textContent = cat;
    const subcats = [...new Set(ARTIKELEN.filter(a => a.cat === cat).map(a => a.subcat).filter(Boolean))].sort();

    const alleRij = maakFilterRij('📋', `Alle ${cat}`, ARTIKELEN.filter(a => a.cat === cat).length, false,
      !activeSubcat, () => { activeSubcat = null; activeSubsubcat = null; updateFilterUI(); sluitFilterSheet(); });
    inhoud.appendChild(alleRij);

    subcats.forEach(sub => {
      const n = ARTIKELEN.filter(a => a.cat === cat && a.subcat === sub).length;
      const heeftSubs = ARTIKELEN.some(a => a.cat === cat && a.subcat === sub && a.subsubcat);
      const rij = maakFilterRij('—', sub, n, heeftSubs, sub === activeSubcat,
        () => {
          activeSubcat = sub; activeSubsubcat = null;
          if (heeftSubs) { filterPad.push({ sub }); toonFilterNiveau(); }
          else { updateFilterUI(); sluitFilterSheet(); }
        });
      inhoud.appendChild(rij);
    });

  } else if (niveau === 2) {
    // Niveau 2: subsubcategorieën
    const cat = filterPad[0].cat, sub = filterPad[1].sub || activeSubcat;
    titel.textContent = sub;
    const subsubcats = [...new Set(ARTIKELEN.filter(a => a.cat === cat && a.subcat === sub).map(a => a.subsubcat).filter(Boolean))].sort();

    const alleRij = maakFilterRij('📋', `Alle ${sub}`, ARTIKELEN.filter(a => a.cat === cat && a.subcat === sub).length, false,
      !activeSubsubcat, () => { activeSubsubcat = null; updateFilterUI(); toonFilterNiveau(); });
    inhoud.appendChild(alleRij);

    subsubcats.forEach(subsub => {
      const n = ARTIKELEN.filter(a => a.cat === cat && a.subcat === sub && a.subsubcat === subsub).length;
      const rij = maakFilterRij('·', subsub, n, false, subsub === activeSubsubcat,
        () => {
          activeSubsubcat = subsub;
          updateFilterUI();
          sluitFilterSheet();
        });
      inhoud.appendChild(rij);
    });
  }
}

function maakFilterRij(ico, naam, aantal, heeftKinderen, actief, onClick) {
  const rij = document.createElement('div');
  rij.className = 'filter-rij' + (actief ? ' actief' : '');
  rij.innerHTML = `
    <div class="filter-rij-ico">${ico}</div>
    <div class="filter-rij-tekst">
      <div class="filter-rij-naam">${naam}</div>
      <div class="filter-rij-aantal">${aantal} artikel${aantal !== 1 ? 'en' : ''}</div>
    </div>
    <div class="filter-rij-arrow">${heeftKinderen ? '›' : actief ? '✓' : ''}</div>`;
  rij.onclick = (e) => { e.stopPropagation(); onClick(); };
  return rij;
}

function updateFilterUI() {
  const btn   = document.getElementById('filter-btn');
  const badge = document.getElementById('filter-btn-badge');
  const actiefLabel = document.getElementById('actief-filter-label');

  const catEl      = document.getElementById('filter-crumb-cat');
  const catNaam    = document.getElementById('filter-crumb-cat-naam');
  const subEl      = document.getElementById('filter-crumb-sub');
  const subNaam    = document.getElementById('filter-crumb-sub-naam');
  const subsubEl   = document.getElementById('filter-crumb-subsub');
  const subsubNaam = document.getElementById('filter-crumb-subsub-naam');

  const delen = [activeCat, activeSubcat, activeSubsubcat].filter(Boolean);

  if (delen.length) {
    btn.classList.add('actief');
    if (badge) { badge.textContent = delen.length; badge.style.display = 'block'; }
    actiefLabel.style.display = 'flex';

    catEl.style.display    = activeCat       ? 'inline-flex' : 'none';
    subEl.style.display    = activeSubcat    ? 'inline-flex' : 'none';
    subsubEl.style.display = activeSubsubcat ? 'inline-flex' : 'none';
    if (catNaam && activeCat)          catNaam.textContent    = activeCat;
    if (subNaam && activeSubcat)       subNaam.textContent    = activeSubcat;
    if (subsubNaam && activeSubsubcat) subsubNaam.textContent = activeSubsubcat;
  } else {
    btn.classList.remove('actief');
    if (badge) badge.style.display = 'none';
    actiefLabel.style.display = 'none';
    if (catEl) catEl.style.display = subEl.style.display = subsubEl.style.display = 'none';
  }

  document.querySelectorAll('.d-item').forEach(el => el.classList.remove('active'));
  document.getElementById('di-all')?.classList.add('active');
}

function filterCrumbCat() {
  // Klik op cat: subcat en subsubcat wissen, alleen cat blijft
  activeSubcat = null; activeSubsubcat = null;
  updateFilterUI(); applyFilters();
}

function filterCrumbSub() {
  // Klik op subcat: subsubcat wissen
  activeSubsubcat = null;
  updateFilterUI(); applyFilters();
}

function wisFilter() {
  activeCat = null; activeSubcat = null; activeSubsubcat = null;
  filterPad = [];
  updateFilterUI();
  applyFilters();
}



function wisZoek() {
  const el = document.getElementById('zoek');
  el.value = '';
  document.getElementById('zoek-wis').style.display = 'none';
  applyFilters();
  el.focus();
}

function applyFilters() {
  const q = document.getElementById('zoek').value.trim();
  const wisBtn = document.getElementById('zoek-wis');
  if (wisBtn) wisBtn.style.display = q ? 'block' : 'none';

  const trefwoorden = q.toLowerCase().split(/\s+/).filter(Boolean);
  let lijst = ARTIKELEN;
  if (activeCat)          lijst = lijst.filter(a => a.cat === activeCat);
  if (activeSubcat)       lijst = lijst.filter(a => a.subcat === activeSubcat);
  if (activeSubsubcat)    lijst = lijst.filter(a => a.subsubcat === activeSubsubcat);
  if (trefwoorden.length) {
    lijst = lijst.filter(a => {
      const t = [a.naam, a.code, a.leverancier, a.cat, a.subcat, a.subsubcat, a.trefwoorden, a.details].join(' ').toLowerCase();
      return trefwoorden.every(w => t.includes(w));
    });
  }
  const heeftFilter = !!(activeCat || activeSubcat || activeSubsubcat);
  const suggesties = (trefwoorden.length && !lijst.length) ? zoekSuggesties(trefwoorden) : [];
  renderArtikelen(lijst, trefwoorden.length > 0 || heeftFilter, suggesties);
}

function _levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const dp = Array.from({length: a.length + 1}, (_, i) =>
    Array.from({length: b.length + 1}, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[a.length][b.length];
}

function zoekSuggesties(trefwoorden) {
  const woorden = trefwoorden.filter(w => w.length >= 3);
  if (!woorden.length) return [];
  return ARTIKELEN
    .map(a => {
      const naam = (a.naam || '').toLowerCase();
      const naamWoorden = naam.split(/[\s\-\/,]+/).filter(w => w.length >= 3);
      const velden = [naam, (a.code||''), (a.trefwoorden||''), (a.details||'')].join(' ').toLowerCase();
      let score = 0;
      woorden.forEach(w => {
        if (velden.includes(w)) { score += 3; return; }
        const maxDist = w.length <= 4 ? 1 : 2;
        if (naamWoorden.some(nw => _levenshtein(w, nw) <= maxDist)) { score += 2; return; }
        if (naamWoorden.some(nw => nw.length >= 3 && nw.substring(0, w.length) === w)) score += 1;
      });
      return { a, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(x => x.a);
}

function zoekOpSuggestie(naam) {
  const el = document.getElementById('zoek');
  if (el) { el.value = naam; applyFilters(); }
}


// ── TABS ──────────────────────────────────────────────────────
function showTab(name) {
  // Beheerpaneel vereist wachtwoord
  if (name === 'beheer-panel' && !beheerUnlocked()) {
    openBeheerLogin();
    return;
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const navBtn = document.getElementById('nav-' + name);
  if (navBtn) navBtn.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (name === 'winkelwagen') renderCart();
  if (name === 'telefoonlijst') laadTelefoonlijst();
  if (name === 'favorieten') renderFavorieten();
  if (name === 'historie') renderHistorie();
  if (name === 'artikelen' && ARTIKELEN.length === 0) laadArtikelenUitSheets();
  if (name === 'artikelen' && ARTIKELEN.length > 0) renderArtikelen(ARTIKELEN);
  if (name === 'beheer-panel') {
    const urlEl = document.getElementById('admin-sheets-url');
    if (urlEl) urlEl.value = getSheetsUrl() || '';
    // Toon waarschuwing als lokale omgeving
    const isLokaal = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:';
    const warn = document.getElementById('beheer-omgeving-waarschuwing');
    if (warn) warn.style.display = isLokaal ? 'block' : 'none';
  }
}

function naarBoven() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Terug-naar-boven knop tonen/verbergen op artikelenpagina
window.addEventListener('scroll', () => {
  const btn = document.getElementById('terug-boven');
  const isArtikelen = document.getElementById('tab-artikelen').classList.contains('active');
  btn.classList.toggle('zichtbaar', isArtikelen && window.scrollY > 300);
}, { passive: true });


// ── ARTIKELEN ─────────────────────────────────────────────────
function renderArtikelen(lijst, isZoek, suggesties = []) {
  const c = document.getElementById('artikel-lijst');
  c.className = 'artikel-grid modus-' + (weergaveModus || 'a');
  c.innerHTML = '';
  if (!lijst.length) {
    if (isZoek) {
      const suggestieHtml = suggesties.length
        ? suggesties.map(a => {
            const veiligNaam = a.naam.replace(/'/g, "\\'");
            return `<div style="font-size:.9rem;color:var(--text-secondary);margin-bottom:8px;text-align:center">
              Bedoelde je misschien
              <button onclick="zoekOpSuggestie('${veiligNaam}')"
                style="background:none;border:none;padding:0;cursor:pointer;font-family:'Inter','DM Sans',sans-serif;
                font-size:.9rem;font-weight:700;color:var(--green);text-decoration:underline;text-underline-offset:2px">
                ${a.naam}</button>?
            </div>`;
          }).join('')
        : '';
      c.innerHTML = `<div style="padding:32px 20px 20px;color:var(--muted);text-align:center">
          <div style="font-size:1.6rem;margin-bottom:10px">🔍</div>
          <div style="font-size:.9rem;font-weight:600;color:var(--text);margin-bottom:16px">Geen artikelen gevonden</div>
          ${suggestieHtml}
          <div style="font-size:.9rem;color:var(--text-secondary);margin-bottom:12px${suggesties.length ? ';margin-top:16px' : ''}">
            pas je zoekopdracht aan of voeg handmatig een artikel toe:
          </div>
          <button onclick="openVrijArtikel()" class="btn btn-primary" style="display:inline-flex;padding:9px 18px;font-size:.84rem">
            ✏️ Vrij artikel toevoegen
          </button>
        </div>`;
    } else {
      c.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--muted);font-size:.86rem">Geen artikelen gevonden.</div>';
    }
    return;
  }

  // ── Gegroepeerd per hoofdcategorie bij zoekresultaten ────
  if (isZoek) {
    [...new Set(lijst.map(a => a.cat))].forEach(cat => {
      const hdr = document.createElement('div');
      hdr.className = 'cat-label';
      hdr.innerHTML = `<span>${cat}</span>`;
      c.appendChild(hdr);
      const blok = document.createElement('div');
      blok.className = 'artikel-blok';
      lijst.filter(a => a.cat === cat).forEach(a => renderArtikelCard(a, blok));
      c.appendChild(blok);
    });
    return;
  }

  // ── Harmonica per categorie ───────────────────────────────
  let ci = 0;
  [...new Set(lijst.map(a => a.cat))].forEach(cat => {
    const catItems   = lijst.filter(a => a.cat === cat);
    const hasSubcats = catItems.some(a => a.subcat);
    const catIdx     = ci++;

    const hdr = document.createElement('div');
    hdr.className = 'cat-label';
    hdr.style.cursor = 'pointer';
    hdr.style.justifyContent = 'space-between';
    hdr.innerHTML = `<span>${cat}</span><span id="catarrow-${catIdx}" style="font-size:.65rem;color:var(--green);transition:transform .2s">▶</span>`;
    c.appendChild(hdr);

    const body = document.createElement('div');
    body.id = `catbody-${catIdx}`;
    body.style.display = 'none';

    let si = 0;
    if (hasSubcats) {
      [...new Set(catItems.map(a => a.subcat).filter(Boolean))].forEach(sub => {
        const subItems   = catItems.filter(a => a.subcat === sub);
        const hasSubsubs = subItems.some(a => a.subsubcat);
        const subIdx     = si++;

        const shdr = document.createElement('div');
        shdr.className = 'subcat-label';
        shdr.style.cursor = 'pointer';
        shdr.style.justifyContent = 'space-between';
        shdr.innerHTML = `<span>${sub}</span><span id="subarrow-${catIdx}-${subIdx}" style="font-size:.6rem;color:var(--muted);transition:transform .2s">▶</span>`;
        shdr.onclick = () => accordionSub(catIdx, subIdx);
        body.appendChild(shdr);

        const subBody = document.createElement('div');
        subBody.id = `subbody-${catIdx}-${subIdx}`;
        subBody.style.display = 'none';

        let ssi = 0;
        if (hasSubsubs) {
          [...new Set(subItems.map(a => a.subsubcat).filter(Boolean))].forEach(ss => {
            const ssItems = subItems.filter(a => a.subsubcat === ss);
            const ssIdx   = ssi++;
            const sshdr = document.createElement('div');
            sshdr.className = 'subsubcat-label';
            sshdr.style.cursor = 'pointer';
            sshdr.style.justifyContent = 'space-between';
            sshdr.innerHTML = `<span>${ss}</span><span id="ssarrow-${catIdx}-${subIdx}-${ssIdx}" style="font-size:.6rem;color:var(--muted);transition:transform .2s">▶</span>`;
            sshdr.onclick = () => accordionSubsub(catIdx, subIdx, ssIdx);
            subBody.appendChild(sshdr);
            const ssBody = document.createElement('div');
            ssBody.id = `ssbody-${catIdx}-${subIdx}-${ssIdx}`;
            ssBody.style.display = 'none';
            const blok = document.createElement('div'); blok.className = 'artikel-blok';
            ssItems.forEach(a => renderArtikelCard(a, blok));
            ssBody.appendChild(blok);
            subBody.appendChild(ssBody);
          });
          subItems.filter(a => !a.subsubcat).forEach(a => {
            const blok = document.createElement('div'); blok.className = 'artikel-blok';
            renderArtikelCard(a, blok); subBody.appendChild(blok);
          });
        } else {
          const blok = document.createElement('div'); blok.className = 'artikel-blok';
          subItems.forEach(a => renderArtikelCard(a, blok));
          subBody.appendChild(blok);
        }
        body.appendChild(subBody);
      });
      catItems.filter(a => !a.subcat).forEach(a => {
        const blok = document.createElement('div'); blok.className = 'artikel-blok';
        renderArtikelCard(a, blok); body.appendChild(blok);
      });
    } else {
      const blok = document.createElement('div'); blok.className = 'artikel-blok';
      catItems.forEach(a => renderArtikelCard(a, blok));
      body.appendChild(blok);
    }
    c.appendChild(body);
  });

  const nCats = ci;
  document.querySelectorAll('.cat-label').forEach((el, i) => {
    el.onclick = () => accordionCat(i, nCats);
  });
}

let _allesOpen = false;

function _accordOpen(el, arrow) {
  el.style.display = 'block';
  el.style.overflow = 'hidden';
  el.style.transition = 'none';
  el.style.maxHeight = '0';
  // Meet hoogte na display:block zodat browser layout heeft berekend
  const h = el.scrollHeight;
  requestAnimationFrame(() => {
    el.style.transition = 'max-height .28s ease-in';
    el.style.maxHeight = h + 'px';
  });
  function onDone(e) {
    if (e.propertyName !== 'max-height') return;
    // Verwijder overflow:hidden zodat inhoud niet afgeknipt wordt
    el.style.overflow = '';
    el.style.maxHeight = 'none';
    el.style.transition = '';
    el.removeEventListener('transitionend', onDone);
  }
  el.addEventListener('transitionend', onDone);
  if (arrow) arrow.style.transform = 'rotate(90deg)';
}

function _accordSluit(el, arrow) {
  // Zet eerst expliciet de huidige hoogte (instant, geen transitie)
  el.style.transition = 'none';
  el.style.overflow = 'hidden';
  el.style.maxHeight = el.scrollHeight + 'px';
  requestAnimationFrame(() => {
    el.style.transition = 'max-height .22s ease-out';
    el.style.maxHeight = '0';
  });
  function onDone(e) {
    if (e.propertyName !== 'max-height') return;
    el.style.display = 'none';
    el.style.overflow = '';
    el.style.maxHeight = '';
    el.style.transition = '';
    el.removeEventListener('transitionend', onDone);
  }
  el.addEventListener('transitionend', onDone);
  if (arrow) arrow.style.transform = '';
}

function _accordIsOpen(el) {
  return el.style.display !== 'none' && el.style.maxHeight !== '0px';
}

function accordionCat(ci, nCats) {
  for (let i = 0; i < nCats; i++) {
    const b = document.getElementById('catbody-' + i);
    const a = document.getElementById('catarrow-' + i);
    if (!b) continue;
    const isThis  = i === ci;
    const wasOpen = _accordIsOpen(b);
    if (isThis && wasOpen)  _accordSluit(b, a);
    else if (isThis)        _accordOpen(b, a);
    else if (wasOpen)       _accordSluit(b, a);
  }
}

function accordionSub(ci, si) {
  const body  = document.getElementById(`subbody-${ci}-${si}`);
  const arrow = document.getElementById(`subarrow-${ci}-${si}`);
  if (!body) return;
  document.querySelectorAll(`[id^="subbody-${ci}-"]`).forEach(el => {
    if (el !== body && _accordIsOpen(el)) {
      const parts = el.id.split('-');
      _accordSluit(el, document.getElementById(`subarrow-${parts[1]}-${parts[2]}`));
    }
  });
  if (_accordIsOpen(body)) _accordSluit(body, arrow);
  else _accordOpen(body, arrow);
}

function accordionSubsub(ci, si, ssi) {
  const body  = document.getElementById(`ssbody-${ci}-${si}-${ssi}`);
  const arrow = document.getElementById(`ssarrow-${ci}-${si}-${ssi}`);
  if (!body) return;
  if (_accordIsOpen(body)) _accordSluit(body, arrow);
  else _accordOpen(body, arrow);
}


function renderArtikelCard(artikel, container) {
  const isFavContainer = container.id === 'fav-lijst';
  const cardId = (isFavContainer ? 'fav-card-' : 'card-') + artikel.code;
  const qtyId  = (isFavContainer ? 'fav-qty-'  : 'qty-')  + artikel.code;
  const qty    = cart[artikel.code] || 0;
  const stap   = getStap(artikel.code);
  const heeftWarning = artikel.warning && artikel.warning.includes('*');

  const el = document.createElement('div');
  el.className = 'artikel-card' + (qty > 0 ? ' selected' : '');
  el.id = cardId;

  if (weergaveModus === 'c') {
    // Modus C: compact raster — naam + minimal info, qty onderaan
    el.className += ' card-c';
    el.innerHTML = `
      <div class="card-c-body">
        <div class="artikel-naam card-c-naam">${artikel.naam}</div>
        <div class="card-c-meta">${artikel.code} · ${artikel.eenheid}${heeftWarning ? ' <span class="warn-badge">⚠</span>' : ''}</div>
      </div>
      <div class="card-c-footer" onclick="event.stopPropagation()">
        <button class="k1-btn" style="width:28px;height:28px" onclick="changeQty('${artikel.code}',-1,event)">−</button>
        <input class="qty-val" type="number" min="0" step="${stap}" id="${qtyId}"
          value="${qty || 0}" onchange="setQty('${artikel.code}',this)" onclick="this.select()"
          style="width:28px;text-align:center;border:none;background:none;font-size:.9rem;font-weight:600;color:inherit;font-family:'Inter','DM Sans',sans-serif;padding:0" />
        <button class="k1-btn" style="width:28px;height:28px" onclick="changeQty('${artikel.code}',1,event)">+</button>
      </div>`;

  } else if (weergaveModus === 'b') {
    // Modus B: rijke kaart — naam, details, productlink, favoriet, qty
    el.className += ' card-b';
    el.innerHTML = `
      <div class="card-b-header">
        <div style="flex:1;min-width:0">
          <div class="artikel-naam">${artikel.naam}</div>
          <div class="card-b-meta">${artikel.code}${artikel.leverancier ? ' · ' + artikel.leverancier : ''} · per ${artikel.eenheid}${heeftWarning ? ' <span class="warn-badge">⚠</span>' : ''}</div>
          ${artikel.details ? `<div class="card-b-details">${artikel.details.replace(/\n/g,'<br>')}</div>` : ''}
        </div>
        <button class="card-b-fav${FAVORIETEN.has(artikel.code) ? ' actief' : ''}"
          onclick="event.stopPropagation();toggleFavoriet('${artikel.code}');this.classList.toggle('actief',FAVORIETEN.has('${artikel.code}'));this.textContent=FAVORIETEN.has('${artikel.code}')?'★':'☆'"
          title="${FAVORIETEN.has(artikel.code) ? 'Verwijder uit favorieten' : 'Voeg toe aan favorieten'}">${FAVORIETEN.has(artikel.code) ? '★' : '☆'}</button>
      </div>
      ${artikel.link ? `<a href="${artikel.link}" target="_blank" class="card-b-link" onclick="event.stopPropagation()">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        Productpagina
      </a>` : ''}
      <div class="card-b-footer" onclick="event.stopPropagation()">
        <div style="display:flex;align-items:center;gap:6px">
          <button class="k1-btn" onclick="changeQty('${artikel.code}',-1,event)">−</button>
          <input class="qty-val" type="number" min="0" step="${stap}" id="${qtyId}"
            value="${qty || 0}" onchange="setQty('${artikel.code}',this)" onclick="this.select()"
            style="width:${stap >= 10 ? '44' : '28'}px;text-align:center;border:none;background:none;font-size:.9rem;font-weight:600;color:inherit;font-family:'Inter','DM Sans',sans-serif;padding:0" />
          <button class="k1-btn" onclick="changeQty('${artikel.code}',1,event)">+</button>
        </div>
      </div>`;

  } else {
    // Modus A: compacte rij — naam links, qty rechts
    el.className += ' card-a';
    el.innerHTML = `
      <div class="card-a-body">
        <div class="artikel-naam">${artikel.naam}</div>
        <div class="card-a-meta">
          <span>${artikel.code}</span>
          ${artikel.leverancier ? `<span>· ${artikel.leverancier}</span>` : ''}
          <span>· per ${artikel.eenheid}</span>
          ${heeftWarning ? `<span class="warn-badge">⚠</span>` : ''}
        </div>
      </div>
      <div class="k1-qty" onclick="event.stopPropagation()">
        <button class="k1-btn" onclick="changeQty('${artikel.code}',-1,event)">−</button>
        <input class="qty-val" type="number" min="0" step="${stap}" id="${qtyId}"
          value="${qty || 0}" onchange="setQty('${artikel.code}',this)" onclick="this.select()"
          style="width:${stap >= 10 ? '44' : '28'}px;text-align:center;border:none;background:none;font-size:.9rem;font-weight:600;color:inherit;font-family:'Inter','DM Sans',sans-serif;padding:0" />
        <button class="k1-btn" onclick="changeQty('${artikel.code}',1,event)">+</button>
      </div>`;
  }

  el.dataset.verpakking  = artikel.verpakking  || '';
  el.dataset.link        = artikel.link        || '';
  el.dataset.naam        = artikel.naam        || '';
  el.dataset.linktoitems = artikel.linktoitems || '';
  el.dataset.details     = artikel.details     || '';
  el.onclick = (e) => toonVerpakking(e, el);
  container.appendChild(el);
  autoSizeQty(document.getElementById(qtyId));
}

function toonIsolatieSuggestie(bronCode, linktoitems) {
  // Zoek de gelinkte artikelen
  const codes = linktoitems.split('/').map(c => c.trim()).filter(Boolean);
  const gekoppeld = codes.map(c => ARTIKELEN.find(a => a.code === c)).filter(Boolean);
  if (!gekoppeld.length) return;

  const overlay = document.getElementById('suggestie-overlay');
  const inhoud  = document.getElementById('suggestie-inhoud');
  const titel   = document.getElementById('suggestie-titel');

  const bronNaam = ARTIKELEN.find(a => a.code === bronCode)?.naam || bronCode;
  titel.textContent = `Wil je hier ook isolatie bij?`;
  inhoud.innerHTML = '';

  const sub = document.createElement('p');
  sub.style.cssText = 'font-size:.82rem;color:var(--muted);margin-bottom:14px;line-height:1.5';
  sub.textContent = `Je hebt "${bronNaam}" toegevoegd. Wil je hier ook het volgende bij?`;
  inhoud.appendChild(sub);

  gekoppeld.forEach(art => {
    const rij = document.createElement('div');
    rij.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)';
    rij.innerHTML = `
      <div style="flex:1;min-width:0">
        <div style="font-size:.92rem;font-weight:600;color:var(--text)">${art.naam}</div>
        <div style="font-size:.74rem;color:var(--muted);margin-top:2px">${art.code} · per ${art.eenheid}</div>
      </div>
      <button onclick="event.stopPropagation();voegGekoppeldToe('${bronCode}','${art.code}');document.getElementById('suggestie-overlay').style.display='none'"
        style="background:var(--green);color:#000;border:none;border-radius:8px;padding:8px 14px;font-family:'Inter','DM Sans',sans-serif;font-size:.82rem;font-weight:700;cursor:pointer;white-space:nowrap">
        + Toevoegen
      </button>`;
    inhoud.appendChild(rij);
  });

  _sheetOpen('suggestie-overlay');
}

function sluitSuggestie() {
  _sheetSluit('suggestie-overlay');
}

function voegGekoppeldToe(bronCode, secCode) {
  const primQty = cart[bronCode] || 1;
  const stap    = getStap(secCode);
  const qty     = rondeOpStap(primQty, stap);
  _setCart(secCode, qty);
  showToast(`✓ Toegevoegd: ${qty} ${ARTIKELEN.find(a => a.code === secCode)?.eenheid || 'st'}`);
}

function toonVerpakking(e, kaart) {
  if (e.target.closest('.qty-wrap')) return;
  e.stopPropagation();
  const bestaand = kaart.querySelector('.verpakking-popup');
  if (bestaand) { bestaand.remove(); return; }
  document.querySelectorAll('.verpakking-popup').forEach(p => p.remove());
  const code = kaart.id.replace('card-', '').replace('fav-card-', '');
  const naam       = kaart.dataset.naam       || '';
  const verpakking = kaart.dataset.verpakking || '';
  const link       = kaart.dataset.link       || '';
  const details    = kaart.dataset.details    || '';
  const isFav = FAVORIETEN.has(code);

  const popup = document.createElement('div');
  popup.className = 'verpakking-popup';
  popup.innerHTML = `
    <strong style="display:block;font-size:.88rem;margin-bottom:8px">${naam}</strong>
    ${details ? `<div style="font-size:.82rem;color:#fff;line-height:1.5;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,.12)">${details.replace(/\n/g,'<br>')}</div>` : ''}
    ${verpakking ? `<div style="font-size:.8rem;opacity:.85;margin-bottom:8px">📦 Verpakking: ${verpakking}</div>` : ''}
    ${link ? `<a href="${link}" target="_blank" class="verpakking-link" onclick="event.stopPropagation()" style="display:block;margin-bottom:8px">↗ Open productpagina</a>` : ''}
    <button onclick="event.stopPropagation();toggleFavorietVanPopup('${code}',this)" style="
      display:flex;align-items:center;gap:6px;width:100%;
      background:${isFav ? 'var(--green-dim)' : 'rgba(255,255,255,.08)'};
      color:${isFav ? 'var(--green)' : 'var(--text)'};
      border:1px solid ${isFav ? 'var(--green-border)' : 'rgba(255,255,255,.14)'};
      border-radius:7px;padding:7px 10px;font-size:.82rem;font-weight:600;
      cursor:pointer;font-family:'Inter','DM Sans',sans-serif;
    ">
      <span>${isFav ? '★' : '☆'}</span>
      <span>${isFav ? 'Verwijder uit favorieten' : 'Voeg toe aan favorieten'}</span>
    </button>`;

  kaart.appendChild(popup);
  setTimeout(() => {
    document.addEventListener('click', function sluiter() {
      popup.remove();
      document.removeEventListener('click', sluiter);
    });
  }, 0);
}

function toggleFavorietVanPopup(code, btn) {
  toggleFavoriet(code);
  const isFav = FAVORIETEN.has(code);
  btn.style.background = isFav ? 'var(--green-dim)' : 'rgba(255,255,255,.08)';
  btn.style.color = isFav ? 'var(--green)' : 'var(--text)';
  btn.style.borderColor = isFav ? 'var(--green-border)' : 'rgba(255,255,255,.14)';
  btn.querySelector('span:first-child').textContent = isFav ? '★' : '☆';
  btn.querySelector('span:last-child').textContent = isFav ? 'Verwijder uit favorieten' : 'Voeg toe aan favorieten';
}

// Lees de stapgrootte uit de eenheid-kolom
// Voorbeelden: "100 stuks" → 100, "5 meter" → 5, "stuk" → 1, "meter" → 1
function autoSizeQty(el) {
  if (!el) return;
  const len = String(el.value || '0').length;
  el.style.width = Math.max(3, len + 1) + 'ch';
}

function getStap(code) {
  const artikel = ARTIKELEN.find(a => a.code === code);
  if (!artikel) return 1;
  const match = String(artikel.eenheid || '').match(/^(\d+)/);
  return match ? parseInt(match[1]) : 1;
}

// Rond een waarde af naar het dichtstbijzijnde veelvoud van stap (naar boven)
function rondeOpStap(waarde, stap) {
  if (stap <= 1) return waarde;
  return Math.ceil(waarde / stap) * stap;
}

function changeQty(code, delta, e) {
  if (e) e.stopPropagation();
  const stap = getStap(code);
  const huidig = cart[code] || 0;
  let nieuw;
  if (delta > 0) {
    // Ophogen: als huidig al een veelvoud is, voeg stap toe; anders rond op naar boven
    nieuw = huidig === 0 ? stap : huidig + stap;
  } else {
    // Verlagen: verminder met stap, minimum 0
    nieuw = Math.max(0, huidig - stap);
  }
  _setCart(code, nieuw);
  if (delta > 0 && huidig === 0) {
    const artikel = ARTIKELEN.find(a => a.code === code);
    if (artikel && artikel.warning && artikel.warning.includes('*')) {
      showToast('⚠️ Let op, bestellen per meter!');
    } else {
      showToast('✓ Toegevoegd aan bestelling');
    }
  }
}

function setQty(code, input) {
  const stap = getStap(code);
  let waarde = Math.max(0, parseInt(input.value) || 0);
  if (stap > 1 && waarde > 0) {
    waarde = rondeOpStap(waarde, stap);
    if (input.value != waarde) {
      input.value = waarde;
      showToast(`📦 Afgerond naar ${waarde} (per ${stap})`);
    }
  }
  autoSizeQty(input);
  _setCart(code, waarde);
}

let _syncingLinked = false;

function _setCart(code, nieuw) {
  const oud = cart[code] || 0;
  if (nieuw === 0) delete cart[code]; else cart[code] = nieuw;
  saveCart();
  ['qty-' + code, 'fav-qty-' + code].forEach(id => {
    const qEl = document.getElementById(id);
    if (qEl) { qEl.value = nieuw; autoSizeQty(qEl); }
  });
  document.querySelectorAll('#card-' + code + ', #fav-card-' + code).forEach(cEl => {
    cEl.classList.toggle('selected', nieuw > 0);
    if (oud === 0 && nieuw > 0) {
      cEl.classList.remove('card-pulse');
      void cEl.offsetWidth;
      cEl.classList.add('card-pulse');
      cEl.addEventListener('animationend', () => cEl.classList.remove('card-pulse'), { once: true });
    }
  });
  updateBadge();
  updateCartSamenvatting();
  if (oud === 0 && nieuw > 0) {
    const kaart = document.getElementById('card-' + code) || document.getElementById('fav-card-' + code);
    const lti = kaart?.dataset?.linktoitems;
    if (lti && lti.trim()) toonIsolatieSuggestie(code, lti.trim());
  }
  // Sync gekoppelde artikelen die al in de cart zitten
  if (!_syncingLinked && nieuw > 0 && nieuw !== oud) {
    const art = ARTIKELEN.find(a => a.code === code);
    const lti = art?.linktoitems || '';
    if (lti.trim()) {
      _syncingLinked = true;
      lti.split('/').map(c => c.trim()).filter(Boolean).forEach(secCode => {
        if (cart[secCode]) {
          const qty = rondeOpStap(nieuw, getStap(secCode));
          _setCart(secCode, qty);
        }
      });
      _syncingLinked = false;
    }
  }
}

function updateBadge() {
  const total = Object.values(cart).reduce((s, n) => s + n, 0);
  const label = document.getElementById('cart-label');
  if (label) label.textContent = total === 1 ? '1 item' : `${total} items`;
  const countEl = document.getElementById('cart-count');
  if (countEl) countEl.textContent = total;
  const badge = document.getElementById('nav-badge');
  if (badge) {
    const wasZichtbaar = badge.style.display !== 'none';
    badge.style.display = total > 0 ? 'flex' : 'none';
    badge.textContent = total;
    if (total > 0) {
      badge.classList.remove('bounce');
      void badge.offsetWidth;
      badge.classList.add('bounce');
      badge.addEventListener('animationend', () => badge.classList.remove('bounce'), { once: true });
    }
  }
}


let customTeller = 0;
