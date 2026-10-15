/* ── Emondt Monteur-app — verslagen.js ──
 * Vertrekverslag bij een project: afvinklijst, metingen, materiaal, foto's en tekst.
 * Alles wordt bewaard bij het project (tabel project_verslagen). De PDF maakt de
 * Supabase-functie verslag-pdf; die mag alleen de maker en een beheerder aanroepen.
 */

const VERSLAG_FOTO_MAX = 12;
const VERSLAG_BUCKET = 'projectfotos';
const VERSLAG_STANDAARD_LIJST = ['Koelleidingen gelegd', 'Alle leidingverbindingen gesoldeerd', 'Leidingen geïsoleerd'];
let _verslagen = [];        // verslagen van het geopende project
let _verslag = null;        // formulierstatus: { id, datum, checklist, metingen, materiaal, opmerking, fotos, auteur_id }

// ── Lijst op de projectpagina ────────────────────────────────
async function verslagenLaad() {
  const el = document.getElementById('projecten-verslagen');
  if (!el || !_projectOpen) return;
  const id = _projectOpen.id;
  const { data, error } = await sb.from('project_verslagen').select('id,datum,auteur_id,auteur_naam,inhoud')
    .eq('project_id', id).order('datum', { ascending: false }).order('id', { ascending: false });
  if (_projectOpen?.id !== id) return;
  _verslagen = error ? [] : (data || []);
  const ik = getAuthSessie()?.id;
  el.innerHTML = `
    <div class="form-card">
      <div class="form-card-title">Vertrekverslag</div>
      <button class="btn btn-primary" onclick="verslagNieuw()" style="margin-bottom:${_verslagen.length ? 12 : 0}px">Nieuw verslag maken</button>
      ${error ? '<div class="home-leeg">Kon verslagen niet laden.</div>' : _verslagen.map(v => {
        const mag = v.auteur_id === ik || isAdmin();
        const n = (v.inhoud?.fotos || []).length;
        return `<div class="verslag-rij">
          <button class="verslag-open" onclick="verslagOpen(${v.id})">
            <strong>${_escH(_datumVerslag(v.datum))}</strong>
            <span>${_escH(v.auteur_naam)}${n ? ' · ' + n + ' foto' + (n === 1 ? '' : "'s") : ''}</span>
          </button>
          ${mag ? `<button class="verslag-pdf" onclick="verslagPdf(${v.id}, this)">PDF</button>` : ''}
        </div>`;
      }).join('')}
    </div>`;
}

