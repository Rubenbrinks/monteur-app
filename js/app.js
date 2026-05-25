/* ── Emondt Materiaalapp — app.js ──
 * App initialisatie, tab-routing, info opslaan/laden
 */

// ── INIT ──────────────────────────────────────────────────────
window.onload = () => {
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
  // Controleer of al ingelogd (sessie nog actief)
  if (isIngelogd()) {
    document.getElementById('login-scherm').classList.add('verborgen');
    initialiseerApp();
  } else {
    // Focus op gebruikersnaamveld
    setTimeout(() => document.getElementById('login-user').focus(), 100);
  }
};

function initialiseerApp() {
  // Verberg PWA-uitleg als al geïnstalleerd
  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
    const card = document.getElementById('pwa-uitleg-card');
    if (card) card.style.display = 'none';
  }

  laadOpgeslagenIconen();
  loadInfo();
  loadCart();
  // Toon ingelogde gebruiker in drawer
  const sessie = getAuthSessie();
  const accountEl = document.getElementById('drawer-account');
  if (accountEl && sessie) accountEl.textContent = 'Ingelogd als ' + sessie.gebruiker;
  const beheerItem = document.getElementById('drawer-beheer');
  if (beheerItem) beheerItem.style.display = isAdmin() ? '' : 'none';

  // Haal profielgegevens op uit database op basis van ingelogde gebruiker
  if (sessie?.gebruiker) {
    const url = getSheetsUrl();
    const persoon = (() => { try { return JSON.parse(localStorage.getItem('emondt_persoon') || '{}'); } catch(e) { return {}; } })();

    // Als een ander account is ingelogd dan de vorige keer — wis persoonsgegevens
    const vorigeUser = localStorage.getItem('emondt_actieve_user');
    if (vorigeUser && vorigeUser !== sessie.gebruiker) {
      try { localStorage.removeItem('emondt_persoon'); } catch(e) {}
    }
    try { localStorage.setItem('emondt_actieve_user', sessie.gebruiker); } catch(e) {}

    if (url) {
      fetch(`${url}?actie=profiel&gebruiker=${encodeURIComponent(sessie.gebruiker)}&t=${Date.now()}`)
        .then(r => r.json())
        .then(r => {
          if (r.status === 'ok') {
            const huidig = (() => { try { return JSON.parse(localStorage.getItem('emondt_persoon') || '{}'); } catch(e) { return {}; } })();
            try {
              localStorage.setItem('emondt_persoon', JSON.stringify({
                naam:       r.naam       || huidig.naam      || r.gebruiker || '',
                telefoon:   r.telefoon                       || huidig.telefoon   || '',
                ontvanger2: r.email                          || huidig.ontvanger2 || '',
                afdeling:   huidig.afdeling                 || '',
              }));
            } catch(e) {}
            loadInfo();
          }
        })
        .catch(() => {});
    }
  }
  document.getElementById('di-all')?.classList.add('active');
  showTab('welkom');
  laadArtikelenUitSheets();
  // Herstel weergavemodus
  setWeergave(weergaveModus);
  document.getElementById('vrij-sluit-btn').addEventListener('click', sluitVrijArtikel);
  document.getElementById('vrij-overlay').addEventListener('click', function(e) { if (e.target === this) sluitVrijArtikel(); });
  document.getElementById('vrij-toevoegen-btn').addEventListener('click', customArtikelToevoegen);

  // ── SERVICE WORKER: registratie + automatisch updaten ────────
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', {
      updateViaCache: 'none'  // Nooit de SW zelf cachen — altijd vers ophalen
    }).then(reg => {

      // Controleer direct op update bij elke app-open
      reg.update();

      // Luister naar nieuwe SW die beschikbaar komt
      reg.addEventListener('updatefound', () => {
        const nieuweSW = reg.installing;
        if (!nieuweSW) return;
        nieuweSW.addEventListener('statechange', () => {
          if (nieuweSW.state === 'installed' && navigator.serviceWorker.controller) {
            // Nieuwe versie klaar — activeer direct en herlaad
            nieuweSW.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      // Als er al een wachtende SW is bij openen (bijv. tab was open tijdens update)
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

    }).catch(err => console.warn('[SW] Registratie mislukt:', err));

    // Herlaad de pagina zodra de nieuwe SW de controle overneemt
    let herladen = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (herladen) return;
      herladen = true;
      window.location.reload();
    });

    // Toon melding als er een update op de achtergrond is geladen
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'SW_UPDATE_KLAAR') {
        // Niet tonen als we net zelf herladen hebben (bevestigUpdate-flow)
        if (sessionStorage.getItem('emondt_net_bijgewerkt')) return;
        const banner = document.getElementById('update-banner');
        if (banner) banner.style.display = 'flex';
      }
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
  location.reload();
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
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
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
  // Update beide status-elementen (tab-dev en tab-beheer-panel)
  ['sheets-status', 'beheer-status'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  });
}

function testVerbinding() {
  const url = getSheetsUrl();
  if (!url) { setBeheerStatus('<span style="color:var(--danger)">❌ Geen Web App URL ingesteld. Sla eerst een URL op.</span>'); return; }
  setBeheerStatus('<span style="color:var(--muted)">⏳ Verbinding testen...</span>');
  fetch(url + '?actie=lezen&t=' + Date.now())
    .then(r => r.json())
    .then(data => {
      setBeheerStatus(data.status === 'ok'
        ? `<span style="color:green">✅ Verbinding OK — ${data.count} artikelen gevonden.</span>`
        : `<span style="color:var(--danger)">❌ Script fout: ${data.message || JSON.stringify(data)}</span>`);
    })
    .catch(err => setBeheerStatus(`<span style="color:var(--danger)">${corsErrorMsg(err)}</span>`));
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
