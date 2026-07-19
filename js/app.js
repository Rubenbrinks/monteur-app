/* ── Emondt Materiaalapp — app.js ──
 * App initialisatie, tab-routing, info opslaan/laden
 */

// ── INIT ──────────────────────────────────────────────────────
window.onload = () => {
  // Initialiseer thema-knop labels
  updateThemaKnop();

  // Versienummer alvast tonen (ook op loginpagina)
  if ('serviceWorker' in navigator) {
    caches.keys().then(keys => {
      const swCache = keys.find(k => k.startsWith('emondt-materiaalapp-'));
      if (swCache) {
        ['app-versie-footer', 'app-versie-login'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.textContent = swCache;
        });
      }
    });
  }
  // Sessie controleren via Supabase (async) — toont daarna app of login.
  bootAuth();
};

function initialiseerApp() {
  // Verberg PWA-uitleg als al geïnstalleerd
  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
    const card = document.getElementById('pwa-uitleg-card');
    if (card) card.style.display = 'none';
  }

  // Swipe-down voor bevestiging-overlay (geen _sheetOpen)
  const bSheet = document.querySelector('#bevestiging-overlay > div');
  if (bSheet) _voegSwipeToeToe(bSheet, () => sluitBevestiging(false));

  laadOpgeslagenIconen();
  loadInfo();
  loadCart();
  // Toon ingelogde gebruiker in drawer
  const sessie = getAuthSessie();
  const accountEl = document.getElementById('drawer-account');
  if (accountEl && sessie) accountEl.textContent = 'Ingelogd als ' + sessie.gebruiker;
  const beheerItem = document.getElementById('drawer-beheer');
  if (beheerItem) beheerItem.style.display = isAdmin() ? '' : 'none';

  // Meldingen: knop bijwerken + (indien al toegestaan) abonnement opslaan.
  if (typeof updateMeldingKnop === 'function') updateMeldingKnop();
  if (typeof syncPushAbonnement === 'function') syncPushAbonnement();

  // Profielgegevens komen nu uit Supabase (al opgehaald bij het inloggen via
  // _laadProfiel → emondt_persoon). loadInfo() heeft ze hierboven al ingevuld.
  if (sessie?.gebruiker) {
    try { localStorage.setItem('emondt_actieve_user', sessie.gebruiker); } catch(e) {}
  }
  document.getElementById('di-all')?.classList.add('active');
  showTab('welkom');
  laadArtikelenUitSheets();
  // Herstel weergavemodus
  setWeergave(weergaveModus);
  document.getElementById('vrij-sluit-btn').addEventListener('click', sluitVrijArtikel);
  document.getElementById('vrij-overlay').addEventListener('click', function(e) { if (e.target === this) sluitVrijArtikel(); });
  document.getElementById('vrij-toevoegen-btn').addEventListener('click', customArtikelToevoegen);

  // ── SERVICE WORKER: registratie + update-banner ─────────────
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', {
      updateViaCache: 'none'
    }).then(reg => {

      reg.update();

      const toonUpdateBanner = () => {
        if (sessionStorage.getItem('emondt_net_bijgewerkt')) return;
        const banner = document.getElementById('update-banner');
        if (banner) banner.style.display = 'flex';
      };

      // Nieuwe SW gevonden — toon banner zodra die klaarstaat
      reg.addEventListener('updatefound', () => {
        const nieuweSW = reg.installing;
        if (!nieuweSW) return;
        nieuweSW.addEventListener('statechange', () => {
          if (nieuweSW.state === 'installed' && navigator.serviceWorker.controller) {
            toonUpdateBanner();
          }
        });
      });

      // Al een wachtende SW bij openen (bijv. tab was open tijdens update)
      if (reg.waiting && navigator.serviceWorker.controller) {
        toonUpdateBanner();
      }

    }).catch(err => console.warn('[SW] Registratie mislukt:', err));

    // Herlaad zodra nieuwe SW de controle overneemt
    let herladen = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (herladen) return;
      herladen = true;
      window.location.reload();
    });
  }

  // Toon bevestiging als we net hebben bijgewerkt
  if (sessionStorage.getItem('emondt_net_bijgewerkt')) {
    sessionStorage.removeItem('emondt_net_bijgewerkt');
    setTimeout(() => showToast('✅ App bijgewerkt naar nieuwe versie'), 600);
  }
};

function bevestigUpdate() {
  document.getElementById('update-banner').style.display = 'none';
  sessionStorage.setItem('emondt_net_bijgewerkt', '1');
  try { localStorage.removeItem('emondt_artikelen_ts'); } catch(e) {}
  navigator.serviceWorker.getRegistration().then(reg => {
    if (reg && reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      location.reload();
    }
  });
}


function formatTelefoon(input) {
  let v = input.value.replace(/\D/g, '');
  if (v.length > 10) v = v.slice(0, 10);
  if (v.length > 2)  v = v.slice(0, 2) + '-' + v.slice(2);
  input.value = v;
}

