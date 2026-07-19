/* ── Emondt Materiaalapp — ui.js ──
 * UI helpers: drawer, toasts, favorieten, PWA
 */

let deferredInstallPrompt = null;

// ── INKLAPBAAR ────────────────────────────────────────────────
function toggleInklapbaar(id) {
  const kaart = document.getElementById(id);
  if (!kaart) return;
  const body = kaart.querySelector('.inklapbaar-body');
  const btn  = kaart.querySelector('.inklapbaar-header');
  if (!body) return;
  const isOpen = kaart.classList.contains('inklapbaar-open');
  if (isOpen) {
    body.style.maxHeight = body.scrollHeight + 'px';
    requestAnimationFrame(() => requestAnimationFrame(() => { body.style.maxHeight = '0'; }));
    kaart.classList.remove('inklapbaar-open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  } else {
    kaart.classList.add('inklapbaar-open');
    body.style.maxHeight = body.scrollHeight + 'px';
    if (btn) btn.setAttribute('aria-expanded', 'true');
    body.addEventListener('transitionend', function h(e) {
      if (e.propertyName !== 'max-height') return;
      if (kaart.classList.contains('inklapbaar-open')) body.style.maxHeight = 'none';
      body.removeEventListener('transitionend', h);
    });
  }
}

function openInklapbaar(id) {
  const kaart = document.getElementById(id);
  if (!kaart || kaart.classList.contains('inklapbaar-open')) return;
  toggleInklapbaar(id);
}

function cartAutoExpand() {
  const projectnaam = (document.getElementById('projectnaam')?.value || '').trim();
  const projectnr   = (document.getElementById('projectnummer')?.value || '').trim();
  const locatieKeuze = document.getElementById('locatie-keuze')?.value || '';
  const locatieTekst = (document.getElementById('locatie')?.value || '').trim();

  openInklapbaar('cart-project-card');
  if (projectnaam || projectnr) openInklapbaar('cart-levering-card');

  const leveringIngevuld = locatieKeuze && (locatieKeuze !== 'vrij' || locatieTekst);
  if (leveringIngevuld) openInklapbaar('cart-leverdatum-card');
}

// ── SHEET ANIMATIES ───────────────────────────────────────────
function _voegSwipeToeToe(sheet, sluitFn) {
  if (sheet._swipeAttached) return;
  sheet._swipeAttached = true;
  let startY = 0, startTime = 0, actief = false;

  sheet.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
    startTime = Date.now();
    actief = true;
    sheet.style.transition = 'none';
  }, { passive: true });

  sheet.addEventListener('touchmove', e => {
    if (!actief) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0) sheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });

  sheet.addEventListener('touchend', e => {
    if (!actief) return;
    actief = false;
    const dy = e.changedTouches[0].clientY - startY;
    const snel = Date.now() - startTime < 250;
    sheet.style.transition = '';
    sheet.style.transform = '';
    if (dy > 80 || (snel && dy > 30)) sluitFn();
  }, { passive: true });
}

function _sheetOpen(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (!overlay) return;
  overlay.style.display = 'flex';
  const sheet = overlay.querySelector(':scope > div');
  if (sheet) {
    _voegSwipeToeToe(sheet, () => _sheetSluit(overlayId));
    sheet.classList.remove('sheet-sluit');
    void sheet.offsetWidth;
    sheet.classList.add('sheet-open');
  }
}

function _sheetSluit(overlayId, callback) {
  const overlay = document.getElementById(overlayId);
  if (!overlay) return;
  const sheet = overlay.querySelector(':scope > div');
  if (!sheet) { overlay.style.display = 'none'; if (callback) callback(); return; }
  sheet.classList.remove('sheet-open');
  sheet.classList.add('sheet-sluit');
  setTimeout(() => {
    overlay.style.display = 'none';
    sheet.classList.remove('sheet-sluit');
    if (callback) callback();
  }, 180);
}

// ── THEMA ─────────────────────────────────────────────────────
function getLichtDonker() {
  return localStorage.getItem('emondt_theme') === 'light' ? 'light' : 'dark';
}

