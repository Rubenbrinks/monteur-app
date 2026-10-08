/* ── Emondt Materiaalapp — info.js ──
 * Tabblad "Monteur": een menu met "Mijn profiel" en "Meldingen",
 * zodat er niet te veel inhoud tegelijk op het scherm staat.
 */

const INFO_MENU = [
  { sectie: 'profiel',    icoon: '👤', label: 'Mijn profiel', sub: 'Naam, telefoon, afdeling en e-mail' },
  { sectie: 'meldingen',  icoon: '🔔', label: 'Meldingen',    subId: 'info-meldingen-sub' },
];

let _infoSectie = null; // null = menu

function _infoWeergave() {
  const menu = document.getElementById('info-menu');
  const titel = document.getElementById('info-titel');
  const terug = document.getElementById('info-terug-btn');
  if (!menu) return;
  document.querySelectorAll('.info-sectie').forEach(s =>
    s.classList.toggle('actief', s.dataset.sectie === _infoSectie));

  if (_infoSectie) {
    const item = INFO_MENU.find(i => i.sectie === _infoSectie);
    titel.textContent = item ? item.label : 'Monteur';
    terug.style.display = '';
    menu.style.display = 'none';
  } else {
    titel.textContent = 'Monteur';
    terug.style.display = 'none';
    menu.style.display = '';
    menu.innerHTML = INFO_MENU.map(i => `
      <button class="beheer-menu-item" onclick="infoOpenSectie('${i.sectie}')">
        <span class="beheer-menu-icoon">${i.icoon}</span>
        <span class="beheer-menu-tekst"><strong>${i.label}</strong><span${i.subId ? ' id="' + i.subId + '"' : ''}>${i.sub || ''}</span></span>
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
      </button>`).join('');
    // De status van meldingen staat onder de titel van het menu-item.
    if (typeof updateMeldingKnop === 'function') updateMeldingKnop();
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function infoNaarMenu() { _infoSectie = null; _infoWeergave(); }
function infoOpenSectie(naam) {
  _infoSectie = naam;
  _infoWeergave();
  if (naam === 'meldingen' && typeof updateMeldingKnop === 'function') updateMeldingKnop();
}
function infoTerug() { infoNaarMenu(); }