async function slaProfielOp() {
  const sessie = getAuthSessie();
  if (!sessie?.id) { showToast('❌ Niet ingelogd.'); return; }

  const naam     = (document.getElementById('naam')?.value     || '').trim();
  const telefoon = (document.getElementById('telefoon')?.value || '').trim();
  const afdeling = (document.getElementById('afdeling')?.value || '');
  const email    = (document.getElementById('ontvanger2')?.value || '').trim();

  const btn = document.getElementById('profiel-opslaan-btn');
  if (btn) { btn.textContent = '⏳ Opslaan...'; btn.disabled = true; }

  try {
    const { error } = await sb
      .from('profiles')
      .update({ naam, telefoon, afdeling, email })
      .eq('id', sessie.id);
    if (btn) { btn.textContent = 'Opslaan'; btn.disabled = false; }
    if (error) { showToast('❌ ' + (error.message || 'Opslaan mislukt')); return; }
    try {
      const p = JSON.parse(localStorage.getItem('emondt_persoon') || '{}');
      localStorage.setItem('emondt_persoon', JSON.stringify({ ...p, naam, telefoon, afdeling, ontvanger2: email }));
    } catch(e) {}
    showToast('✓ Gegevens opgeslagen');
  } catch(e) {
    if (btn) { btn.textContent = 'Opslaan'; btn.disabled = false; }
    showToast('❌ Verbinding mislukt');
  }
}

// ── OPSLAAN / LADEN ───────────────────────────────────────────

function getInfo() {
  return ['naam','telefoon','afdeling','projectnummer','projectnaam','locatie','ontvanger2','opmerkingen']
    .reduce((o,id) => { const el = document.getElementById(id); if(el) o[id]=el.value; return o; }, {});
}
let _toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('show');
  void t.offsetWidth; // force reflow voor animatie-reset
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

function customArtikelToevoegen() {
  const naam = document.getElementById('custom-naam').value.trim();
  const code = document.getElementById('custom-code').value.trim();
  const qty  = parseInt(document.getElementById('custom-qty').value)||1;
  if (!naam) { alert('Vul een omschrijving in.'); return; }
  customTeller++;
  const customCode = code || ('CUSTOM-'+customTeller);
  if (!ARTIKELEN.find(a=>a.code===customCode)) {
    ARTIKELEN.push({code:customCode,naam,cat:'Diversen',eenheid:'stuk',icon:'📦',custom:true});
  }
  cart[customCode] = qty;
  updateBadge();
  document.getElementById('custom-naam').value = '';
  document.getElementById('custom-code').value = '';
  document.getElementById('custom-qty').value = '1';
  showToast('✓ Toegevoegd aan bestelling');
  sluitVrijArtikel();
  applyFilters();
}

function setBeheerStatus(html) {
  // Update het status-element van het beheerpaneel
  ['beheer-status'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  });
}

async function testVerbinding() {
  setBeheerStatus('<span style="color:var(--muted)">⏳ Verbinding testen...</span>');
  try {
    const { count, error } = await sb
      .from('artikelen')
      .select('*', { count: 'exact', head: true });
    setBeheerStatus(!error
      ? `<span style="color:green">✅ Verbinding met Supabase OK — ${count} artikelen gevonden.</span>`
      : `<span style="color:var(--danger)">❌ Fout: ${error.message}</span>`);
  } catch(err) {
    setBeheerStatus(`<span style="color:var(--danger)">❌ Verbinding mislukt: ${err.message}</span>`);
  }
}

function herlaadArtikelen() {
  setBeheerStatus('<span style="color:var(--muted)">⏳ Artikelen herladen...</span>');
  try {
    localStorage.removeItem('emondt_artikelen_cache');
    localStorage.removeItem('emondt_artikelen_ts');
  } catch(e) {}
  fetchSheets();
}

function testBestellingLog() {
  const url = getSheetsUrl();
  if (!url) { setBeheerStatus('<span style="color:var(--danger)">❌ Geen URL ingesteld.</span>'); return; }
  setBeheerStatus('<span style="color:var(--muted)">⏳ Test bestelling loggen...</span>');
  const testData = {
    datum: new Date().toLocaleString('nl-NL'),
    naam: 'TEST Monteur', telefoon: '0600000000', afdeling: 'Test',
    projectnummer: 'TEST-001', projectnaam: 'Testproject',
    locatie: 'Testlocatie', opmerkingen: 'Dit is een testbestelling',
    items: [{ code: 'TEST-001', naam: 'Testartikel', cat: 'Diversen', eenheid: 'stuk', leverancier: '', qty: 1 }],
  };
  const artikelStr = testData.items.map(i => [i.code, i.qty, i.naam, i.eenheid, i.leverancier].join('×')).join('|');
  const params = new URLSearchParams({
    actie: 'bestelling', datum: testData.datum, naam: testData.naam,
    telefoon: testData.telefoon, afdeling: testData.afdeling,
    projectnummer: testData.projectnummer, projectnaam: testData.projectnaam,
    locatie: testData.locatie, leverdatum: '', opmerkingen: testData.opmerkingen,
    artikelen: artikelStr, totaal: 1, t: Date.now(),
  });
  fetch(`${url}?${params.toString()}`)
    .then(r => r.json())
    .then(r => setBeheerStatus(r.status === 'ok'
      ? '<span style="color:green">✅ Test bestelling gelogd in Sheets!</span>'
      : `<span style="color:var(--danger)">❌ Fout: ${r.message || JSON.stringify(r)}</span>`))
    .catch(err => setBeheerStatus(`<span style="color:var(--danger)">${corsErrorMsg(err)}</span>`));
}
