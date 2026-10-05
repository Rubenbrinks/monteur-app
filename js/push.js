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

async function updateMeldingKnop() {
  renderMeldingenKaart();
  const el = document.getElementById('drawer-meldingen');
  if (!el) return;
  if (!pushOndersteund()) { el.style.display = 'none'; return; }
  el.style.display = '';

  // "Aan" = toestemming gegeven én er is een actief abonnement.
  let aan = false;
  if (Notification.permission === 'granted') {
    try {
      const reg = await navigator.serviceWorker.ready;
      aan = !!(await reg.pushManager.getSubscription());
    } catch(e) {}
  }

  const label  = document.getElementById('meldingen-label');
  const toggle = document.getElementById('meldingen-toggle');
  if (label)  label.textContent = aan ? 'Meldingen staan aan' : 'Meldingen staan uit';
  if (toggle) toggle.classList.toggle('aan', aan);
  el.onclick = aan ? zetMeldingenUit : zetMeldingenAan;
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

// Kaart op de homepage: alleen zichtbaar zolang meldingen nog niet aan staan.
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
    'ios-installeren': 'Op een iPhone werkt dit alleen als de app op je beginscherm staat. Tik in Safari op Delen, kies "Zet op beginscherm" en tik op Voeg toe. Open de app daarna via het icoon op je beginscherm en zet meldingen aan.',
    'geblokkeerd': 'Meldingen zijn geblokkeerd in de instellingen van je browser of telefoon. Zet ze daar aan voor deze app en kom dan terug.',
  };
  tekst.textContent = teksten[status];
  knop.style.display = status === 'uit' ? '' : 'none';
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
