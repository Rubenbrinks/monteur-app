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
      html += `<div style="background:var(--white);border-radius:var(--radius);padding:12px 14px;box-shadow:var(--shadow);border:1.5px solid var(--border);margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:${intern||telefoon||mobiel ? '10px' : '0'}">
          <div style="width:40px;height:40px;border-radius:50%;background:var(--navy);display:flex;align-items:center;justify-content:center;font-size:1rem;font-weight:700;color:var(--white);flex-shrink:0">${naam.charAt(0).toUpperCase()}</div>
          <div>
            <div style="font-size:.95rem;font-weight:700;color:var(--text)">${naam}</div>
            ${functie ? `<div style="font-size:.76rem;color:var(--muted);margin-top:1px">${functie}</div>` : ''}
          </div>
        </div>
        ${intern||telefoon||mobiel ? `<div style="display:flex;flex-wrap:wrap;gap:6px">
          ${intern   ? `<a href="tel:${intern.replace(/\s/g,'')}"   style="display:inline-flex;align-items:center;gap:5px;background:var(--bg);border:1.5px solid var(--border);border-radius:8px;padding:6px 10px;text-decoration:none;color:var(--navy);font-size:.76rem;font-weight:600"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.38 2 2 0 0 1 3.61 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>Intern ${intern}</a>` : ''}
          ${telefoon ? `<a href="tel:${telefoon.replace(/\s/g,'')}" style="display:inline-flex;align-items:center;gap:5px;background:var(--bg);border:1.5px solid var(--border);border-radius:8px;padding:6px 10px;text-decoration:none;color:var(--navy);font-size:.76rem;font-weight:600"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.38 2 2 0 0 1 3.61 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>${telefoon}</a>` : ''}
          ${mobiel   ? `<a href="tel:${mobiel.replace(/\s/g,'')}"   style="display:inline-flex;align-items:center;gap:5px;background:var(--green-light);border:1.5px solid var(--green);border-radius:8px;padding:6px 10px;text-decoration:none;color:var(--navy);font-size:.76rem;font-weight:600"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>${mobiel}</a>` : ''}
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
  // Herstel filterPad op basis van huidige actieve filters
  filterPad = [];
  if (activeCat) filterPad.push({ cat: activeCat });
  if (activeSubcat) filterPad.push({ sub: activeSubcat });

  toonFilterNiveau();
  document.getElementById('filter-overlay').style.display = 'flex';
}

function sluitFilterSheet() {
  document.getElementById('filter-overlay').style.display = 'none';
  applyFilters();
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
  const label = document.getElementById('filter-btn-label');
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
    label.textContent = 'Filter (' + delen.length + ')';
    actiefLabel.style.display = 'flex';

    catEl.style.display    = activeCat    ? 'inline-flex' : 'none';
    subEl.style.display    = activeSubcat ? 'inline-flex' : 'none';
    subsubEl.style.display = activeSubsubcat ? 'inline-flex' : 'none';
    if (catNaam && activeCat)       catNaam.textContent    = activeCat;
    if (subNaam && activeSubcat)    subNaam.textContent    = activeSubcat;
    if (subsubNaam && activeSubsubcat) subsubNaam.textContent = activeSubsubcat;
  } else {
    btn.classList.remove('actief');
    label.textContent = 'Filter';
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
      const t = [a.naam, a.code, a.leverancier, a.cat, a.subcat, a.subsubcat].join(' ').toLowerCase();
      return trefwoorden.every(w => t.includes(w));
    });
  }
  renderArtikelen(lijst);
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
function renderArtikelen(lijst) {
  const c = document.getElementById('artikel-lijst');
  c.className = 'artikel-grid modus-' + (weergaveModus || 'a');
  c.innerHTML = '';
  if (!lijst.length) {
    c.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--muted);font-size:.86rem">Geen artikelen gevonden.</div>';
    return;
  }

  // ── Alles-blok bovenaan ───────────────────────────────────
  const allesToggle = document.createElement('button');
  allesToggle.id = 'alles-toggle-btn';
  allesToggle.style.cssText = 'width:100%;display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--white);border:1.5px solid var(--border);border-radius:10px;cursor:pointer;font-family:"DM Sans",sans-serif;font-size:.88rem;font-weight:600;color:var(--navy);margin-bottom:2px';
  allesToggle.innerHTML = `<span>Alles uitklappen <span style="font-size:.74rem;font-weight:400;color:var(--muted)">${lijst.length}</span></span><span id="alles-arrow" style="font-size:.65rem;color:var(--muted);transition:transform .2s">▶</span>`;
  allesToggle.onclick = () => toggleAllesBlok(lijst);
  c.appendChild(allesToggle);

  const allesBody = document.createElement('div');
  allesBody.id = 'alles-body';
  allesBody.style.display = 'none';
  allesBody.style.marginBottom = '8px';
  c.appendChild(allesBody);

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
    hdr.innerHTML = `<span>${cat}</span><span id="catarrow-${catIdx}" style="font-size:.65rem;color:#3B6D11;transition:transform .2s">▶</span>`;
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
    el.onclick = () => { sluitAllesBlok(); accordionCat(i, nCats); };
  });
}

