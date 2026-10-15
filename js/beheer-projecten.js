/* ── Emondt Monteur-app — beheer-projecten.js ──
 * Beheer → Algemeen → Projecten: wekelijkse CSV-import uit Syntess Atrium en de
 * schakelaar voor de uitrol. Het bestand wordt in de browser gelezen; alleen
 * projectnummer, naam, projectleider, fase en plaats gaan naar de database.
 * Klant, calculator, bedragen en uren worden nooit verstuurd of bewaard.
 */

const PROJ_AFDELINGEN = ['Multiclima', 'Koeltechniek', 'Kantoor'];
const PROJ_FASEN = [/werkvoorbereiding/i, /opdracht/i];
let _projImport = null;     // { afdeling, items }

// Gewone CSV-lezer (komma, aanhalingstekens met "" als escape, ook meerregelige velden).
function _projLeesCsv(tekst) {
  const rijen = []; let rij = [], veld = '', inQ = false;
  for (let i = 0; i < tekst.length; i++) {
    const c = tekst[i];
    if (inQ) {
      if (c === '"') { if (tekst[i + 1] === '"') { veld += '"'; i++; } else inQ = false; }
      else veld += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { rij.push(veld); veld = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && tekst[i + 1] === '\n') i++;
      rij.push(veld); veld = '';
      if (rij.some(x => x !== '')) rijen.push(rij);
      rij = [];
    } else veld += c;
  }
  if (veld !== '' || rij.length) { rij.push(veld); rijen.push(rij); }
  return rijen;
}

// Plaats uit "… te Enschede (fase 2)" → "Enschede". Geen " te " in de naam: leeg.
function _projPlaats(naam) {
  const i = naam.toLowerCase().lastIndexOf(' te ');
  if (i < 0) return '';
  let p = naam.slice(i + 4).replace(/\(.*?\)/g, '').replace(/[\s,.;:-]+$/, '').trim();
  return p.length > 0 && p.length <= 40 && !/\d/.test(p) ? p : '';
}

// Leest de (dubbel verpakte) Syntess-export. Geeft { afdelingen, items, overgeslagenFase }.
function projLeesSyntess(bytes) {
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  const tekst = (utf8.includes('�') ? new TextDecoder('windows-1252').decode(bytes) : utf8).replace(/^﻿/, '');
  let rijen = _projLeesCsv(tekst).map(r => r.length === 1 ? (_projLeesCsv(r[0])[0] || []) : r);
  const schoon = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const afdelingen = new Set(); const items = []; let overFase = 0;
  let fase = null, afdeling = null;
  for (const r of rijen) {
    const eerste = schoon(r[0]);
    if (/Projecten$/.test(eerste)) {
      afdeling = (eerste.match(/Emondt\s+(\S+)/) || [])[1] || afdeling;
      fase = r.find(x => /^\d+\.\s/.test(x)) || fase;
      continue;
    }
    if (eerste === '©') continue;
    if (r.length !== 12 || !/^[0-9A-Z][0-9A-Z-]*$/i.test(eerste)) continue;   // totalen e.d.
    if (!PROJ_FASEN.some(re => re.test(fase || ''))) { overFase++; continue; }
    if (afdeling) afdelingen.add(afdeling);
    const naam = schoon(r[2]);
    items.push({
      projectnummer: eerste, projectnaam: naam, projectleider: schoon(r[3]),
      fase: schoon(String(fase).replace(/^\d+\.\s*/, '')), plaats: _projPlaats(naam),
    });
  }
  return { afdelingen: [...afdelingen], items, overFase };
}

function _projStatus(html) { document.getElementById('proj-import-status').innerHTML = html; }

async function projVerwerkBestand(bestand) {
  _projImport = null;
  document.getElementById('proj-import-voorbeeld').style.display = 'none';
  if (!bestand) return;
  try {
    _projStatus('⏳ Bestand lezen...');
    const uit = projLeesSyntess(new Uint8Array(await bestand.arrayBuffer()));
    if (!uit.items.length) { _projStatus('<span style="color:var(--danger)">❌ Geen projecten gevonden in dit bestand. Is het een export uit Syntess Atrium?</span>'); return; }
    if (uit.afdelingen.length !== 1 || !PROJ_AFDELINGEN.includes(uit.afdelingen[0])) {
      _projStatus('<span style="color:var(--danger)">❌ Afdeling niet herkend (' + _escA(uit.afdelingen.join(', ') || 'geen') + '). Importeer per afdeling één bestand.</span>');
      return;
    }
    _projImport = { afdeling: uit.afdelingen[0], items: uit.items };
    _projStatus('⏳ Vergelijken met de database...');
    await projToonVoorbeeld();
  } catch(e) {
    _projStatus('<span style="color:var(--danger)">❌ ' + _escA(e.message || 'Lezen mislukt') + '</span>');
  }
}

function _projLijstHtml(titel, lijst, fn, max) {
  if (!lijst?.length) return '';
  const rijen = lijst.slice(0, max || 30).map(fn).join('');
  return `<details class="proj-imp-groep"><summary>${titel} (${lijst.length})</summary>${rijen}${lijst.length > (max || 30) ? '<div class="proj-imp-rij">… en ' + (lijst.length - (max || 30)) + ' meer</div>' : ''}</details>`;
}

