/* ── Emondt Materiaalapp — ui.js ──
 * UI helpers: drawer, toasts, favorieten, PWA
 */

let deferredInstallPrompt = null;

// ── DRAWER ────────────────────────────────────────────────────
function toggleDrawer() {
  const d = document.getElementById('drawer'), o = document.getElementById('overlay'), h = document.getElementById('hamburger');
  const open = d.classList.toggle('open');
  o.classList.toggle('open', open); h.classList.toggle('open', open);
}
function closeDrawer() {
  ['drawer','overlay','hamburger'].forEach(id => document.getElementById(id).classList.remove('open'));
}


// ── VRIJ ARTIKEL ─────────────────────────────────────────────
function openVrijArtikel() {
  closeDrawer();
  document.getElementById('vrij-overlay').style.display = 'flex';
  setTimeout(() => document.getElementById('custom-naam').focus(), 100);
}
function sluitVrijArtikel() {
  document.getElementById('vrij-overlay').style.display = 'none';
  document.getElementById('custom-naam').value = '';
  document.getElementById('custom-code').value = '';
  document.getElementById('custom-qty').value = '1';
}


function toonRegistreren() {
  document.getElementById('login-box-inloggen').style.display = 'none';
  document.getElementById('login-box-registreren').style.display = 'block';
  setTimeout(() => document.getElementById('reg-user').focus(), 100);
}

function toonInloggen() {
  document.getElementById('login-box-registreren').style.display = 'none';
  document.getElementById('login-box-inloggen').style.display = 'block';
}

function registreerAccount() {
  const naam  = document.getElementById('reg-naam').value.trim();
  const user  = document.getElementById('reg-user').value.trim().toLowerCase();
  const email = document.getElementById('reg-email').value.trim().toLowerCase();
  const tel   = document.getElementById('reg-tel').value.trim();
  const pw    = document.getElementById('reg-pw').value;
  const pw2   = document.getElementById('reg-pw2').value;
  const fout  = document.getElementById('registreer-fout');

  const setFout = (tekst, ok=false) => {
    fout.style.cssText = `display:block;border-radius:8px;padding:10px;margin-bottom:8px;${ok ? 'background:#f0f7e6;color:green' : 'background:#fee2e2;color:var(--danger)'}`;
    fout.textContent = tekst;
  };

  fout.style.display = 'none';
  if (!naam || !user || !email || !tel || !pw || !pw2) { setFout('❌ Vul alle velden in'); return; }
  if (!email.includes('@'))                            { setFout('❌ Ongeldig e-mailadres'); return; }
  if (pw.length < 6)                                  { setFout('❌ Wachtwoord minimaal 6 tekens'); return; }
  if (pw !== pw2)                                      { setFout('❌ Wachtwoorden komen niet overeen'); return; }

  const url = getSheetsUrl();
  if (!url) { setFout('❌ Geen databasekoppeling. Vraag een beheerder.'); return; }

  setFout('⏳ Account aanmaken...', true);

  const params = new URLSearchParams({
    actie:      'registreer',
    gebruiker:  user,
    naam:       naam,
    wachtwoord: pw,
    email:      email,
    telefoon:   tel,
    rol:        'monteur',
    t:          Date.now(),
  });

  fetch(`${url}?${params.toString()}`)
    .then(r => r.json())
    .then(r => {
      if (r.status === 'ok') {
        slaAuthOp(user, 'monteur');
        try {
          localStorage.setItem('emondt_persoon', JSON.stringify({
            naam: naam, telefoon: tel, ontvanger2: email, afdeling: ''
          }));
          localStorage.setItem('emondt_actieve_user', user);
        } catch(e) {}
        document.getElementById('login-scherm').classList.add('verborgen');
        initialiseerApp();
        setTimeout(() => {
          const nEl = document.getElementById('naam');
          const tEl = document.getElementById('telefoon');
          const eEl = document.getElementById('ontvanger2');
          if (nEl) nEl.value = naam;
          if (tEl) tEl.value = tel;
          if (eEl) eEl.value = email;
          saveInfo();
        }, 500);
      } else if (r.status === 'bestaat_al') {
        setFout('❌ Gebruikersnaam al in gebruik, kies een andere.');
      } else {
        setFout('❌ ' + (r.message || 'Onbekende fout. Controleer de databasekoppeling.'));
      }
    })
    .catch(err => {
      if (err.message?.includes('NetworkError') || err.message?.includes('fetch')) {
        setFout('❌ CORS-fout: werkt alleen op de gedeployde omgeving (niet lokaal).');
      } else {
        setFout('❌ Verbindingsfout: ' + err.message);
      }
    });
}