let _allesOpen = false;
let _allesLijst = [];

function toggleAllesBlok(lijst) {
  _allesOpen = !_allesOpen;
  const body  = document.getElementById('alles-body');
  const arrow = document.getElementById('alles-arrow');
  const btn   = document.getElementById('alles-toggle-btn');
  if (!body) return;

  if (_allesOpen) {
    // Sluit harmonica
    document.querySelectorAll('[id^="catbody-"]').forEach(el => { el.style.display = 'none'; });
    document.querySelectorAll('[id^="catarrow-"]').forEach(el => { el.style.transform = ''; });

    // Vul alles-body als nog leeg — of herbouw bij andere modus
    body.innerHTML = '';
    body.className = 'artikel-grid modus-' + (weergaveModus || 'a');
    // Groepeer per categorie met een kop erboven
    const cats = [...new Set((lijst || _allesLijst).map(a => a.cat))];
    cats.forEach(cat => {
      const catItems = (lijst || _allesLijst).filter(a => a.cat === cat);
      const kop = document.createElement('div');
      kop.className = 'cat-label';
      kop.style.marginBottom = '4px';
      kop.textContent = cat;
      body.appendChild(kop);

      const blok = document.createElement('div');
      blok.className = 'artikel-blok';
      catItems.forEach(a => renderArtikelCard(a, blok));
      body.appendChild(blok);
    });
    body.style.display = 'block';
    if (arrow) arrow.style.transform = 'rotate(90deg)';
    if (btn) btn.style.borderColor = 'var(--navy)';
  } else {
    sluitAllesBlok();
  }
}

function sluitAllesBlok() {
  _allesOpen = false;
  const body  = document.getElementById('alles-body');
  const arrow = document.getElementById('alles-arrow');
  const btn   = document.getElementById('alles-toggle-btn');
  if (body) body.style.display = 'none';
  if (arrow) arrow.style.transform = '';
  if (btn) btn.style.borderColor = '';
}

function accordionCat(ci, nCats) {
  for (let i = 0; i < nCats; i++) {
    const b = document.getElementById('catbody-' + i);
    const a = document.getElementById('catarrow-' + i);
    if (!b) continue;
    const isThis  = i === ci;
    const wasOpen = b.style.display !== 'none';
    b.style.display = isThis && !wasOpen ? 'block' : 'none';
    if (a) a.style.transform = isThis && !wasOpen ? 'rotate(90deg)' : '';
  }
}

function accordionSub(ci, si) {
  const body  = document.getElementById(`subbody-${ci}-${si}`);
  const arrow = document.getElementById(`subarrow-${ci}-${si}`);
  if (!body) return;
  // Sluit andere subcats in zelfde cat
  document.querySelectorAll(`[id^="subbody-${ci}-"]`).forEach(el => {
    if (el !== body && el.style.display !== 'none') {
      el.style.display = 'none';
      const parts = el.id.split('-');
      const a = document.getElementById(`subarrow-${parts[1]}-${parts[2]}`);
      if (a) a.style.transform = '';
    }
  });
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (arrow) arrow.style.transform = open ? '' : 'rotate(90deg)';
}

