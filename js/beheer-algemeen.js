/* ── Emondt Materiaalapp — beheer-algemeen.js ──
 * Beheer van gebruikers (rollen), mededelingen en agenda.
 */

const ROL_NAMEN = { monteur: 'Monteur', zzp: 'ZZP / Ingeleend', admin: 'Admin' };

function _escA(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── GEBRUIKERS (rollen) ───────────────────────────────────────
let _gebruikersLijst = [];

async function laadGebruikers() {
  const lijst = document.getElementById('gebruikers-lijst');
  const status = document.getElementById('gebruikers-status');
  if (!lijst) return;
  status.textContent = '⏳ Laden...';
  const { data, error } = await sb
    .from('profiles')
    .select('id, gebruikersnaam, naam, afdeling, rol')
    .order('naam', { ascending: true })
    .limit(2000);
  if (error) { status.innerHTML = '<span style="color:var(--danger)">❌ ' + _escA(error.message) + '</span>'; return; }
  status.textContent = '';
  _gebruikersLijst = data || [];
  toonGebruikers();
}

function toonGebruikers() {
  const lijst = document.getElementById('gebruikers-lijst');
  if (!lijst) return;
  const zoek = (document.getElementById('gebruikers-zoek')?.value || '').trim().toLowerCase();
  const ik = getAuthSessie()?.id;
  const rijen = _gebruikersLijst.filter(g =>
    !zoek || [g.naam, g.gebruikersnaam, g.afdeling].some(v => String(v || '').toLowerCase().includes(zoek)));
  if (!rijen.length) { lijst.innerHTML = '<div style="color:var(--muted);font-size:.84rem;padding:8px 0">Geen gebruikers gevonden.</div>'; return; }
  lijst.innerHTML = rijen.map(g => `
    <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1;min-width:0">
        <div style="font-size:.88rem;font-weight:600;color:var(--text)">${_escA(g.naam || g.gebruikersnaam || '—')}</div>
        <div style="font-size:.74rem;color:var(--muted)">${_escA(g.gebruikersnaam || '')}${g.afdeling ? ' · ' + _escA(g.afdeling) : ''}</div>
      </div>
      <select onchange="wijzigRol('${_escA(g.id)}', this)" ${g.id === ik ? 'disabled title="Je kunt je eigen rol niet wijzigen"' : ''}
        style="flex-shrink:0;padding:7px 8px;border-radius:8px;border:1px solid var(--border-strong);background:var(--bg);color:var(--text);font-family:inherit;font-size:.82rem">
        ${Object.entries(ROL_NAMEN).map(([k, v]) => `<option value="${k}" ${g.rol === k ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
    </div>`).join('');
}

async function wijzigRol(id, select) {
  const g = _gebruikersLijst.find(x => x.id === id);
  if (!g) return;
  const nieuw = select.value;
  const status = document.getElementById('gebruikers-status');
  const naam = g.naam || g.gebruikersnaam;
  if (nieuw === 'admin' && !confirm(`${naam} beheerder maken? Beheerders kunnen alles in de app aanpassen.`)) {
    select.value = g.rol; return;
  }
  select.disabled = true;
  const { error } = await sb.from('profiles').update({ rol: nieuw }).eq('id', id);
  select.disabled = false;
  if (error) {
    select.value = g.rol;
    status.innerHTML = '<span style="color:var(--danger)">❌ Wijzigen mislukt: ' + _escA(error.message) + '</span>';
    return;
  }
  g.rol = nieuw;
  status.innerHTML = `<span style="color:green">✅ ${_escA(naam)} is nu ${_escA(ROL_NAMEN[nieuw])}.</span>`;
}


// ── BEHEERMENU ────────────────────────────────────────────────
// Hoofdmenu met vier groepen → submenu → het onderdeel zelf.
// Elk onderdeel is een kaart met data-sectie="..." in index.html.
const BEHEER_MENU = [
  { titel: 'App instellingen', icoon: '⚙️', items: [
    { sectie: 'testfuncties', label: 'Test functies' },
    { sectie: 'csv',          label: 'CSV import' },
    { sectie: 'meldingen',    label: 'Pushmeldingen',  laad: () => laadMeldingenStatistiek() },
    { sectie: 'email',        label: 'E-mailadressen', laad: () => laadEmailontvangers() },
  ]},
  { titel: 'Artikelen', icoon: '📦', items: [
    { sectie: 'artikel-toevoegen', label: 'Artikel toevoegen' },
    { sectie: 'artikel-bewerken',  label: 'Artikel bewerken' },
  ]},
  { titel: 'Bestellingen', icoon: '🧾', items: [
    { sectie: 'exporteren', label: 'Exporteren' },
    { sectie: 'historie',   label: 'Historie', laad: () => laadBestellingenOverzicht() },
  ]},
  { titel: 'Algemeen', icoon: '📋', items: [
    { sectie: 'agenda',       label: 'Agenda',       laad: () => laadAgendaBeheer() },
    { sectie: 'mededelingen', label: 'Mededelingen', laad: () => laadMededelingenBeheer() },
    { sectie: 'gebruikers',   label: 'Gebruikers',   laad: () => laadGebruikers() },
  ]},
];

let _beheerGroep = -1;     // index in BEHEER_MENU, -1 = hoofdmenu
let _beheerSectie = null;  // naam van het geopende onderdeel

function _beheerWeergave() {
  const menu = document.getElementById('beheer-menu');
  const titel = document.getElementById('beheer-titel');
  document.querySelectorAll('.beheer-sectie').forEach(k =>
    k.classList.toggle('actief', k.dataset.sectie === _beheerSectie));
  if (_beheerSectie) {
    const item = BEHEER_MENU.flatMap(g => g.items).find(i => i.sectie === _beheerSectie);
    titel.textContent = item?.label || 'Beheer';
    menu.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'instant' });
    return;
  }
  menu.style.display = '';
  if (_beheerGroep < 0) {
    titel.textContent = 'Beheer';
    menu.innerHTML = BEHEER_MENU.map((g, i) => `
      <button class="beheer-menu-item" onclick="beheerOpenGroep(${i})">
        <span class="beheer-menu-icoon">${g.icoon}</span>
        <span class="beheer-menu-tekst"><strong>${g.titel}</strong><span>${g.items.map(x => x.label).join(' · ')}</span></span>
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
      </button>`).join('');
  } else {
    const g = BEHEER_MENU[_beheerGroep];
    titel.textContent = g.titel;
    menu.innerHTML = g.items.map(it => `
      <button class="beheer-menu-item" onclick="beheerOpenSectie('${it.sectie}')">
        <span class="beheer-menu-tekst"><strong>${it.label}</strong></span>
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
      </button>`).join('');
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function beheerNaarMenu() { _beheerGroep = -1; _beheerSectie = null; _beheerWeergave(); }
function beheerOpenGroep(i) { _beheerGroep = i; _beheerSectie = null; _beheerWeergave(); }
function beheerOpenSectie(naam) {
  _beheerSectie = naam;
  _beheerWeergave();
  const item = BEHEER_MENU.flatMap(g => g.items).find(i => i.sectie === naam);
  if (item?.laad) item.laad();
}
// Terugknop: onderdeel → submenu → hoofdmenu → homepage.
function beheerTerug() {
  if (_beheerSectie) { _beheerSectie = null; _beheerWeergave(); }
  else if (_beheerGroep >= 0) { _beheerGroep = -1; _beheerWeergave(); }
  else showTab('welkom');
}


// ── HULPFUNCTIES ──────────────────────────────────────────────
// "Vandaag" in Nederlandse tijd, als YYYY-MM-DD (net als de database).
function vandaagNL() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
}
function _datumTekst(iso, kort) {
  if (!iso) return '';
  return new Date(iso + 'T12:00:00').toLocaleDateString('nl-NL',
    kort ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'long', year: 'numeric' });
}
const DOELGROEP_NAMEN = { iedereen: 'Iedereen', personeel: 'Eigen personeel', zzp: 'ZZP / Ingeleend' };


// ── MEDEDELINGEN (beheer) ─────────────────────────────────────
let _mededelingen = [];

async function laadMededelingenBeheer() {
  const lijst = document.getElementById('med-lijst');
  if (!lijst) return;
  lijst.innerHTML = '<span style="color:var(--muted);font-size:.84rem">⏳ Laden...</span>';
  const { data, error } = await sb.from('mededelingen').select('*')
    .order('vastgezet', { ascending: false }).order('aangemaakt_op', { ascending: false });
  if (error) { lijst.innerHTML = '<span style="color:var(--danger);font-size:.84rem">❌ ' + _escA(error.message) + '</span>'; return; }
  _mededelingen = data || [];
  const vandaag = vandaagNL();
  lijst.innerHTML = _mededelingen.length ? _mededelingen.map(m => {
    const verlopen = m.vervalt_op && m.vervalt_op < vandaag;
    const verborgen = m.zichtbaar === false;
    return `<div class="beheer-rij${verlopen || verborgen ? ' verlopen' : ''}">
      <div style="flex:1;min-width:0">
        <div class="beheer-rij-titel">${m.vastgezet ? '📌 ' : ''}${_escA(m.titel)}</div>
        <div class="beheer-rij-sub">${DOELGROEP_NAMEN[m.doelgroep]}${m.vervalt_op ? ' · ' + (verlopen ? 'verlopen op ' : 'tot ') + _datumTekst(m.vervalt_op, true) : ''}${verborgen ? ' · verborgen' : ''}</div>
      </div>
      <button class="beheer-rij-knop" onclick="wisselZichtbaar(${m.id})">${verborgen ? 'Toon' : 'Verberg'}</button>
      <button class="beheer-rij-knop" onclick="bewerkMededeling(${m.id})">Bewerk</button>
      <button class="beheer-rij-knop gevaar" onclick="verwijderMededeling(${m.id})">Wis</button>
    </div>`;
  }).join('') : '<div style="color:var(--muted);font-size:.84rem">Nog geen mededelingen.</div>';
}

function resetMededelingForm() {
  ['med-id', 'med-titel', 'med-tekst', 'med-vervalt'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('med-doelgroep').value = 'iedereen';
  document.getElementById('med-vast').checked = false;
  document.getElementById('med-push').checked = false;
  document.getElementById('med-zichtbaar').checked = true;
  document.getElementById('med-push-rij').style.display = '';
  document.getElementById('med-opslaan-btn').textContent = 'Plaatsen';
  document.getElementById('med-annuleer-btn').style.display = 'none';
}

function bewerkMededeling(id) {
  const m = _mededelingen.find(x => x.id === id);
  if (!m) return;
  document.getElementById('med-id').value = m.id;
  document.getElementById('med-titel').value = m.titel;
  document.getElementById('med-tekst').value = m.tekst || '';
  document.getElementById('med-doelgroep').value = m.doelgroep;
  document.getElementById('med-vervalt').value = m.vervalt_op || '';
  document.getElementById('med-vast').checked = !!m.vastgezet;
  document.getElementById('med-zichtbaar').checked = m.zichtbaar !== false;
  document.getElementById('med-push-rij').style.display = 'none';
  document.getElementById('med-opslaan-btn').textContent = 'Opslaan';
  document.getElementById('med-annuleer-btn').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function slaMededelingOp() {
  const status = document.getElementById('med-status');
  const id = document.getElementById('med-id').value;
  const rij = {
    titel:      document.getElementById('med-titel').value.trim(),
    tekst:      document.getElementById('med-tekst').value.trim(),
    doelgroep:  document.getElementById('med-doelgroep').value,
    vervalt_op: document.getElementById('med-vervalt').value || null,
    vastgezet:  document.getElementById('med-vast').checked,
    zichtbaar:  document.getElementById('med-zichtbaar').checked,
  };
  if (!rij.titel) { status.innerHTML = '<span style="color:var(--danger)">⚠️ Vul een titel in.</span>'; return; }
  status.textContent = '⏳ Opslaan...';
  const { error } = id
    ? await sb.from('mededelingen').update(rij).eq('id', id)
    : await sb.from('mededelingen').insert({ ...rij, aangemaakt_door: getAuthSessie()?.id || null });
  if (error) { status.innerHTML = '<span style="color:var(--danger)">❌ ' + _escA(error.message) + '</span>'; return; }
  let pushTekst = '';
  if (!id && rij.zichtbaar && document.getElementById('med-push').checked) pushTekst = await _stuurMededelingPush(rij);
  status.innerHTML = '<span style="color:green">✅ ' + (id ? 'Opgeslagen.' : 'Geplaatst.') + '</span>' + pushTekst;
  resetMededelingForm();
  laadMededelingenBeheer();
}

async function verwijderMededeling(id) {
  const m = _mededelingen.find(x => x.id === id);
  if (!m || !confirm(`"${m.titel}" verwijderen?`)) return;
  const { error } = await sb.from('mededelingen').delete().eq('id', id);
  if (error) { document.getElementById('med-status').innerHTML = '<span style="color:var(--danger)">❌ ' + _escA(error.message) + '</span>'; return; }
  laadMededelingenBeheer();
}


// ── AGENDA (beheer) ───────────────────────────────────────────
let _agendaItems = [];

async function laadAgendaBeheer() {
  const lijst = document.getElementById('ag-lijst');
  if (!lijst) return;
  lijst.innerHTML = '<span style="color:var(--muted);font-size:.84rem">⏳ Laden...</span>';
  const { data, error } = await sb.from('agenda').select('*').order('datum', { ascending: true });
  if (error) { lijst.innerHTML = '<span style="color:var(--danger);font-size:.84rem">❌ ' + _escA(error.message) + '</span>'; return; }
  _agendaItems = data || [];
  const vandaag = vandaagNL();
  lijst.innerHTML = _agendaItems.length ? _agendaItems.map(a => {
    const voorbij = (a.einddatum || a.datum) < vandaag;
    const wanneer = _datumTekst(a.datum, true) + (a.einddatum ? ' t/m ' + _datumTekst(a.einddatum, true) : '') + (a.tijd ? ' · ' + a.tijd : '');
    return `<div class="beheer-rij${voorbij ? ' verlopen' : ''}">
      <div style="flex:1;min-width:0">
        <div class="beheer-rij-titel">${_escA(a.titel)}</div>
        <div class="beheer-rij-sub">${_escA(wanneer)} · ${DOELGROEP_NAMEN[a.doelgroep]}${voorbij ? ' · voorbij' : ''}</div>
      </div>
      <button class="beheer-rij-knop" onclick="bewerkAgenda(${a.id})">Bewerk</button>
      <button class="beheer-rij-knop gevaar" onclick="verwijderAgenda(${a.id})">Wis</button>
    </div>`;
  }).join('') : '<div style="color:var(--muted);font-size:.84rem">Nog geen agenda-items.</div>';
}

function resetAgendaForm() {
  ['ag-id', 'ag-titel', 'ag-datum', 'ag-eind', 'ag-tijd', 'ag-locatie', 'ag-toel'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('ag-doelgroep').value = 'iedereen';
  document.getElementById('ag-opslaan-btn').textContent = 'Toevoegen';
  document.getElementById('ag-annuleer-btn').style.display = 'none';
}

function bewerkAgenda(id) {
  const a = _agendaItems.find(x => x.id === id);
  if (!a) return;
  document.getElementById('ag-id').value = a.id;
  document.getElementById('ag-titel').value = a.titel;
  document.getElementById('ag-datum').value = a.datum;
  document.getElementById('ag-eind').value = a.einddatum || '';
  document.getElementById('ag-tijd').value = a.tijd || '';
  document.getElementById('ag-locatie').value = a.locatie || '';
  document.getElementById('ag-toel').value = a.toelichting || '';
  document.getElementById('ag-doelgroep').value = a.doelgroep;
  document.getElementById('ag-opslaan-btn').textContent = 'Opslaan';
  document.getElementById('ag-annuleer-btn').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function slaAgendaOp() {
  const status = document.getElementById('ag-status');
  const id = document.getElementById('ag-id').value;
  const rij = {
    titel:       document.getElementById('ag-titel').value.trim(),
    datum:       document.getElementById('ag-datum').value,
    einddatum:   document.getElementById('ag-eind').value || null,
    tijd:        document.getElementById('ag-tijd').value.trim(),
    locatie:     document.getElementById('ag-locatie').value.trim(),
    toelichting: document.getElementById('ag-toel').value.trim(),
    doelgroep:   document.getElementById('ag-doelgroep').value,
  };
  if (!rij.titel) { status.innerHTML = '<span style="color:var(--danger)">⚠️ Vul een titel in.</span>'; return; }
  if (!rij.datum) { status.innerHTML = '<span style="color:var(--danger)">⚠️ Kies een datum.</span>'; return; }
  if (rij.einddatum && rij.einddatum < rij.datum) { status.innerHTML = '<span style="color:var(--danger)">⚠️ De einddatum ligt voor de begindatum.</span>'; return; }
  status.textContent = '⏳ Opslaan...';
  const { error } = id
    ? await sb.from('agenda').update(rij).eq('id', id)
    : await sb.from('agenda').insert({ ...rij, aangemaakt_door: getAuthSessie()?.id || null });
  if (error) { status.innerHTML = '<span style="color:var(--danger)">❌ ' + _escA(error.message) + '</span>'; return; }
  status.innerHTML = '<span style="color:green">✅ ' + (id ? 'Opgeslagen.' : 'Toegevoegd.') + '</span>';
  resetAgendaForm();
  laadAgendaBeheer();
}

async function verwijderAgenda(id) {
  const a = _agendaItems.find(x => x.id === id);
  if (!a || !confirm(`"${a.titel}" verwijderen?`)) return;
  const { error } = await sb.from('agenda').delete().eq('id', id);
  if (error) { document.getElementById('ag-status').innerHTML = '<span style="color:var(--danger)">❌ ' + _escA(error.message) + '</span>'; return; }
  laadAgendaBeheer();
}

// Pushmelding naar dezelfde doelgroep als de mededeling (alleen bij nieuw plaatsen).
async function _stuurMededelingPush(rij) {
  try {
    const body = { actie: 'versturen', titel: rij.titel, tekst: rij.tekst.slice(0, 170), test: false };
    if (rij.doelgroep !== 'iedereen') body.rol = rij.doelgroep;
    const { data, error } = await sb.functions.invoke('meldingen-beheer', { body });
    if (error || data?.status !== 'ok') throw new Error(data?.fout || error?.message || 'onbekende fout');
    return ' <span style="color:green">Pushmelding naar ' + data.verstuurd + ' van ' + data.geprobeerd + ' apparaten.</span>';
  } catch(e) {
    return ' <span style="color:var(--danger)">Pushmelding mislukt: ' + _escA(e.message) + '</span>';
  }
}

// Snel tonen/verbergen vanuit de lijst, zonder het formulier te openen.
async function wisselZichtbaar(id) {
  const m = _mededelingen.find(x => x.id === id);
  if (!m) return;
  const { error } = await sb.from('mededelingen').update({ zichtbaar: m.zichtbaar === false }).eq('id', id);
  if (error) { document.getElementById('med-status').innerHTML = '<span style="color:var(--danger)">❌ ' + _escA(error.message) + '</span>'; return; }
  laadMededelingenBeheer();
}