// ── FAVORIETEN ────────────────────────────────────────────────
let FAVORIETEN = new Set(JSON.parse(localStorage.getItem('emondt_favorieten') || '[]'));

function toonCategorieTegels() {
  if (!ARTIKELEN.length) { setTimeout(toonCategorieTegels, 300); return; }
  const lijst = document.getElementById('artikel-lijst');
  if (!lijst) return;

  const cats = [...new Set(ARTIKELEN.map(a => a.cat).filter(Boolean))].sort();
  lijst.className = 'artikel-grid';
  lijst.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:4px 0">
      ${cats.map(cat => {
        const n = ARTIKELEN.filter(a => a.cat === cat).length;
        const iconen = ['🔧','⚡','🌡️','🔩','🧊','💧','🔌','🛠️','📦','🔄'];
        const ico = iconen[cats.indexOf(cat) % iconen.length];
        return `<button onclick="filterCategorie('${cat.replace(/'/g,"\\'")}');applyFilters()"
          style="background:var(--white);border:1.5px solid var(--border);border-radius:var(--radius);
                 padding:16px 12px;text-align:left;cursor:pointer;box-shadow:var(--shadow);
                 display:flex;flex-direction:column;gap:4px;transition:border-color .15s;font-family:'DM Sans',sans-serif">
          <span style="font-size:.85rem;font-weight:700;color:var(--navy);line-height:1.3">${cat}</span>
          <span style="font-size:.72rem;color:var(--muted)">${n} artikel${n !== 1 ? 'en' : ''}</span>
        </button>`;
      }).join('')}
    </div>`;
}

// Artikelen-bug fix: render na laden als artikelenpagina actief is
function _naArtikelenGeladen() {
  if (document.getElementById('tab-artikelen')?.classList.contains('active')) {
    renderArtikelen(ARTIKELEN);
  }
}

function toggleFavoriet(code) {
  if (FAVORIETEN.has(code)) {
    FAVORIETEN.delete(code);
    showToast('★ Verwijderd uit favorieten');
  } else {
    FAVORIETEN.add(code);
    showToast('⭐ Toegevoegd aan favorieten');
  }
  try { localStorage.setItem('emondt_favorieten', JSON.stringify([...FAVORIETEN])); } catch(e){}
  // Update knop zichtbaar op kaart
  const kaart = document.getElementById('card-' + code);
  if (kaart) {
    const btn = kaart.querySelector('.fav-btn');
    if (btn) {
      btn.classList.toggle('actief', FAVORIETEN.has(code));
      btn.title = FAVORIETEN.has(code) ? 'Verwijder uit favorieten' : 'Voeg toe aan favorieten';
    }
  }
}

function renderFavorieten() {
  const el = document.getElementById('fav-lijst');
  if (!el) return;
  const favArtikelen = ARTIKELEN.filter(a => FAVORIETEN.has(a.code));
  if (!favArtikelen.length) {
    el.innerHTML = '<div class="empty-cart" style="padding:40px 20px;text-align:center;color:var(--muted)"><p>Nog geen favorieten opgeslagen.<br>Tik op ★ op een artikelkaart om toe te voegen.</p></div>';
    return;
  }
  el.innerHTML = '';
  favArtikelen.forEach(a => renderArtikelCard(a, el));
}


// ── PWA INSTALL PROMPT ────────────────────────────────────────
function setPwaKnopZichtbaar(zichtbaar) {
  const cart = document.getElementById('pwa-cart-btn');
  const welkom = document.getElementById('pwa-welkom-btn');
  if (cart) cart.style.display = zichtbaar ? 'flex' : 'none';
  if (welkom) welkom.style.display = zichtbaar ? 'flex' : 'none';
}

// Verberg installatieknop direct als al als PWA gedraaid
(function() {
  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
    setPwaKnopZichtbaar(false);
  }
})();

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (!window.matchMedia('(display-mode: standalone)').matches && !window.navigator.standalone) {
    setPwaKnopZichtbaar(true);
  }
  if (!localStorage.getItem('pwa-banner-dismissed') && !window.matchMedia('(display-mode: standalone)').matches) {
    setTimeout(() => { document.getElementById('pwa-banner').style.display = 'block'; }, 3000);
  }
});

async function triggerPwaInstall() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  document.getElementById('pwa-banner').style.display = 'none';
  setPwaKnopZichtbaar(false);
  if (outcome === 'accepted') showToast('✅ App geïnstalleerd!');
}

document.getElementById('pwa-install-btn').addEventListener('click', async () => {
  await triggerPwaInstall();
});

window.addEventListener('appinstalled', () => {
  document.getElementById('pwa-banner').style.display = 'none';
  setPwaKnopZichtbaar(false);
  deferredInstallPrompt = null;
});