function accordionSubsub(ci, si, ssi) {
  const body  = document.getElementById(`ssbody-${ci}-${si}-${ssi}`);
  const arrow = document.getElementById(`ssarrow-${ci}-${si}-${ssi}`);
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (arrow) arrow.style.transform = open ? '' : 'rotate(90deg)';
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
    // Modus C1: tegel — naam bovenaan, knoppen onderaan
    el.style.flexDirection = 'column';
    el.style.alignItems = 'flex-start';
    el.style.gap = '8px';
    el.innerHTML = `
      <div style="flex:1;min-width:0">
        <div class="artikel-naam" style="font-size:.84rem;line-height:1.3">${artikel.naam}</div>
        <div style="font-size:.7rem;color:var(--muted);margin-top:2px">${artikel.code} · per ${artikel.eenheid}${heeftWarning ? ' <span style="color:#b87020;font-weight:600">⚠</span>' : ''}</div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;width:100%" onclick="event.stopPropagation()">
        <div style="display:flex;align-items:center;gap:4px">
          <button class="k1-btn k1-btn-min" style="width:26px;height:26px" onclick="changeQty('${artikel.code}',-1,event)">−</button>
          <input class="qty-val" type="number" min="0" step="${stap}" id="${qtyId}"
            value="${qty || 0}" onchange="setQty('${artikel.code}',this)" onclick="this.select()"
            style="width:26px;text-align:center;border:none;background:none;font-size:.88rem;font-weight:600;color:inherit;font-family:'DM Sans',sans-serif;padding:0" />
          <button class="k1-btn k1-btn-plus" style="width:26px;height:26px" onclick="changeQty('${artikel.code}',1,event)">+</button>
        </div>
        <button class="k1-info" style="width:26px;height:26px" onclick="event.stopPropagation();toonVerpakking(event,document.getElementById('${cardId}'))" title="Info">i</button>
      </div>`;
  } else if (weergaveModus === 'b') {
    // Modus B1: naam groot in header, knoppen in footer-balk
    el.style.flexDirection = 'column';
    el.style.padding = '0';
    el.style.overflow = 'hidden';
    el.innerHTML = `
      <div style="padding:11px 14px">
        <div class="artikel-naam" style="font-size:.92rem">${artikel.naam}</div>
        <div style="font-size:.72rem;color:var(--muted);margin-top:3px">${artikel.code}${artikel.leverancier ? ' · ' + artikel.leverancier : ''} · per ${artikel.eenheid}${heeftWarning ? ' <span style="color:#b87020;font-weight:600">⚠</span>' : ''}</div>
      </div>
      <div onclick="event.stopPropagation()" style="border-top:1px solid var(--border);padding:7px 14px;background:var(--bg);display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:6px">
          <button class="k1-btn k1-btn-min" onclick="changeQty('${artikel.code}',-1,event)">−</button>
          <input class="qty-val" type="number" min="0" step="${stap}" id="${qtyId}"
            value="${qty || 0}" onchange="setQty('${artikel.code}',this)" onclick="this.select()"
            style="width:${stap >= 10 ? '44' : '28'}px;text-align:center;border:none;background:none;font-size:.9rem;font-weight:600;color:inherit;font-family:'DM Sans',sans-serif;padding:0" />
          <button class="k1-btn k1-btn-plus" onclick="changeQty('${artikel.code}',1,event)">+</button>
        </div>
        <button class="k1-info" onclick="event.stopPropagation();toonVerpakking(event,document.getElementById('${cardId}'))" title="Info">i</button>
      </div>`;
  } else {
    // Modus A: compacte rij
    el.innerHTML = `
      <div class="artikel-body">
        <div class="artikel-naam">${artikel.naam}</div>
        <div style="display:flex;flex-wrap:wrap;gap:0 6px;margin-top:2px">
          <span style="font-size:.72rem;color:var(--muted)">${artikel.code}</span>
          ${artikel.leverancier ? `<span style="font-size:.72rem;color:var(--muted)">· ${artikel.leverancier}</span>` : ''}
          <span style="font-size:.72rem;color:var(--muted)">· per ${artikel.eenheid}</span>
          ${heeftWarning ? `<span style="font-size:.68rem;color:#b87020;font-weight:600">⚠ per meter</span>` : ''}
        </div>
      </div>
      <div class="k1-qty" onclick="event.stopPropagation()">
        <button class="k1-btn k1-btn-min" onclick="changeQty('${artikel.code}',-1,event)">−</button>
        <input class="qty-val" type="number" min="0" step="${stap}" id="${qtyId}"
          value="${qty || 0}" onchange="setQty('${artikel.code}',this)" onclick="this.select()"
          style="width:${stap >= 10 ? '44' : '28'}px;text-align:center;border:none;background:none;font-size:.9rem;font-weight:600;color:inherit;font-family:'DM Sans',sans-serif;padding:0" />
        <button class="k1-btn k1-btn-plus" onclick="changeQty('${artikel.code}',1,event)">+</button>
        <button class="k1-info" onclick="event.stopPropagation();toonVerpakking(event,document.getElementById('${cardId}'))" title="Info">i</button>
      </div>`;
  }

  el.dataset.verpakking  = artikel.verpakking  || '';
  el.dataset.link        = artikel.link        || '';
  el.dataset.naam        = artikel.naam        || '';
  el.dataset.linktoitems = artikel.linktoitems || '';
  el.onclick = null;
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
      <button onclick="event.stopPropagation();changeQty('${art.code}',1,event);document.getElementById('suggestie-overlay').style.display='none';showToast('✓ Toegevoegd')"
        style="background:var(--green);color:var(--navy);border:none;border-radius:8px;padding:8px 14px;font-family:'DM Sans',sans-serif;font-size:.82rem;font-weight:700;cursor:pointer;white-space:nowrap">
        + Toevoegen
      </button>`;
    inhoud.appendChild(rij);
  });

  overlay.style.display = 'flex';
}

function sluitSuggestie() {
  document.getElementById('suggestie-overlay').style.display = 'none';
}

function toonVerpakking(e, kaart) {
  if (e.target.closest('.qty-wrap')) return;
  e.stopPropagation();
  document.querySelectorAll('.verpakking-popup').forEach(p => p.remove());
  const code = kaart.id.replace('card-', '').replace('fav-card-', '');
  const naam = kaart.dataset.naam || '';
  const verpakking = kaart.dataset.verpakking;
  const link = kaart.dataset.link;
  const isFav = FAVORIETEN.has(code);

  const popup = document.createElement('div');
  popup.className = 'verpakking-popup';
  popup.innerHTML = `
    <strong style="display:block;font-size:.88rem;margin-bottom:8px">${naam}</strong>
    ${verpakking ? `<div style="font-size:.8rem;opacity:.85;margin-bottom:8px">📦 Verpakking: ${verpakking}</div>` : ''}
    ${link ? `<a href="${link}" target="_blank" class="verpakking-link" onclick="event.stopPropagation()" style="display:block;margin-bottom:8px">↗ Open productpagina</a>` : ''}
    <button onclick="event.stopPropagation();toggleFavorietVanPopup('${code}',this)" style="
      display:flex;align-items:center;gap:6px;width:100%;
      background:${isFav ? '#fff3cd' : 'rgba(255,255,255,.12)'};
      color:${isFav ? '#b8860b' : 'var(--white)'};
      border:1px solid ${isFav ? '#f0c040' : 'rgba(255,255,255,.2)'};
      border-radius:7px;padding:7px 10px;font-size:.82rem;font-weight:600;
      cursor:pointer;font-family:'DM Sans',sans-serif;
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
  btn.style.background = isFav ? '#fff3cd' : 'rgba(255,255,255,.12)';
  btn.style.color = isFav ? '#b8860b' : 'var(--white)';
  btn.style.borderColor = isFav ? '#f0c040' : 'rgba(255,255,255,.2)';
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
  });
  updateBadge();
  updateCartSamenvatting();
  if (oud === 0 && nieuw > 0) {
    const kaart = document.getElementById('card-' + code) || document.getElementById('fav-card-' + code);
    const lti = kaart?.dataset?.linktoitems;
    if (lti && lti.trim()) toonIsolatieSuggestie(code, lti.trim());
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
    badge.style.display = total > 0 ? 'flex' : 'none';
    badge.textContent = total;
  }
}


let customTeller = 0;
