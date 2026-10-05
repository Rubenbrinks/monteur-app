/* ── Emondt Materiaalapp — home.js ──
 * Homepage: mededelingen en agenda, als uitvouwbare regels.
 * Wie wat ziet bepaalt de database (rol + doelgroep); hier alleen weergave.
 */

let _homeLaatstGeladen = 0;

function _escH(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// Nieuwe regels in de tekst behouden, rest veilig maken.
function _tekstH(s) {
  return _escH(s).replace(/\n/g, '<br>');
}

// "Nieuw"-stipje: welke mededelingen heeft deze gebruiker op dit toestel al uitgeklapt?
function _gelezenSleutel() { return 'emondt_gelezen_med_' + (getAuthSessie()?.id || ''); }
function _gelezenLijst() {
  try { return JSON.parse(localStorage.getItem(_gelezenSleutel()) || '[]'); } catch(e) { return []; }
}
function homeMarkeerGelezen(details, id) {
  if (!details.open) return;
  const lijst = _gelezenLijst();
  if (!lijst.includes(id)) {
    lijst.push(id);
    try { localStorage.setItem(_gelezenSleutel(), JSON.stringify(lijst.slice(-300))); } catch(e) {}
  }
  details.querySelector('.home-nieuw')?.remove();
}

function _doelgroepLabel(g) {
  // Alleen voor beheerders: die zien beide groepen en moeten kunnen onderscheiden.
  if (!isAdmin() || g === 'iedereen') return '';
  return `<span class="home-tag">${g === 'zzp' ? 'ZZP' : 'Personeel'}</span>`;
}

function _toonMededelingen(lijst) {
  const el = document.getElementById('home-mededelingen');
  if (!el) return;
  if (!lijst.length) { el.innerHTML = '<div class="home-leeg">Geen mededelingen.</div>'; return; }
  const gelezen = _gelezenLijst();
  el.innerHTML = lijst.map(m => `
    <details class="home-rij" ontoggle="homeMarkeerGelezen(this, ${m.id})">
      <summary>
        <span class="home-rij-tekst">
          <span class="home-rij-titel">${m.vastgezet ? '📌 ' : ''}${_escH(m.titel)} ${_doelgroepLabel(m.doelgroep)}</span>
        </span>
        ${gelezen.includes(m.id) ? '' : '<span class="home-nieuw" title="Nieuw"></span>'}
        <svg class="home-pijl" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
      </summary>
      <div class="home-rij-body">${m.tekst ? _tekstH(m.tekst) : '<span style="color:var(--muted)">Geen verdere toelichting.</span>'}</div>
    </details>`).join('');
}

function _agendaWanneer(a) {
  const dag = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
  return a.einddatum && a.einddatum !== a.datum ? dag(a.datum) + ' t/m ' + dag(a.einddatum) : dag(a.datum);
}

function _toonAgenda(lijst) {
  const el = document.getElementById('home-agenda');
  if (!el) return;
  if (!lijst.length) { el.innerHTML = '<div class="home-leeg">Geen agenda-items.</div>'; return; }
  const vandaag = vandaagNL();
  el.innerHTML = lijst.map(a => {
    const bezig = a.datum <= vandaag && (a.einddatum || a.datum) >= vandaag;
    const details = [
      a.tijd ? `<div><strong>Tijd</strong> ${_escH(a.tijd)}</div>` : '',
      a.locatie ? `<div><strong>Locatie</strong> ${_escH(a.locatie)}</div>` : '',
      a.toelichting ? `<div style="margin-top:6px">${_tekstH(a.toelichting)}</div>` : '',
    ].join('');
    return `
    <details class="home-rij">
      <summary>
        <span class="home-rij-tekst">
          <span class="home-rij-datum">${bezig ? 'Vandaag · ' : ''}${_escH(_agendaWanneer(a))}${a.tijd ? ' · ' + _escH(a.tijd) : ''}</span>
          <span class="home-rij-titel">${_escH(a.titel)} ${_doelgroepLabel(a.doelgroep)}</span>
        </span>
        <svg class="home-pijl" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
      </summary>
      <div class="home-rij-body">${details || '<span style="color:var(--muted)">Geen verdere toelichting.</span>'}</div>
    </details>`;
  }).join('');
}

async function laadHome(forceer) {
  // Niet bij elke tabwissel opnieuw ophalen.
  if (!forceer && Date.now() - _homeLaatstGeladen < 30000) return;
  _homeLaatstGeladen = Date.now();
  const vandaag = vandaagNL();
  try {
    const [med, ag] = await Promise.all([
      sb.from('mededelingen').select('*')
        .order('vastgezet', { ascending: false }).order('aangemaakt_op', { ascending: false }),
      sb.from('agenda').select('*').order('datum', { ascending: true }),
    ]);
    if (med.error) throw med.error;
    if (ag.error) throw ag.error;
    // De database filtert al op doelgroep en datum voor monteurs/ZZP; beheerders
    // krijgen alles terug en moeten verlopen items hier alsnog kwijt.
    _toonMededelingen((med.data || []).filter(m => !m.vervalt_op || m.vervalt_op >= vandaag));
    _toonAgenda((ag.data || []).filter(a => (a.einddatum || a.datum) >= vandaag));
  } catch(e) {
    _homeLaatstGeladen = 0;
    ['home-mededelingen', 'home-agenda'].forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.children.length) el.innerHTML = '<div class="home-leeg">Kon niet laden. Controleer je verbinding.</div>';
    });
  }
}

// Het logo staat al (als data-URI) in het zijmenu; hergebruiken scheelt een tweede kopie.
function zetHomeLogo() {
  const bron = document.querySelector('.drawer-head img');
  const doel = document.getElementById('home-logo');
  if (bron && doel && !doel.src) doel.src = bron.src;
}
