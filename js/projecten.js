/* ── Emondt Monteur-app — projecten.js ──
 * Projecten: lijst, projectpagina (hoofdmonteur, status, logboek) en homepageblok.
 * Zolang de uitrol niet is aangezet (instelling projecten_zichtbaar) alleen voor beheerders.
 * Alle wijzigingen lopen via database-functies; hier alleen weergave en knoppen.
 */

const PROJECT_STATUSSEN = ['Open', 'Bezig', 'Wacht', 'Gereed'];
let _projectenAan = false;      // mag deze gebruiker de projecten zien?
let _projectenLijst = [];       // alle zichtbare projecten (zonder logboek)
let _projectNamen = {};         // gebruiker-id → naam
let _projectOpen = null;        // geopend project (object) of null = lijst
let _projectenLaatstGeladen = 0;

async function projectenBepaalZichtbaar() {
  if (isAdmin()) _projectenAan = true;
  else {
    try {
      const { data } = await sb.from('instellingen').select('waarde').eq('sleutel', 'projecten_zichtbaar').maybeSingle();
      _projectenAan = data?.waarde === '1';
    } catch(e) { _projectenAan = false; }
  }
  document.getElementById('drawer-projecten')?.style.setProperty('display', _projectenAan ? '' : 'none');
  const blok = document.getElementById('home-projecten-blok');
  if (blok && !_projectenAan) blok.style.display = 'none';
  return _projectenAan;
}

function _pNaam(id) { return id ? (_projectNamen[id] || 'Onbekend') : ''; }

async function projectenLaad(forceer) {
  if (!forceer && _projectenLijst.length && Date.now() - _projectenLaatstGeladen < 30000) return;
  const [pr, pf] = await Promise.all([
    sb.from('projecten').select('*').order('projectnummer', { ascending: false }).limit(2000),
    sb.from('profiles').select('id,naam,gebruikersnaam'),
  ]);
  if (pr.error) throw pr.error;
  _projectenLijst = pr.data || [];
  _projectNamen = {};
  (pf.data || []).forEach(p => { _projectNamen[p.id] = p.naam || p.gebruikersnaam || 'Onbekend'; });
  _projectenLaatstGeladen = Date.now();
}

// ── Homepage: "Mijn projecten" ───────────────────────────────
async function projectenHome() {
  const blok = document.getElementById('home-projecten-blok');
  if (!blok) return;
  if (!(await projectenBepaalZichtbaar())) { blok.style.display = 'none'; return; }
  blok.style.display = '';
  const el = document.getElementById('home-projecten');
  try {
    await projectenLaad();
    const mijn = _projectenLijst.filter(p => p.hoofdmonteur_id === getAuthSessie()?.id && !p.gearchiveerd_op && p.status !== 'Gereed');
    el.innerHTML = (mijn.length ? mijn.map(p => `
      <div class="home-rij"><button class="proj-rij" onclick="projectOpenId(${p.id})">
        <span class="home-rij-tekst"><span class="home-rij-datum">${_escH(p.projectnummer)} · ${_escH(p.status)}</span>
        <span class="home-rij-titel">${_escH(p.projectnaam)}</span></span>
        <svg class="home-pijl" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
      </button></div>`).join('') : '<div class="home-leeg">Je bent nog geen hoofdmonteur van een project.</div>')
      + '<button class="btn btn-secondary" style="margin:10px 0 0" onclick="showTab(\'projecten\')">Alle projecten</button>';
  } catch(e) {
    el.innerHTML = '<div class="home-leeg">Kon projecten niet laden.</div>';
  }
}

// ── Lijst ────────────────────────────────────────────────────
async function projectenOpen() {
  await projectenBepaalZichtbaar();
  if (!_projectenAan) { showTab('welkom'); return; }
  _projectOpen = null;
  document.getElementById('projecten-lijstweergave').style.display = '';
  document.getElementById('projecten-detail').style.display = 'none';
  document.getElementById('projecten-titel').textContent = 'Projecten';
  const el = document.getElementById('projecten-lijst');
  if (!_projectenLijst.length) el.innerHTML = '<div class="laad-indicator"><div class="laad-spinner"></div><span>Projecten laden...</span></div>';
  try { await projectenLaad(true); } catch(e) { el.innerHTML = '<div class="home-leeg">Kon projecten niet laden. Controleer je verbinding.</div>'; return; }
  projectenFilter();
}