function toggleThema() {
  const huidig = getLichtDonker();
  const nieuw  = huidig === 'dark' ? 'light' : 'dark';
  localStorage.setItem('emondt_theme', nieuw);
  if (nieuw === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  updateThemaKnop();
}

function updateThemaKnop() {
  const isDark = getLichtDonker() === 'dark';
  document.querySelectorAll('.thema-toggle-label').forEach(el => {
    el.textContent = isDark ? 'Lichte modus' : 'Donkere modus';
  });
  document.querySelectorAll('.thema-toggle-icon').forEach(el => {
    el.innerHTML = isDark
      ? '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
      : '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  });
}

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
  _sheetOpen('vrij-overlay');
  setTimeout(() => document.getElementById('custom-naam').focus(), 100);
}
function sluitVrijArtikel() {
  _sheetSluit('vrij-overlay', () => {
    document.getElementById('custom-naam').value = '';
    document.getElementById('custom-code').value = '';
    document.getElementById('custom-qty').value = '1';
  });
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

async function registreerAccount() {
  const naam  = document.getElementById('reg-naam').value.trim();
  const user  = document.getElementById('reg-user').value.trim().toLowerCase();
  const email = document.getElementById('reg-email').value.trim().toLowerCase();
  const tel   = document.getElementById('reg-tel').value.trim();
  const pass  = document.getElementById('reg-pass')?.value  || '';
  const pass2 = document.getElementById('reg-pass2')?.value || '';
  const fout  = document.getElementById('registreer-fout');
  const btn   = document.querySelector('#login-box-registreren .btn-primary');

  const setFout = (tekst, ok=false) => {
    fout.style.cssText = `display:block;border-radius:8px;padding:10px;margin-bottom:8px;${ok ? 'background:#f0f7e6;color:green' : 'background:#fee2e2;color:var(--danger)'}`;
    fout.textContent = tekst;
  };

  fout.style.display = 'none';
  if (!naam || !user || !email || !tel) { setFout('❌ Vul alle velden in'); return; }
  if (!email.includes('@'))             { setFout('❌ Ongeldig e-mailadres'); return; }
  if (pass.length < 6)                  { setFout('❌ Kies een wachtwoord van minstens 6 tekens'); return; }
  if (pass !== pass2)                   { setFout('❌ De wachtwoorden zijn niet gelijk'); return; }

  btn.textContent = '⏳ Account aanmaken...';
  btn.disabled = true;
  const herstel = () => { btn.textContent = 'Account aanmaken'; btn.disabled = false; };

  try {
    const { data, error } = await sb.auth.signUp({
      email,
      password: pass,
      options: { data: { naam, telefoon: tel, afdeling: '', gebruikersnaam: user, rol: 'monteur' } },
    });

    if (error) {
      herstel();
      if (/already|registered|exists/i.test(error.message || '')) {
        setFout('❌ Dit e-mailadres of deze gebruikersnaam is al in gebruik.');
      } else {
        setFout('❌ ' + (error.message || 'Kon account niet aanmaken.'));
      }
      return;
    }

    try { localStorage.setItem('emondt_ww_aangemaakt', '1'); } catch(e) {}

    if (data.session) {
      // Direct ingelogd (e-mailbevestiging staat uit).
      await _laadProfiel();
      herstel();
      document.getElementById('login-scherm').classList.add('verborgen');
      initialiseerApp();
    } else {
      // E-mailbevestiging staat aan — vraag de monteur zijn mail te checken.
      herstel();
      toonInloggen();
      setFout('✅ Account aangemaakt. Log in met je gebruikersnaam en wachtwoord.', true);
    }
  } catch(e) {
    herstel();
    setFout('❌ Verbinding mislukt. Controleer je internetverbinding.');
  }
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
          style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
                 padding:16px 12px;text-align:left;cursor:pointer;box-shadow:var(--shadow);
                 display:flex;flex-direction:column;gap:4px;transition:border-color .15s,background .15s;font-family:'Inter','DM Sans',sans-serif">
          <span style="font-size:.85rem;font-weight:700;color:var(--text);line-height:1.3">${cat}</span>
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
