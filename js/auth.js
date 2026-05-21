/* ── Emondt Materiaalapp — auth.js ──
 * Authenticatie: login, sessie, registratie
 */

// ── AUTHENTICATIE ─────────────────────────────────────────────
// Sessie opgeslagen in localStorage zodat inloggen onthouden wordt
const AUTH_KEY = 'emondt_auth';

function getAuthSessie() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch(e) { return null; }
}

function isIngelogd() {
  const s = getAuthSessie();
  if (!s) return false;
  // Sessie verloopt na 30 dagen
  return (Date.now() - s.ts) < 30 * 24 * 60 * 60 * 1000;
}

function isAdmin() {
  return getAuthSessie()?.rol === 'admin';
}

function slaAuthOp(gebruiker, rol) {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ gebruiker, rol, ts: Date.now() }));
  } catch(e) {}
}

function uitloggen() {
  try { localStorage.removeItem(AUTH_KEY); } catch(e) {}
  location.reload();
}

function checkLogin() {
  const user  = document.getElementById('login-user').value.trim();
  const pw    = document.getElementById('login-pw').value;
  const fout  = document.getElementById('login-fout');
  const btn   = document.querySelector('#login-scherm .btn-primary');

  if (!user || !pw) {
    fout.textContent = '❌ Vul gebruikersnaam en wachtwoord in';
    fout.style.display = 'block';
    return;
  }

  const url = getSheetsUrl();
  if (!url) {
    // Geen URL geconfigureerd — toon fout
    fout.textContent = '❌ Geen Web App URL ingesteld. Configureer eerst de koppeling.';
    fout.style.display = 'block';
    return;
  }

  // Toon laadindicator
  btn.textContent = '⏳ Inloggen...';
  btn.disabled = true;
  fout.style.display = 'none';

  fetch(`${url}?actie=login&gebruiker=${encodeURIComponent(user)}&wachtwoord=${encodeURIComponent(pw)}&t=${Date.now()}`)
    .then(r => r.json())
    .then(r => {
      btn.textContent = 'Inloggen';
      btn.disabled = false;
      if (r.status === 'ok') {
        slaAuthOp(r.gebruiker, r.rol);
        // Sla accountgegevens op — vul naam in als nog niet ingevuld
        try {
          const bestaand = JSON.parse(localStorage.getItem('emondt_persoon') || '{}');
          const updated = {
            naam:      bestaand.naam      || r.gebruiker || '',
            telefoon:  bestaand.telefoon  || r.telefoon  || '',
            ontvanger2:bestaand.ontvanger2|| r.email     || '',
            afdeling:  bestaand.afdeling  || '',
          };
          localStorage.setItem('emondt_persoon', JSON.stringify(updated));
        } catch(e) {}
        document.getElementById('login-scherm').classList.add('verborgen');
        initialiseerApp();
      } else {
        fout.textContent = '❌ ' + (r.message || 'Onjuiste gegevens');
        fout.style.display = 'block';
        document.getElementById('login-pw').value = '';
        document.getElementById('login-pw').focus();
        setTimeout(() => { fout.style.display = 'none'; }, 4000);
      }
    })
    .catch(() => {
      btn.textContent = 'Inloggen';
      btn.disabled = false;
      fout.textContent = '❌ Verbinding mislukt. Controleer je internetverbinding.';
      fout.style.display = 'block';
    });
}