function _datumVerslag(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Afvinklijst uit de instellingen ──────────────────────────
async function _verslagChecklistTekst() {
  try {
    const { data } = await sb.from('instellingen').select('waarde').eq('sleutel', 'verslag_checklist').maybeSingle();
    const lijst = JSON.parse(data?.waarde || '[]');
    if (Array.isArray(lijst) && lijst.length) return lijst.map(String);
  } catch(e) {}
  return VERSLAG_STANDAARD_LIJST;
}

async function verslagNieuw() {
  const items = await _verslagChecklistTekst();
  _verslag = {
    id: null, datum: vandaagNL(), auteur_id: getAuthSessie()?.id,
    checklist: items.map(t => ({ tekst: t, staat: '' })),
    metingen: { leidinglengte: '', druktest: '', achtergelaten: '' },
    materiaal: [], opmerking: '', fotos: [],
  };
  verslagToonFormulier();
}

async function verslagOpen(id) {
  const v = _verslagen.find(x => x.id === id);
  if (!v) return;
  const i = v.inhoud || {};
  // Nieuwe items uit de standaardlijst die nog niet in dit verslag staan, komen leeg onderaan.
  const huidig = Array.isArray(i.checklist) ? i.checklist.map(c => ({ tekst: c.tekst, staat: c.staat || '' })) : [];
  const bekend = new Set(huidig.map(c => c.tekst));
  (await _verslagChecklistTekst()).forEach(t => { if (!bekend.has(t)) huidig.push({ tekst: t, staat: '' }); });
  _verslag = {
    id: v.id, datum: v.datum, auteur_id: v.auteur_id, checklist: huidig,
    metingen: { leidinglengte: '', druktest: '', achtergelaten: '', ...(i.metingen || {}) },
    materiaal: Array.isArray(i.materiaal) ? i.materiaal.map(m => ({ ...m })) : [],
    opmerking: i.opmerking || '',
    fotos: (i.fotos || []).map(f => ({ pad: f.pad, titel: f.titel || '', url: null })),
  };
  verslagToonFormulier();
  // Bestaande foto's: tijdelijke links ophalen
  if (_verslag.fotos.length) {
    const { data } = await sb.storage.from(VERSLAG_BUCKET).createSignedUrls(_verslag.fotos.map(f => f.pad), 3600);
    const perPad = new Map((data || []).map(d => [d.path, d.signedUrl]));
    _verslag.fotos.forEach(f => { f.url = perPad.get(f.pad) || null; });
    verslagTekenFotos();
  }
}

function verslagToonFormulier() {
  document.getElementById('projecten-detail').style.display = 'none';
  document.getElementById('projecten-verslag').style.display = '';
  document.getElementById('projecten-titel').textContent = 'Verslag';
  window.scrollTo({ top: 0, behavior: 'instant' });
  const mag = !_verslag.id || _verslag.auteur_id === getAuthSessie()?.id || isAdmin();
  const dis = mag ? '' : 'disabled';
  const v = _verslag;
  document.getElementById('projecten-verslag').innerHTML = `
    <div class="form-card">
      <div class="proj-naam">${_escH(_projectOpen.projectnaam)}</div>
      <div class="proj-sub">${_escH(_projectOpen.projectnummer)}</div>
      ${mag ? '' : '<div class="home-leeg">Je kunt dit verslag bekijken; alleen de maker of een beheerder kan het wijzigen.</div>'}
      <div class="field" style="margin-top:12px"><label>Datum</label><input type="date" id="vs-datum" value="${_escH(v.datum)}" ${dis} /></div>
    </div>

    <div class="form-card"><div class="form-card-title">Uitgevoerd en nog te doen</div>
      ${v.checklist.map((c, i) => `
        <div class="vs-check">
          <div class="vs-check-tekst">${_escH(c.tekst)}</div>
          <div class="vs-keuze">
            <button class="${c.staat === 'uitgevoerd' ? 'actief ok' : ''}" ${dis} onclick="verslagStaat(${i}, 'uitgevoerd')">Uitgevoerd</button>
            <button class="${c.staat === 'nog' ? 'actief nog' : ''}" ${dis} onclick="verslagStaat(${i}, 'nog')">Nog te doen</button>
          </div>
        </div>`).join('')}
    </div>

    <div class="form-card"><div class="form-card-title">Metingen</div>
      <div class="field"><label>Leidinglengte (meter)</label><input type="text" inputmode="decimal" id="vs-lengte" value="${_escH(v.metingen.leidinglengte)}" ${dis} /></div>
      <div class="field-2">
        <div class="field"><label>Afgeperst op (bar)</label><input type="text" inputmode="decimal" id="vs-druk" value="${_escH(v.metingen.druktest)}" ${dis} /></div>
        <div class="field"><label>Achtergelaten (bar)</label><input type="text" inputmode="decimal" id="vs-achter" value="${_escH(v.metingen.achtergelaten)}" ${dis} /></div>
      </div>
    </div>

    <div class="form-card"><div class="form-card-title">Benodigd materiaal</div>
      <div id="vs-materiaal"></div>
      ${mag ? '<button class="btn btn-secondary" style="margin:8px 0 0" onclick="verslagMateriaalToevoegen()">+ Regel toevoegen</button>' : ''}
      <datalist id="vs-artikelen">${(typeof ARTIKELEN !== 'undefined' ? ARTIKELEN : []).slice(0, 4000).map(a => `<option value="${_escH(a.naam)}"></option>`).join('')}</datalist>
    </div>

    <div class="form-card"><div class="form-card-title">Opmerkingen</div>
      <div class="field" style="margin-bottom:0"><textarea id="vs-opmerking" rows="4" maxlength="3000" placeholder="Wat moet de volgende monteur of de klant weten?" ${dis}>${_escH(v.opmerking)}</textarea></div>
    </div>

    <div class="form-card"><div class="form-card-title">Foto's <span id="vs-foto-teller" style="color:var(--muted);font-weight:400"></span></div>
      <div id="vs-fotos"></div>
      ${mag ? `<label id="vs-foto-knop" class="btn btn-secondary" style="margin:8px 0 0;display:block;text-align:center;cursor:pointer">Foto toevoegen
        <input type="file" accept="image/*" multiple style="display:none" onchange="verslagFotosToegevoegd(this)" /></label>` : ''}
    </div>

    ${mag ? `<button id="vs-opslaan" class="btn btn-primary" onclick="verslagOpslaan()">Verslag opslaan</button>` : ''}
    ${v.id && mag ? `<button class="btn btn-secondary" onclick="verslagPdf(${v.id}, this)">PDF maken</button>` : ''}
    ${v.id && mag ? `<button class="btn btn-secondary" style="color:var(--danger)" onclick="verslagVerwijderen()">Verslag verwijderen</button>` : ''}
    <button class="btn btn-secondary" onclick="verslagSluit()">${mag ? 'Annuleren' : 'Terug'}</button>`;
  verslagTekenMateriaal();
  verslagTekenFotos();
}

function verslagSluit() {
  _verslag = null;
  document.getElementById('projecten-verslag').style.display = 'none';
  document.getElementById('projecten-detail').style.display = '';
  document.getElementById('projecten-titel').textContent = _projectOpen.projectnummer;
  verslagenLaad();
  projectLaadLogboek();
}

function verslagStaat(i, staat) {
  const c = _verslag.checklist[i];
  c.staat = c.staat === staat ? '' : staat;     // nogmaals tikken = leegmaken
  verslagLeesVelden();
  const knoppen = document.querySelectorAll('.vs-check')[i].querySelectorAll('.vs-keuze button');
  knoppen[0].className = c.staat === 'uitgevoerd' ? 'actief ok' : '';
  knoppen[1].className = c.staat === 'nog' ? 'actief nog' : '';
}

// Velden uit het formulier terug in de status zetten (voor het tekenen en opslaan).
function verslagLeesVelden() {
  const g = (id) => document.getElementById(id);
  if (!g('vs-datum')) return;
  _verslag.datum = g('vs-datum').value || _verslag.datum;
  _verslag.metingen = { leidinglengte: g('vs-lengte').value.trim(), druktest: g('vs-druk').value.trim(), achtergelaten: g('vs-achter').value.trim() };
  _verslag.opmerking = g('vs-opmerking').value.trim();
}

// ── Materiaal ────────────────────────────────────────────────
function verslagTekenMateriaal() {
  const el = document.getElementById('vs-materiaal');
  if (!el) return;
  const mag = !_verslag.id || _verslag.auteur_id === getAuthSessie()?.id || isAdmin();
  el.innerHTML = _verslag.materiaal.length ? _verslag.materiaal.map((m, i) => `
    <div class="vs-mat">
      <input type="text" list="vs-artikelen" placeholder="Artikel of omschrijving" value="${_escH(m.naam)}" ${mag ? '' : 'disabled'}
        oninput="_verslag.materiaal[${i}].naam = this.value; verslagEenheid(${i}, this.value)" />
      <input type="text" inputmode="decimal" placeholder="Aantal" value="${_escH(m.aantal)}" ${mag ? '' : 'disabled'}
        oninput="_verslag.materiaal[${i}].aantal = this.value" />
      ${mag ? `<button class="del-btn" onclick="verslagMateriaalWis(${i})" aria-label="Regel verwijderen"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>` : ''}
    </div>`).join('') : '<div class="home-leeg">Nog geen regels.</div>';
}
function verslagMateriaalToevoegen() { verslagLeesVelden(); _verslag.materiaal.push({ naam: '', aantal: '', eenheid: '' }); verslagTekenMateriaal(); }
function verslagMateriaalWis(i) { verslagLeesVelden(); _verslag.materiaal.splice(i, 1); verslagTekenMateriaal(); }
// Kiest de monteur een artikel uit de catalogus, dan hoort de eenheid erbij.
function verslagEenheid(i, naam) {
  const a = (typeof ARTIKELEN !== 'undefined' ? ARTIKELEN : []).find(x => x.naam === naam);
  _verslag.materiaal[i].eenheid = a ? a.eenheid : '';
}

// ── Foto's ───────────────────────────────────────────────────
function verslagTekenFotos() {
  const el = document.getElementById('vs-fotos');
  if (!el || !_verslag) return;
  const mag = !_verslag.id || _verslag.auteur_id === getAuthSessie()?.id || isAdmin();
  el.innerHTML = _verslag.fotos.length ? _verslag.fotos.map((f, i) => `
    <div class="foto-rij">
      ${f.url ? `<img src="${f.url}" alt="" class="foto-mini" />` : '<div class="foto-mini" style="background:var(--surface2)"></div>'}
      <div class="foto-rij-info"><input type="text" maxlength="60" placeholder="Titel (bijv. 'Doorvoer parkeergarage')" value="${_escH(f.titel)}" ${mag ? '' : 'disabled'}
        oninput="_verslag.fotos[${i}].titel = this.value" /></div>
      ${mag ? `<button class="del-btn" onclick="verslagFotoWis(${i})" aria-label="Foto verwijderen"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>` : ''}
    </div>`).join('') : '<div class="home-leeg">Nog geen foto\'s.</div>';
  const t = document.getElementById('vs-foto-teller');
  if (t) t.textContent = _verslag.fotos.length ? `(${_verslag.fotos.length})` : '';
  const knop = document.getElementById('vs-foto-knop');
  if (knop) knop.style.display = _verslag.fotos.length >= VERSLAG_FOTO_MAX ? 'none' : '';
}

async function verslagFotosToegevoegd(input) {
  const bestanden = [...(input.files || [])];
  input.value = '';
  let afgewezen = 0;
  for (const b of bestanden) {
    if (_verslag.fotos.length >= VERSLAG_FOTO_MAX) { afgewezen++; continue; }
    try {
      const blob = await _verkleinFoto(b);            // uit fotos.js
      _verslag.fotos.push({ blob, url: URL.createObjectURL(blob), titel: '' });
      verslagTekenFotos();
    } catch(e) { showToast('⚠️ ' + (e.message || 'Foto toevoegen mislukt')); }
  }
  if (afgewezen) showToast(`📷 Maximaal ${VERSLAG_FOTO_MAX} foto's per verslag.`);
}
function verslagFotoWis(i) {
  const f = _verslag.fotos[i];
  if (f?.blob && f.url) URL.revokeObjectURL(f.url);
  _verslag.fotos.splice(i, 1);
  verslagTekenFotos();
}

// ── Opslaan, verwijderen, PDF ────────────────────────────────
async function verslagOpslaan() {
  verslagLeesVelden();
  const knop = document.getElementById('vs-opslaan');
  knop.disabled = true;
  const gebruiker = getAuthSessie()?.id;
  const nieuweUploads = [];
  try {
    const fotos = [];
    const nieuw = _verslag.fotos.filter(f => f.blob).length;
    let n = 0;
    for (const f of _verslag.fotos) {
      if (f.blob) {
        showToast(`📷 Foto ${++n} van ${nieuw} uploaden...`);
        const pad = `${_projectOpen.id}/${gebruiker}/${crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + n}.jpg`;
        const { error } = await sb.storage.from(VERSLAG_BUCKET).upload(pad, f.blob, { contentType: 'image/jpeg' });
        if (error) throw new Error(error.message);
        nieuweUploads.push(pad);
        fotos.push({ pad, titel: f.titel.trim().slice(0, 60) });
      } else fotos.push({ pad: f.pad, titel: f.titel.trim().slice(0, 60) });
    }
    const inhoud = {
      checklist: _verslag.checklist.filter(c => c.staat), metingen: _verslag.metingen,
      materiaal: _verslag.materiaal.filter(m => m.naam.trim()).map(m => ({ naam: m.naam.trim(), aantal: String(m.aantal || '').trim(), eenheid: m.eenheid || '' })),
      opmerking: _verslag.opmerking, fotos,
    };
    const { error } = await sb.rpc('verslag_opslaan', { p_id: _verslag.id, p_project: _projectOpen.id, p_datum: _verslag.datum, p_inhoud: inhoud });
    if (error) throw new Error(error.message);
    // Weggehaalde foto's ook uit de opslag halen (lukt alleen voor eigen foto's of als beheerder).
    const oud = (_verslagen.find(x => x.id === _verslag.id)?.inhoud?.fotos || []).map(f => f.pad);
    const weg = oud.filter(p => !fotos.some(f => f.pad === p));
    if (weg.length) { try { await sb.storage.from(VERSLAG_BUCKET).remove(weg); } catch(e) {} }
    showToast('✅ Verslag opgeslagen');
    verslagSluit();
  } catch(e) {
    if (nieuweUploads.length) { try { await sb.storage.from(VERSLAG_BUCKET).remove(nieuweUploads); } catch(x) {} }
    showToast('⚠️ Opslaan mislukt: ' + e.message);
  } finally {
    knop.disabled = false;
  }
}

async function verslagVerwijderen() {
  if (!confirm('Dit verslag en de bijbehorende foto\'s verwijderen? Dit kan niet ongedaan worden gemaakt.')) return;
  const { data, error } = await sb.rpc('verslag_verwijderen', { p_id: _verslag.id });
  if (error) { showToast('⚠️ ' + error.message); return; }
  if (Array.isArray(data) && data.length) { try { await sb.storage.from(VERSLAG_BUCKET).remove(data); } catch(e) {} }
  showToast('Verslag verwijderd');
  verslagSluit();
}

async function verslagPdf(id, knop) {
  const venster = window.open('', '_blank');           // meteen openen, anders blokkeren telefoons het
  const tekst = knop?.textContent;
  if (knop) { knop.disabled = true; knop.textContent = 'Bezig...'; }
  try {
    const { data: { session } } = await sb.auth.getSession();
    const antw = await fetch(`${SUPABASE_URL}/functions/v1/verslag-pdf?id=${id}`, {
      method: 'POST', headers: { Authorization: 'Bearer ' + session.access_token, apikey: SUPABASE_ANON_KEY },
    });
    if (!antw.ok) {
      let melding = 'PDF maken mislukt';
      try { melding = (await antw.json()).fout || melding; } catch(e) {}
      throw new Error(melding);
    }
    const url = URL.createObjectURL(await antw.blob());
    if (venster) venster.location.href = url;
    else {
      const a = document.createElement('a');
      a.href = url; a.download = `Verslag-${_projectOpen?.projectnummer || id}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
    }
  } catch(e) {
    if (venster) venster.close();
    showToast('⚠️ ' + e.message);
  } finally {
    if (knop) { knop.disabled = false; knop.textContent = tekst; }
  }
}