function projectenFilter() {
  const q = (document.getElementById('projecten-zoek')?.value || '').trim().toLowerCase();
  const afd = document.getElementById('projecten-afdeling')?.value || '';
  const stat = document.getElementById('projecten-status')?.value || '';
  const mijn = document.getElementById('projecten-mijn')?.checked;
  const ik = getAuthSessie()?.id;
  const lijst = _projectenLijst.filter(p => {
    if (p.gearchiveerd_op && !(isAdmin() && stat === 'Archief')) return false;
    if (stat === 'Archief' && !p.gearchiveerd_op) return false;
    if (afd && p.afdeling !== afd) return false;
    if (stat && stat !== 'Archief' && p.status !== stat) return false;
    if (mijn && p.hoofdmonteur_id !== ik) return false;
    if (!q) return true;
    return [p.projectnummer, p.projectnaam, p.plaats, p.projectleider, _pNaam(p.hoofdmonteur_id)].join(' ').toLowerCase().includes(q);
  });
  const el = document.getElementById('projecten-lijst');
  document.getElementById('projecten-aantal').textContent = lijst.length + (lijst.length === 1 ? ' project' : ' projecten');
  if (!lijst.length) { el.innerHTML = '<div class="home-leeg">Geen projecten gevonden.</div>'; return; }
  el.innerHTML = lijst.slice(0, 300).map(p => `
    <button class="proj-kaart" onclick="projectOpenId(${p.id})">
      <span class="proj-kaart-top"><span class="proj-nr">${_escH(p.projectnummer)}</span>
        <span class="proj-status proj-status-${_escH(p.status)}">${p.gearchiveerd_op ? 'Archief' : _escH(p.status)}</span></span>
      <span class="proj-naam">${_escH(p.projectnaam)}${p.verborgen ? ' <em>(verborgen)</em>' : ''}</span>
      <span class="proj-sub">${_escH(p.afdeling)}${p.plaats ? ' · ' + _escH(p.plaats) : ''}${p.hoofdmonteur_id ? ' · Hoofdmonteur: ' + _escH(_pNaam(p.hoofdmonteur_id)) : ''}</span>
    </button>`).join('') + (lijst.length > 300 ? '<div class="home-leeg">Eerste 300 getoond; verfijn je zoekopdracht.</div>' : '');
}

// ── Projectpagina ────────────────────────────────────────────
async function projectOpenId(id) {
  if (!document.getElementById('tab-projecten').classList.contains('active')) showTab('projecten');
  if (!_projectenLijst.length) { try { await projectenLaad(true); } catch(e) {} }
  const p = _projectenLijst.find(x => x.id === id);
  if (!p) { showToast('Project niet gevonden'); return; }
  _projectOpen = p;
  document.getElementById('projecten-lijstweergave').style.display = 'none';
  document.getElementById('projecten-detail').style.display = '';
  document.getElementById('projecten-titel').textContent = p.projectnummer;
  window.scrollTo({ top: 0, behavior: 'instant' });
  projectTeken();
  projectLaadLogboek();
}

function projectenTerug() {
  if (_projectOpen) { projectenOpen(); return; }
  showTab('welkom');
}

