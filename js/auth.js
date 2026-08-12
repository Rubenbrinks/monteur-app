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

// Komt de gebruiker binnen via een herstellink uit de mail? Supabase zet de
// token in de URL-hash; die moet naar het "nieuw wachtwoord"-scherm leiden en
// niet rechtstreeks de app in.
function _isHerstelLink() {
  return (window.location.hash || '').includes('type=recovery');
}

// Supabase leest de token asynchroon uit de URL en meldt dat via dit event.
sb.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') openNieuwWachtwoordPopup();
});

// Opstartroutine — vervangt de oude synchrone check in app.js.
async function bootAuth() {
  if (_isHerstelLink()) {
    // Wachten op het PASSWORD_RECOVERY-event hierboven; de app niet openen.
    openNieuwWachtwoordPopup();
    return;
  }

  let ingelogd = false;
  try { ingelogd = await checkSupabaseSessie(); } catch(e) { ingelogd = false; }

  if (ingelogd) {
    document.getElementById('login-scherm').classList.add('verborgen');
    initialiseerApp();
  } else {
    try { localStorage.removeItem('emondt_sessie'); } catch(e) {}
    setTimeout(() => document.getElementById('login-user')?.focus(), 100);
  }
}

async function uitloggen() {
  try { await sb.auth.signOut(); } catch(e) {}
  try {
    localStorage.removeItem('emondt_sessie');
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

  btn.textContent = '⏳ Inloggen...';
  btn.disabled = true;
  fout.style.display = 'none';

  const herstel = () => { btn.textContent = 'Inloggen'; btn.disabled = false; };

  try {
    // Eerst de gebruikersnaam opzoeken: alleen zo weten we of er al een
    // wachtwoord bestaat. Pas daarna heeft het zin om er één te vragen.
    const { data: info, error: rpcErr } = await sb.rpc('email_voor_login', { p_gebruikersnaam: user });
    if (rpcErr) { herstel(); toonFout('❌ Verbindingsfout. Probeer opnieuw.'); return; }
    if (!info || info.status === 'onbekend') { herstel(); toonFout('❌ Onbekende gebruikersnaam'); return; }

    if (!info.wachtwoord_ingesteld) {
      herstel();
      openWachtwoordPopup(user, 'Je hebt nog geen wachtwoord aangemaakt, maak hier je wachtwoord aan.');
      return;
    }

    if (!pass) { herstel(); toonFout('❌ Vul je wachtwoord in'); return; }

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
// Wordt alleen geopend vanuit checkLogin, zodra blijkt dat de gebruikersnaam
// wel bestaat maar er nog geen wachtwoord bij hoort.
function openWachtwoordPopup(prefillUser, melding = '') {
  const overlay = document.getElementById('wachtwoord-overlay');
  if (!overlay) return;
  const u = document.getElementById('wm-user');
  if (u && prefillUser) u.value = prefillUser;
  const status = document.getElementById('wm-status');
  if (status) {
    status.textContent = melding;
    status.style.display = melding ? 'block' : 'none';
    status.style.color      = 'var(--green, green)';
    status.style.background = 'var(--green-dim, #f0f7e6)';
  }
  overlay.style.display = 'flex';
  setTimeout(() => {
    (prefillUser ? document.getElementById('wm-email') : document.getElementById('wm-user'))?.focus();
  }, 100);
}

function sluitWachtwoordPopup() {
  const overlay = document.getElementById('wachtwoord-overlay');
  if (overlay) overlay.style.display = 'none';
}

// Popup afbreken en terug naar het inlogscherm.
function terugNaarInloggen() {
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
    status.style.color      = ok ? 'var(--green, green)'      : 'var(--danger, #dc2626)';
    status.style.background = ok ? 'var(--green-dim, #f0f7e6)' : '#fee2e2';
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
        setTimeout(() => { sluitWachtwoordPopup(); document.getElementById('login-user')?.focus(); }, 1800);
        return;
      case 'te_kort':
        herstel(); toonStatus('❌ Kies een wachtwoord van minstens 6 tekens'); return;
      case 'ok':
        // Meteen inloggen met het nieuwe wachtwoord.
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

// ── WACHTWOORD VERGETEN ───────────────────────────────────────
// Stap 1: herstelmail aanvragen op basis van de gebruikersnaam.
function openVergetenPopup() {
  const overlay = document.getElementById('vergeten-overlay');
  if (!overlay) return;
  const status = document.getElementById('vw-status');
  if (status) { status.textContent = ''; status.style.display = 'none'; }
  // Gebruikersnaam overnemen die al op het inlogscherm stond.
  const u = document.getElementById('vw-user');
  if (u) u.value = (document.getElementById('login-user')?.value || '').trim();
  overlay.style.display = 'flex';
  setTimeout(() => document.getElementById('vw-user')?.focus(), 100);
}

function sluitVergetenPopup() {
  const overlay = document.getElementById('vergeten-overlay');
  if (overlay) overlay.style.display = 'none';
  setTimeout(() => document.getElementById('login-user')?.focus(), 100);
}

async function vraagHerstelmailAan() {
  const user   = (document.getElementById('vw-user')?.value || '').trim();
  const status = document.getElementById('vw-status');
  const btn    = document.getElementById('vw-btn');

  const toonStatus = (tekst, ok = false) => {
    status.textContent = tekst;
    status.style.display = 'block';
    status.style.color      = ok ? 'var(--green, green)'       : 'var(--danger, #dc2626)';
    status.style.background = ok ? 'var(--green-dim, #f0f7e6)' : '#fee2e2';
  };

  if (!user) { toonStatus('❌ Vul je gebruikersnaam in'); return; }

  btn.textContent = '⏳ Bezig...';
  btn.disabled = true;
  const herstel = () => { btn.textContent = 'Stuur herstellink'; btn.disabled = false; };

  try {
    // Gebruikersnaam → e-mail, net als bij inloggen. Het adres tonen we niet.
    const { data: info, error } = await sb.rpc('email_voor_login', { p_gebruikersnaam: user });
    if (error) { herstel(); toonStatus('❌ Verbindingsfout. Probeer opnieuw.'); return; }
    if (!info || info.status === 'onbekend') { herstel(); toonStatus('❌ Onbekende gebruikersnaam'); return; }

    // Nog nooit een wachtwoord gehad? Dan is herstellen zinloos — stuur door
    // naar het aanmaakscherm.
    if (!info.wachtwoord_ingesteld) {
      herstel();
      sluitVergetenPopup();
      openWachtwoordPopup(user, 'Je hebt nog geen wachtwoord aangemaakt, maak hier je wachtwoord aan.');
      return;
    }

    const { error: mailErr } = await sb.auth.resetPasswordForEmail(info.email, {
      redirectTo: window.location.origin + window.location.pathname,
    });
    herstel();
    if (mailErr) { toonStatus('❌ Versturen mislukt. Probeer het later opnieuw.'); return; }

    toonStatus('✅ Er is een herstellink verstuurd naar het e-mailadres van dit account. Check ook je spamfolder.', true);
  } catch(e) {
    herstel();
    toonStatus('❌ Verbinding mislukt. Controleer je internetverbinding.');
  }
}

// Stap 2: terug uit de mail — nieuw wachtwoord kiezen.
function openNieuwWachtwoordPopup() {
  const overlay = document.getElementById('nieuwww-overlay');
  if (!overlay || overlay.style.display === 'flex') return;
  sluitVergetenPopup();
  sluitWachtwoordPopup();
  const status = document.getElementById('nw-status');
  if (status) { status.textContent = ''; status.style.display = 'none'; }
  overlay.style.display = 'flex';
  setTimeout(() => document.getElementById('nw-pass')?.focus(), 100);
}

async function slaNieuwWachtwoordOp() {
  const pass   = document.getElementById('nw-pass')?.value  || '';
  const pass2  = document.getElementById('nw-pass2')?.value || '';
  const status = document.getElementById('nw-status');
  const btn    = document.getElementById('nw-btn');

  const toonStatus = (tekst, ok = false) => {
    status.textContent = tekst;
    status.style.display = 'block';
    status.style.color      = ok ? 'var(--green, green)'       : 'var(--danger, #dc2626)';
    status.style.background = ok ? 'var(--green-dim, #f0f7e6)' : '#fee2e2';
  };

  if (pass.length < 6) { toonStatus('❌ Kies een wachtwoord van minstens 6 tekens'); return; }
  if (pass !== pass2)  { toonStatus('❌ De wachtwoorden zijn niet gelijk');          return; }

  btn.textContent = '⏳ Opslaan...';
  btn.disabled = true;
  const herstel = () => { btn.textContent = 'Wachtwoord opslaan'; btn.disabled = false; };

  try {
    const { error } = await sb.auth.updateUser({ password: pass });
    if (error) {
      herstel();
      toonStatus('❌ Opslaan mislukt. De herstellink is mogelijk verlopen — vraag een nieuwe aan.');
      return;
    }

    // Token uit de adresbalk halen zodat een refresh niet opnieuw dit scherm opent.
    try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch(e) {}

    await _laadProfiel();
    herstel();
    document.getElementById('nieuwww-overlay').style.display = 'none';
    document.getElementById('login-scherm').classList.add('verborgen');
    initialiseerApp();
  } catch(e) {
    herstel();
    toonStatus('❌ Verbinding mislukt. Controleer je internetverbinding.');
  }
}
