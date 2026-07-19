/* ── Emondt Materiaalapp — auth.js ──
 * Authenticatie via Supabase: inloggen (gebruikersnaam + wachtwoord),
 * sessiebeheer en het eenmalig aanmaken van een wachtwoord.
 */

// In-memory sessie (voor snelle, synchrone toegang door de rest van de app).
let _sessie = null; // { id, gebruiker, rol, email, naam }

function getAuthSessie() {
  if (_sessie) return _sessie;
  try { return JSON.parse(localStorage.getItem('emondt_sessie') || 'null'); } catch(e) { return null; }
}

function isIngelogd() {
  return !!getAuthSessie();
}

function isAdmin() {
  return getAuthSessie()?.rol === 'admin';
}

// Profiel (gebruikersnaam, rol, naam, ...) ophalen uit Supabase en cachen.
async function _laadProfiel() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) { _sessie = null; return null; }

  const { data, error } = await sb
    .from('profiles')
    .select('gebruikersnaam, naam, rol, email, telefoon, afdeling')
    .eq('id', user.id)
    .single();
  if (error || !data) return null;

  _sessie = {
    id:       user.id,
    gebruiker: data.gebruikersnaam,
    rol:      data.rol,
    email:    data.email,
    naam:     data.naam,
  };
  try { localStorage.setItem('emondt_sessie', JSON.stringify(_sessie)); } catch(e) {}

  // Persoonsgegevens cachen zodat de rest van de app (info-velden) ze meteen heeft.
  try {
    localStorage.setItem('emondt_persoon', JSON.stringify({
      naam:       data.naam     || data.gebruikersnaam || '',
      telefoon:   data.telefoon || '',
      afdeling:   data.afdeling || '',
      ontvanger2: data.email    || '',
    }));
  } catch(e) {}

  return _sessie;
}

// Bij het opstarten: is er een geldige sessie? (async)
async function checkSupabaseSessie() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return false;
  const p = await _laadProfiel();
  return !!p;
}

// Opstartroutine — vervangt de oude synchrone check in app.js.
async function bootAuth() {
  let ingelogd = false;
  try { ingelogd = await checkSupabaseSessie(); } catch(e) { ingelogd = false; }

  if (ingelogd) {
    document.getElementById('login-scherm').classList.add('verborgen');
    initialiseerApp();
  } else {
    try { localStorage.removeItem('emondt_sessie'); } catch(e) {}
    toonWachtwoordPopupIndienNodig();
    setTimeout(() => document.getElementById('login-user')?.focus(), 100);
  }
}

async function uitloggen() {
  try { await sb.auth.signOut(); } catch(e) {}
  try {
    localStorage.removeItem('emondt_sessie');
    sessionStorage.removeItem('beheer_auth');
  } catch(e) {}
  location.reload();
}

// ── INLOGGEN (gebruikersnaam + wachtwoord) ────────────────────
async function checkLogin() {
  const userEl = document.getElementById('login-user');
  const passEl = document.getElementById('login-pass');
  const fout   = document.getElementById('login-fout');
  const btn    = document.querySelector('#login-box-inloggen .btn-primary');

  const user = (userEl?.value || '').trim();
  const pass = passEl?.value || '';

  const toonFout = (tekst) => {
    fout.textContent = tekst;
    fout.style.display = 'block';
    setTimeout(() => { fout.style.display = 'none'; }, 5000);
  };

  if (!user) { toonFout('❌ Vul je gebruikersnaam in'); return; }
  if (!pass) { toonFout('❌ Vul je wachtwoord in');     return; }

  btn.textContent = '⏳ Inloggen...';
  btn.disabled = true;
  fout.style.display = 'none';

  const herstel = () => { btn.textContent = 'Inloggen'; btn.disabled = false; };

  try {
    // Gebruikersnaam → e-mail opzoeken.
    const { data: info, error: rpcErr } = await sb.rpc('email_voor_login', { p_gebruikersnaam: user });
    if (rpcErr) { herstel(); toonFout('❌ Verbindingsfout. Probeer opnieuw.'); return; }
    if (!info || info.status === 'onbekend') { herstel(); toonFout('❌ Onbekende gebruikersnaam'); return; }

    if (!info.wachtwoord_ingesteld) {
      herstel();
      openWachtwoordPopup(user);
      return;
    }

    const { error: loginErr } = await sb.auth.signInWithPassword({ email: info.email, password: pass });
    if (loginErr) { herstel(); toonFout('❌ Onjuist wachtwoord'); return; }

    await _laadProfiel();
    herstel();
    if (passEl) passEl.value = '';
    document.getElementById('login-scherm').classList.add('verborgen');
    initialiseerApp();
  } catch(e) {
    herstel();
    toonFout('❌ Verbinding mislukt. Controleer je internetverbinding.');
  }
}