function projectTeken() {
  const p = _projectOpen;
  if (!p) return;
  const ik = getAuthSessie()?.id;
  const ben = p.hoofdmonteur_id === ik;
  const admin = isAdmin();
  let hoofd;
  if (p.hoofdmonteur_id) {
    hoofd = `<div class="proj-hoofd"><strong>${_escH(_pNaam(p.hoofdmonteur_id))}</strong>${ben ? ' (jij)' : ''}</div>`
      + (ben ? '<button class="btn btn-secondary" onclick="projectStopHoofd()">Ik ben geen hoofdmonteur meer</button>'
             : '<button class="btn btn-secondary" onclick="projectWordHoofd(true)">Overnemen: ik ben hoofdmonteur</button>');
  } else {
    hoofd = '<div class="proj-hoofd" style="color:var(--muted)">Nog geen hoofdmonteur</div>'
      + '<button class="btn btn-primary" onclick="projectWordHoofd(false)">Ik ben hoofdmonteur</button>';
  }
  if (admin) {
    const opties = Object.entries(_projectNamen).sort((a, b) => a[1].localeCompare(b[1], 'nl'))
      .map(([id, n]) => `<option value="${id}" ${id === p.hoofdmonteur_id ? 'selected' : ''}>${_escH(n)}</option>`).join('');
    hoofd += `<div class="proj-admin"><label>Beheerder: hoofdmonteur aanwijzen</label>
      <div style="display:flex;gap:8px"><select id="proj-wijs" style="flex:1"><option value="">— geen —</option>${opties}</select>
      <button class="btn btn-secondary" style="margin:0;width:auto;padding:0 16px" onclick="projectWijsHoofd()">Opslaan</button></div></div>`;
  }
  document.getElementById('projecten-detail-kop').innerHTML = `
    <div class="form-card">
      <div class="proj-naam" style="font-size:1.05rem">${_escH(p.projectnaam)}</div>
      <div class="proj-sub" style="margin-top:6px">${_escH(p.afdeling)} · ${_escH(p.fase || '')}</div>
      <div class="proj-gegevens">
        <div><span>Projectnummer</span>${_escH(p.projectnummer)}</div>
        <div><span>Projectleider</span>${_escH(p.projectleider) || '—'}</div>
      </div>
      <div class="proj-loc">
        <div class="field"><label>Plaats</label><input type="text" id="proj-plaats" value="${_escH(p.plaats)}" maxlength="80" placeholder="Plaats" /></div>
        <div class="field"><label>Adres</label><input type="text" id="proj-adres" value="${_escH(p.adres)}" maxlength="160" placeholder="Straat en huisnummer" /></div>
        <button class="btn btn-secondary" onclick="projectSlaLocatieOp()" style="margin-bottom:0">Locatie opslaan</button>
      </div>
    </div>
    <div class="form-card"><div class="form-card-title">Hoofdmonteur</div>${hoofd}</div>
    <div class="form-card"><div class="form-card-title">Status</div>
      <div class="proj-statusknoppen">${PROJECT_STATUSSEN.map(s =>
        `<button class="proj-statusknop proj-status-${s} ${p.status === s ? 'actief' : ''}" onclick="projectZetStatus('${s}')">${s}</button>`).join('')}</div>
    </div>
    ${admin ? `<div class="form-card"><div class="form-card-title">Beheer</div>
      <button class="btn btn-secondary" style="margin-bottom:0" onclick="projectVerberg()">${p.verborgen ? 'Project weer tonen' : 'Project verbergen voor monteurs'}</button></div>` : ''}`;
}

async function _projectRpc(naam, args, ok) {
  const { error } = await sb.rpc(naam, args);
  if (error) { showToast('⚠️ ' + (error.message || 'Opslaan mislukt')); return false; }
  if (ok) showToast(ok);
  return true;
}
async function _projectVerversen() {
  const id = _projectOpen?.id;
  await projectenLaad(true);
  _projectOpen = _projectenLijst.find(x => x.id === id) || _projectOpen;
  projectTeken();
  projectLaadLogboek();
}

async function projectWordHoofd(overnemen) {
  if (overnemen && !confirm('Weet je zeker dat je de hoofdmonteur wilt overnemen?')) return;
  if (await _projectRpc('project_word_hoofdmonteur', { p_project: _projectOpen.id }, '✅ Je bent hoofdmonteur')) _projectVerversen();
}
async function projectStopHoofd() {
  if (!confirm('Weet je zeker dat je geen hoofdmonteur meer wilt zijn van dit project?')) return;
  if (await _projectRpc('project_stop_als_hoofdmonteur', { p_project: _projectOpen.id }, 'Rol neergelegd')) _projectVerversen();
}
async function projectWijsHoofd() {
  const v = document.getElementById('proj-wijs').value || null;
  if (await _projectRpc('project_wijs_hoofdmonteur', { p_project: _projectOpen.id, p_gebruiker: v }, '✅ Opgeslagen')) _projectVerversen();
}
async function projectZetStatus(s) {
  if (s === _projectOpen.status) return;
  if (await _projectRpc('project_zet_status', { p_project: _projectOpen.id, p_status: s }, '✅ Status: ' + s)) _projectVerversen();
}
async function projectSlaLocatieOp() {
  const ok = await _projectRpc('project_zet_locatie', {
    p_project: _projectOpen.id,
    p_plaats: document.getElementById('proj-plaats').value,
    p_adres: document.getElementById('proj-adres').value,
  }, '✅ Locatie opgeslagen');
  if (ok) _projectVerversen();
}
async function projectVerberg() {
  if (await _projectRpc('project_zet_verborgen', { p_project: _projectOpen.id, p_verborgen: !_projectOpen.verborgen }, '✅ Opgeslagen')) _projectVerversen();
}

