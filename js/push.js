/* ── Emondt Materiaalapp — push.js ──
 * Pushmeldingen (webpush): toestemming, abonnement opslaan in Supabase.
 */

// Publieke VAPID-sleutel (mag openbaar in de app staan).
const VAPID_PUBLIC_KEY = 'BOy2kTthMB3b_eI952DbESxef1PjS7GUgn3Ahx99uc2n8inqOnayDECk4I9wv2zur8wzgelmINH1rieZSIEark4';

function _urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function pushOndersteund() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function _slaAbonnementOp(sub) {
  const sessie = getAuthSessie();
  if (!sessie?.id) return;
  const json = sub.toJSON();
  try {
    await sb.from('push_abonnementen').upsert({
      user_id:        sessie.id,
      gebruikersnaam: sessie.gebruiker,
      endpoint:       sub.endpoint,
      p256dh:         json.keys.p256dh,
      auth:           json.keys.auth,
    }, { onConflict: 'endpoint' });
  } catch(e) { console.warn('[push] opslaan mislukt', e); }
}

// Stil: als er al toestemming is, zorg dat er een (opgeslagen) abonnement is.
async function syncPushAbonnement() {
  if (!pushOndersteund() || Notification.permission !== 'granted') { updateMeldingKnop(); return; }
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    await _slaAbonnementOp(sub);
  } catch(e) { console.warn('[push] sync mislukt', e); }
  updateMeldingKnop();
}

// Door de gebruiker aangeklikt (een klik is nodig voor de toestemmingsvraag).
async function zetMeldingenAan() {
  if (!pushOndersteund()) { showToast('❌ Meldingen worden niet ondersteund op dit apparaat.'); return; }

  // iOS: pushmeldingen werken alleen als de app op het beginscherm staat.
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS && !standalone) {
    showToast('📲 Zet eerst de app op je beginscherm, dan kun je meldingen aanzetten.');
    return;
  }

  let perm = Notification.permission;
  if (perm === 'default') { try { perm = await Notification.requestPermission(); } catch(e) {} }
  if (perm !== 'granted') { showToast('🔕 Meldingen zijn geblokkeerd — zet ze aan via je browserinstellingen.'); updateMeldingKnop(); return; }

  await syncPushAbonnement();
  showToast('🔔 Meldingen staan aan!');
}

async function zetMeldingenUit() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      try { await sb.from('push_abonnementen').delete().eq('endpoint', sub.endpoint); } catch(e) {}
      await sub.unsubscribe();
    }
  } catch(e) {}
  updateMeldingKnop();
  showToast('🔕 Meldingen uitgezet.');
}

// Schakelaar op de pagina Monteur → Meldingen.
function meldingenSchakelaar() {
  meldingenStatus().then(status => {
    if (status === 'aan') zetMeldingenUit();
    else if (status === 'uit') zetMeldingenAan();
  });
}

// Werkt alles bij wat de status van meldingen laat zien: de kaart op de homepage, de
// pagina Monteur → Meldingen en de regel in het Monteur-menu.
async function updateMeldingKnop() {
  renderMeldingenKaart();
  const status = await meldingenStatus();
  const perm = (typeof Notification !== 'undefined') ? Notification.permission : null;

  const toestemming = {
    'ios-installeren': 'Niet beschikbaar',
    'niet-ondersteund': 'Niet beschikbaar',
  }[status] || ({ granted: 'Toegestaan', denied: 'Geblokkeerd', default: 'Nog niet gevraagd' }[perm] || '—');

  const statusTekst = { 'aan': 'Aan', 'uit': 'Uit', 'geblokkeerd': 'Geblokkeerd', 'ios-installeren': 'Niet beschikbaar', 'niet-ondersteund': 'Niet beschikbaar' }[status];
  const goed = status === 'aan';

  const toggle = document.getElementById('meldingen-toggle');
  if (toggle) {
    toggle.classList.toggle('aan', goed);
    toggle.style.opacity = (status === 'aan' || status === 'uit') ? '' : '.35';
  }
  const stEl = document.getElementById('meldingen-status-tekst');
  if (stEl) { stEl.textContent = statusTekst; stEl.className = 'info-waarde ' + (goed ? 'goed' : 'let-op'); }
  const tmEl = document.getElementById('meldingen-toestemming');
  if (tmEl) { tmEl.textContent = toestemming; tmEl.className = 'info-waarde ' + (perm === 'granted' ? 'goed' : (perm === 'denied' ? 'let-op' : '')); }

  const uitleg = {
    'aan': 'Meldingen staan aan op dit toestel. Je krijgt een melding zodra je bestelling is afgerond.',
    'uit': perm === 'granted'
      ? 'Je hebt toestemming gegeven, maar meldingen staan uit in de app. Zet de schakelaar aan om ze weer te ontvangen.'
      : 'Meldingen staan uit. Zet de schakelaar aan: je telefoon vraagt dan om toestemming.',
    'geblokkeerd': '<strong>Meldingen zijn geblokkeerd.</strong> Zet ze weer aan in de instellingen van je telefoon:<br>• iPhone: Instellingen → Meldingen → deze app → Sta meldingen toe<br>• Android: houd het app-icoon ingedrukt → Info → Meldingen<br>• Browser: tik op het slotje naast de adresbalk → Machtigingen → Meldingen<br>Kom daarna terug naar deze pagina.',
    'ios-installeren': '<strong>Op een iPhone werkt dit alleen als de app op je beginscherm staat.</strong><br>1. Open de app in Safari<br>2. Tik op Deel (onderin, of via het menu ⋯)<br>3. Scroll en kies "Zet op beginscherm"<br>4. Tik op Voeg toe<br>5. Open de app voortaan via het icoon en zet meldingen hier aan.',
    'niet-ondersteund': 'Dit toestel of deze browser ondersteunt geen pushmeldingen.',
  }[status];
  const uitEl = document.getElementById('meldingen-uitleg');
  if (uitEl) uitEl.innerHTML = uitleg;

  // Regel in het Monteur-menu: duidelijk als meldingen nog niet aan staan.
  const sub = document.getElementById('info-meldingen-sub');
  if (sub) sub.innerHTML = '<span class="menu-punt' + (goed ? ' goed' : '') + '"></span>' + (goed ? 'Staan aan' : (status === 'uit' ? 'Staan uit' : statusTekst));
}