async function projToonVoorbeeld() {
  const { data, error } = await sb.rpc('projecten_import', { p_afdeling: _projImport.afdeling, p_items: _projImport.items, p_toepassen: false });
  if (error) { _projStatus('<span style="color:var(--danger)">❌ ' + _escA(error.message) + '</span>'); return; }
  const r = data;
  _projStatus('');
  const regel = (n, t) => `<div class="proj-imp-tel"><strong>${n}</strong> ${t}</div>`;
  const naamNr = (p) => `<div class="proj-imp-rij">${_escA(p.projectnummer)} — ${_escA(p.projectnaam)}</div>`;
  document.getElementById('proj-import-voorbeeld').innerHTML = `
    <div class="proj-imp-kop">Voorbeeld voor ${_escA(r.afdeling)} — ${_projImport.items.length} projecten in het bestand</div>
    ${regel(r.nieuw, 'nieuw')}${regel(r.gewijzigd, 'gewijzigd (naam, projectleider of fase)')}${regel(r.hersteld, 'terug uit het archief')}
    ${regel(r.gearchiveerd, 'naar het archief (niet meer in het bestand)')}${regel(r.ongewijzigd, 'ongewijzigd')}
    ${r.conflicten ? regel(r.conflicten, 'overgeslagen: projectnummer hoort bij een andere afdeling') : ''}
    ${r.waarschuwing ? `<div class="proj-imp-waarschuwing">⚠️ ${_escA(r.waarschuwing)}
       <label><input type="checkbox" id="proj-forceer" /> Ja, het bestand klopt; toch doorzetten</label></div>` : ''}
    ${_projLijstHtml('Nieuw', r.lijst_nieuw, naamNr)}
    ${_projLijstHtml('Gewijzigd', r.lijst_gewijzigd, p => `<div class="proj-imp-rij">${_escA(p.projectnummer)} — ${_escA(p.projectnaam)}</div>`)}
    ${_projLijstHtml('Naar het archief', r.lijst_gearchiveerd, naamNr)}
    ${_projLijstHtml('Overgeslagen (andere afdeling)', r.lijst_conflicten, p => `<div class="proj-imp-rij">${_escA(p.projectnummer)} — ${_escA(p.projectnaam)} (staat bij ${_escA(p.andere_afdeling)})</div>`)}
    <div style="display:flex;gap:8px;margin-top:12px">
      <button id="proj-toepassen-btn" class="btn btn-primary" style="margin-bottom:0;flex:1" onclick="projToepassen()">Importeren</button>
      <button class="btn btn-secondary" style="margin-bottom:0" onclick="projAnnuleer()">Annuleren</button>
    </div>`;
  document.getElementById('proj-import-voorbeeld').style.display = '';
}

function projAnnuleer() {
  _projImport = null;
  document.getElementById('proj-import-voorbeeld').style.display = 'none';
  document.getElementById('proj-csv-input').value = '';
  _projStatus('');
}

async function projToepassen() {
  if (!_projImport) return;
  const knop = document.getElementById('proj-toepassen-btn');
  knop.disabled = true;
  const { data, error } = await sb.rpc('projecten_import', {
    p_afdeling: _projImport.afdeling, p_items: _projImport.items, p_toepassen: true,
    p_forceer: !!document.getElementById('proj-forceer')?.checked,
  });
  knop.disabled = false;
  if (error) { showToast('⚠️ ' + error.message); return; }
  projAnnuleer();
  _projStatus(`<span style="color:green">✅ ${_escA(data.afdeling)}: ${data.nieuw} nieuw, ${data.gewijzigd} gewijzigd, ${data.hersteld} hersteld, ${data.gearchiveerd} gearchiveerd.</span>`);
  if (typeof _projectenLijst !== 'undefined') { _projectenLijst = []; _projectenLaatstGeladen = 0; }
  projLaadBeheer();
}

// ── Overzicht en uitrol-schakelaar ───────────────────────────
async function projLaadBeheer() {
  const el = document.getElementById('proj-beheer-overzicht');
  const sch = document.getElementById('proj-uitrol');
  if (!el) return;
  const [pr, inst, imp] = await Promise.all([
    sb.from('projecten').select('afdeling,gearchiveerd_op,verborgen').limit(5000),
    sb.from('instellingen').select('waarde').eq('sleutel', 'projecten_zichtbaar').maybeSingle(),
    sb.from('project_imports').select('*').order('aangemaakt_op', { ascending: false }).limit(5),
  ]);
  if (sch) sch.checked = inst.data?.waarde === '1';
  const per = {};
  (pr.data || []).forEach(p => {
    const a = per[p.afdeling] = per[p.afdeling] || { actief: 0, archief: 0, verborgen: 0 };
    if (p.gearchiveerd_op) a.archief++; else { a.actief++; if (p.verborgen) a.verborgen++; }
  });
  const regels = Object.entries(per).map(([a, x]) => `<div class="proj-imp-tel"><strong>${_escA(a)}</strong> ${x.actief} lopend${x.verborgen ? ' (' + x.verborgen + ' verborgen)' : ''}, ${x.archief} in het archief</div>`).join('');
  const laatste = (imp.data || []).map(i => `<div class="proj-imp-rij">${new Date(i.aangemaakt_op).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${_escA(i.afdeling)} · ${_escA(i.door_naam)}: +${i.nieuw}, ~${i.gewijzigd}, archief ${i.gearchiveerd}</div>`).join('');
  el.innerHTML = (regels || '<div class="home-leeg">Nog geen projecten geïmporteerd.</div>') + (laatste ? '<div class="proj-imp-kop" style="margin-top:12px">Laatste imports</div>' + laatste : '');
}

async function projZetUitrol(aan) {
  const { error } = await sb.from('instellingen').upsert({ sleutel: 'projecten_zichtbaar', waarde: aan ? '1' : '0' });
  if (error) { showToast('⚠️ ' + error.message); projLaadBeheer(); return; }
  showToast(aan ? '✅ Projecten zijn nu zichtbaar voor iedereen' : 'Projecten zijn weer alleen voor beheerders');
}