// ── WACHTWOORD AANMAKEN (eenmalig, voor bestaande monteurs) ────
function toonWachtwoordPopupIndienNodig() {
  // Alleen automatisch tonen zolang op dit apparaat nog geen wachtwoord is gemaakt.
  if (localStorage.getItem('emondt_ww_aangemaakt') === '1') return;
  openWachtwoordPopup('');
}

function openWachtwoordPopup(prefillUser) {
  const overlay = document.getElementById('wachtwoord-overlay');
  if (!overlay) return;
  const u = document.getElementById('wm-user');
  if (u && prefillUser) u.value = prefillUser;
  const status = document.getElementById('wm-status');
  if (status) { status.textContent = ''; status.style.display = 'none'; }
  overlay.style.display = 'flex';
  setTimeout(() => {
    (prefillUser ? document.getElementById('wm-email') : document.getElementById('wm-user'))?.focus();
  }, 100);
}

function sluitWachtwoordPopup() {
  const overlay = document.getElementById('wachtwoord-overlay');
  if (overlay) overlay.style.display = 'none';
}

// "Ik heb al een wachtwoord" — popup sluiten en niet meer automatisch tonen.
function ikHebAlWachtwoord() {
  try { localStorage.setItem('emondt_ww_aangemaakt', '1'); } catch(e) {}
  sluitWachtwoordPopup();
  setTimeout(() => document.getElementById('login-user')?.focus(), 100);
}

async function maakWachtwoordAan() {
  const user  = (document.getElementById('wm-user')?.value  || '').trim();
  const email = (document.getElementById('wm-email')?.value || '').trim();
  const pass  = document.getElementById('wm-pass')?.value  || '';
  const pass2 = document.getElementById('wm-pass2')?.value || '';
  const status = document.getElementById('wm-status');
  const btn    = document.getElementById('wm-btn');

  const toonStatus = (tekst, ok = false) => {
    status.textContent = tekst;
    status.style.display = 'block';
    status.style.color = ok ? 'var(--green, green)' : 'var(--danger, #dc2626)';
  };

  if (!user)  { toonStatus('❌ Vul je gebruikersnaam in'); return; }
  if (!email) { toonStatus('❌ Vul je e-mailadres in');    return; }
  if (pass.length < 6) { toonStatus('❌ Kies een wachtwoord van minstens 6 tekens'); return; }
  if (pass !== pass2)  { toonStatus('❌ De wachtwoorden zijn niet gelijk');          return; }

  btn.textContent = '⏳ Bezig...';
  btn.disabled = true;
  const herstel = () => { btn.textContent = 'Wachtwoord aanmaken'; btn.disabled = false; };

  try {
    const { data, error } = await sb.rpc('stel_wachtwoord_in', {
      p_gebruikersnaam: user, p_email: email, p_wachtwoord: pass,
    });
    if (error) { herstel(); toonStatus('❌ Verbindingsfout. Probeer opnieuw.'); return; }

    switch (data?.status) {
      case 'onbekend':
        herstel(); toonStatus('❌ Deze gebruikersnaam kennen we niet.'); return;
      case 'email_klopt_niet':
        herstel(); toonStatus('❌ Dit e-mailadres hoort niet bij deze gebruikersnaam.'); return;
      case 'al_ingesteld':
        herstel();
        toonStatus('ℹ️ Er is al een wachtwoord aangemaakt. Log gewoon in.', true);
        try { localStorage.setItem('emondt_ww_aangemaakt', '1'); } catch(e) {}
        setTimeout(() => { sluitWachtwoordPopup(); document.getElementById('login-user')?.focus(); }, 1800);
        return;
      case 'te_kort':
        herstel(); toonStatus('❌ Kies een wachtwoord van minstens 6 tekens'); return;
      case 'ok':
        // Meteen inloggen met het nieuwe wachtwoord.
        try { localStorage.setItem('emondt_ww_aangemaakt', '1'); } catch(e) {}
        const { error: loginErr } = await sb.auth.signInWithPassword({ email: data.email, password: pass });
        if (loginErr) {
          herstel();
          toonStatus('✅ Wachtwoord aangemaakt! Log nu in met je gebruikersnaam en wachtwoord.', true);
          setTimeout(() => { sluitWachtwoordPopup(); document.getElementById('login-user').value = user; document.getElementById('login-pass')?.focus(); }, 1800);
          return;
        }
        await _laadProfiel();
        sluitWachtwoordPopup();
        document.getElementById('login-scherm').classList.add('verborgen');
        initialiseerApp();
        return;
      default:
        herstel(); toonStatus('❌ Onbekende fout. Probeer opnieuw.'); return;
    }
  } catch(e) {
    herstel();
    toonStatus('❌ Verbinding mislukt. Controleer je internetverbinding.');
  }
}
