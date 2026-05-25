/* ── Emondt Materiaalapp — config.js ──
 * Configuratie: API URL, iconen, constanten
 */

// ── GOOGLE SHEETS API ────────────────────────────────────────
// Vervang de URL hieronder met jouw Web App URL na deployment
const SHEETS_API_URL = 'https://script.google.com/macros/s/AKfycbzD7_qnECE3nc54PgncGmlE3bckWKHxg6NPMIl4BroWZQdzIjRVEFfE9B0_LHxFOfXy9A/exec';
const ONESIGNAL_APP_ID = 'd7e0a843-4152-4f58-8250-bd7f3da10ba9'; // ← invullen na aanmaken OneSignal account

let ARTIKELEN = [];  // wordt geladen vanuit Google Sheets (of fallback)

// Dynamisch gevuld na laden artikelen
let ICONS = {};

// Standaard iconen als fallback
const ICON_DEFAULTS = {
  'Afvoermaterialen':'🔧','Bevestigingsmateriaal':'🔩','Diversen':'📦',
  'Elektra':'⚡','Isolatie':'🧱','Koeltechnische hulpstukken':'❄️',
  'Koperleiding':'🟠','Tape & Lijmen':'🎗️','Waterzijdig':'💧'
};

// Alle beschikbare emoji-iconen om uit te kiezen
const ICOON_OPTIES = [
  '🔧','🔩','📦','⚡','🧱','❄️','🟠','🎗️','💧','🔨','🪛','🔌','💡',
  '🏗️','🪝','🧲','🔑','🛠️','📐','📏','🪚','⚙️','🔗','🪣','🧪','🔋',
  '🌡️','💨','🔥','❄','🌊','🏭','📦','🗜️','🔒','🪜','🧯','🪤'
];

let cart = {};

function saveCart() {
  try { localStorage.setItem('emondt_cart', JSON.stringify(cart)); } catch(e) {}
}
function loadCart() {
  try {
    const opgeslagen = localStorage.getItem('emondt_cart');
    if (opgeslagen) cart = JSON.parse(opgeslagen);
  } catch(e) {}
  updateBadge();
}
let activeCat = null;
let activeSubcat = null;
let activeSubsubcat = null;
let weergaveModus = localStorage.getItem('weergave_modus') || 'a';

function setWeergave(modus) {
  weergaveModus = modus;
  try { localStorage.setItem('weergave_modus', modus); } catch(e){}

  // Update weergave-knop actief
  document.querySelectorAll('.weergave-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('wbtn-a')?.classList.toggle('active', modus === 'a');
  document.getElementById('wbtn-b')?.classList.toggle('active', modus !== 'a');

  // Update checkmarks in keuze-overlay
  ['a','b','c'].forEach(m => {
    const el = document.getElementById('wkeuze-' + m);
    const check = document.getElementById('wkeuze-' + m + '-check');
    if (el) el.style.borderColor = modus === m ? '#639922' : '';
    if (check) check.style.display = modus === m ? 'block' : 'none';
  });

  applyFilters();

  // Herrender alles-body als die open staat
  const allesBody = document.getElementById('alles-body');
  if (allesBody && allesBody.style.display !== 'none') {
    allesBody.innerHTML = '';
    const cats = [...new Set(ARTIKELEN.map(a => a.cat))];
    cats.forEach(cat => {
      const catItems = ARTIKELEN.filter(a => a.cat === cat);
      const kop = document.createElement('div');
      kop.className = 'cat-label';
      kop.style.marginBottom = '4px';
      kop.textContent = cat;
      allesBody.appendChild(kop);
      const blok = document.createElement('div');
      blok.className = 'artikel-blok';
      catItems.forEach(a => renderArtikelCard(a, blok));
      allesBody.appendChild(blok);
    });
  }
}

function openWeergaveKeuze() {
  const overlay = document.getElementById('weergave-overlay');
  if (overlay) overlay.style.display = 'flex';
  // Markeer actieve modus
  ['a','b','c'].forEach(m => {
    const el    = document.getElementById('wkeuze-' + m);
    const check = document.getElementById('wkeuze-' + m + '-check');
    if (el) el.style.borderColor = weergaveModus === m ? '#639922' : '';
    if (check) check.style.display = weergaveModus === m ? 'block' : 'none';
  });
}

function sluitWeergaveKeuze() {
  const overlay = document.getElementById('weergave-overlay');
  if (overlay) overlay.style.display = 'none';
}