// ── ZICHTBAARHEID: hoe komen monteurs aan hun meldingen? ───────
// Toestand van meldingen op dit toestel:
//   aan | uit | geblokkeerd | ios-installeren | niet-ondersteund
async function meldingenStatus() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS && !standalone) return 'ios-installeren';
  if (!pushOndersteund()) return 'niet-ondersteund';
  if (Notification.permission === 'denied') return 'geblokkeerd';
  if (Notification.permission === 'granted') {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (await reg.pushManager.getSubscription()) return 'aan';
    } catch(e) {}
  }
  return 'uit';
}

// Kaart op de homepage. Blijft staan zolang meldingen niet aan staan; alleen op een
// toestel dat geen pushmeldingen kan ontvangen is er niets te doen en verdwijnt hij.
async function renderMeldingenKaart() {
  const kaart = document.getElementById('meldingen-card');
  if (!kaart) return;
  const status = await meldingenStatus();
  const tekst = document.getElementById('meldingen-card-tekst');
  const knop  = document.getElementById('meldingen-card-knop');
  if (status === 'aan' || status === 'niet-ondersteund') { kaart.style.display = 'none'; return; }
  kaart.style.display = '';
  const teksten = {
    'uit': 'Krijg direct een melding zodra je bestelling is afgerond. Zo hoef je niet te wachten of te bellen.',
    'ios-installeren': 'Op een iPhone werkt dit alleen als de app op je beginscherm staat. Bekijk hoe je dat doet.',
    'geblokkeerd': 'Meldingen zijn geblokkeerd voor deze app. Bekijk hoe je ze weer aanzet.',
  };
  tekst.textContent = teksten[status];
  knop.textContent = status === 'uit' ? 'Meldingen aanzetten' : 'Bekijk uitleg';
  knop.style.display = '';
}

// Knop in de kaart: aanzetten kan direct; bij een blokkade volgt de uitleg onder Monteur → Meldingen.
function meldingenKaartKnop() {
  meldingenStatus().then(status => {
    if (status === 'uit') { zetMeldingenAan(); return; }
    showTab('info');
    if (typeof infoOpenSectie === 'function') infoOpenSectie('meldingen');
  });
}

// Op het bevestigingsscherm na een bestelling: het moment waarop de meerwaarde
// duidelijk is. Maximaal 3 keer tonen, zodat het niet gaat irriteren.
async function toonMeldingenTipBijBevestiging() {
  const blok = document.getElementById('bevestiging-meldingen');
  if (!blok) return;
  blok.style.display = 'none';
  let keren = 0;
  try { keren = parseInt(localStorage.getItem('emondt_meldingen_tip') || '0'); } catch(e) {}
  if (keren >= 3) return;
  if (await meldingenStatus() !== 'uit') return;
  try { localStorage.setItem('emondt_meldingen_tip', String(keren + 1)); } catch(e) {}
  blok.style.display = 'block';
}

async function meldingenTipAanzetten() {
  await zetMeldingenAan();
  const blok = document.getElementById('bevestiging-meldingen');
  if (blok && await meldingenStatus() === 'aan') blok.style.display = 'none';
}
