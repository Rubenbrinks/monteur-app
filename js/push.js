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