// ── Logboek (opvolgingen) ────────────────────────────────────
async function projectLaadLogboek() {
  const el = document.getElementById('projecten-logboek');
  if (!el || !_projectOpen) return;
  const id = _projectOpen.id;
  el.innerHTML = '<div class="home-leeg">⏳ Laden...</div>';
  const { data, error } = await sb.from('project_opvolgingen').select('*').eq('project_id', id)
    .order('datum', { ascending: false }).order('id', { ascending: false });
  if (_projectOpen?.id !== id) return;
  if (error) { el.innerHTML = '<div class="home-leeg">Kon het logboek niet laden.</div>'; return; }
  if (!data.length) { el.innerHTML = '<div class="home-leeg">Nog geen opvolgingen.</div>'; return; }
  const perDag = {};
  data.forEach(o => { (perDag[o.datum] = perDag[o.datum] || []).push(o); });
  el.innerHTML = Object.keys(perDag).sort().reverse().map(d => `
    <div class="log-dag">${_escH(new Date(d + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</div>
    ${perDag[d].map(o => `<div class="log-item log-${_escH(o.soort)}">
      <div class="log-tekst">${_tekstH(o.tekst)}</div>
      <div class="log-wie">${_escH(o.auteur_naam)}</div></div>`).join('')}`).join('');
}

async function projectVoegOpvolgingToe() {
  const veld = document.getElementById('log-tekst');
  const datum = document.getElementById('log-datum').value || null;
  const tekst = veld.value.trim();
  if (!tekst) { showToast('Vul eerst een tekst in'); return; }
  const knop = document.getElementById('log-knop');
  knop.disabled = true;
  const ok = await _projectRpc('project_opvolging_toevoegen', { p_project: _projectOpen.id, p_tekst: tekst, p_datum: datum }, '✅ Opvolging toegevoegd');
  knop.disabled = false;
  if (ok) { veld.value = ''; projectLaadLogboek(); }
}

// ── Winkelmand: kies een project of vul zelf in ──────────────
let _bestelProjectId = null;
function bestelProjectId() { return _bestelProjectId; }

function _bestelLabel(p) { return p.projectnummer + ' — ' + p.projectnaam; }

async function projectenVulBestelKeuze() {
  const veld = document.getElementById('project-kies-veld');
  if (!veld) return;
  if (!(await projectenBepaalZichtbaar())) { veld.style.display = 'none'; return; }
  try { await projectenLaad(); } catch(e) { return; }
  veld.style.display = '';
  document.getElementById('project-datalist').innerHTML = _projectenLijst
    .filter(p => !p.gearchiveerd_op && p.status !== 'Gereed')
    .map(p => '<option value="' + _escH(_bestelLabel(p)) + '"></option>').join('');
}

function bestelProjectGekozen() {
  const waarde = document.getElementById('project-kies').value;
  const p = _projectenLijst.find(x => _bestelLabel(x) === waarde);
  if (!p) { _bestelProjectId = null; return; }
  _bestelProjectId = p.id;
  document.getElementById('projectnummer').value = p.projectnummer;
  document.getElementById('projectnaam').value = p.projectnaam;
  if (typeof saveInfo === 'function') saveInfo();
  if (typeof cartAutoExpand === 'function') cartAutoExpand();
}

// Wie de velden zelf aanpast, koppelt de bestelling niet meer aan het gekozen project.
function bestelProjectHandmatig() {
  if (!_bestelProjectId) return;
  const p = _projectenLijst.find(x => x.id === _bestelProjectId);
  if (!p || document.getElementById('projectnummer').value !== p.projectnummer || document.getElementById('projectnaam').value !== p.projectnaam) {
    _bestelProjectId = null;
    const k = document.getElementById('project-kies'); if (k) k.value = '';
  }
}

function bestelProjectWis() {
  _bestelProjectId = null;
  const k = document.getElementById('project-kies'); if (k) k.value = '';
}
