/* ── Emondt Materiaalapp — fotos.js ──
 * Foto's bij een bestelling: kiezen, verkleinen, titel geven, uploaden naar de
 * privé-bucket 'bestelfotos' en bekijken. De bestelling bewaart per foto het pad
 * en de titel (kolom bestellingen.fotos); de mail krijgt een knop naar fotos.html.
 * Foto's worden na FOTO_DAGEN automatisch gewist (functie fotos-opruimen).
 */

const FOTO_BUCKET = 'bestelfotos';
const FOTO_MAX    = 5;     // per bestelling
const FOTO_DAGEN  = 7;     // moet gelijk zijn aan FOTO_DAGEN van de functie fotos-opruimen
const FOTO_ZIJDE  = 1600;  // langste zijde in pixels na verkleinen
const FOTO_KWALITEIT = 0.72;

let _bestelFotos = [];     // { blob, url, titel }

function _escF(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Een telefoonfoto van 4 tot 8 MB wordt een JPEG van ongeveer 200 tot 400 KB.
async function _verkleinFoto(file) {
  let bron, breed, hoog;
  try {
    bron = await createImageBitmap(file, { imageOrientation: 'from-image' });
    breed = bron.width; hoog = bron.height;
  } catch (e) {
    // Oudere browsers: via een <img>.
    bron = await new Promise((ok, fout) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => fout(new Error('Foto kon niet gelezen worden'));
      img.src = URL.createObjectURL(file);
    });
    breed = bron.naturalWidth; hoog = bron.naturalHeight;
  }
  const schaal = Math.min(1, FOTO_ZIJDE / Math.max(breed, hoog));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(breed * schaal));
  canvas.height = Math.max(1, Math.round(hoog * schaal));
  canvas.getContext('2d').drawImage(bron, 0, 0, canvas.width, canvas.height);
  if (bron.close) bron.close();
  const blob = await new Promise(ok => canvas.toBlob(ok, 'image/jpeg', FOTO_KWALITEIT));
  if (!blob) throw new Error('Foto kon niet verkleind worden');
  return blob;
}

async function fotosToegevoegd(input) {
  const bestanden = [...(input.files || [])];
  input.value = '';   // dezelfde foto opnieuw kunnen kiezen
  let afgewezen = 0;
  for (const f of bestanden) {
    if (_bestelFotos.length >= FOTO_MAX) { afgewezen++; continue; }
    try {
      const blob = await _verkleinFoto(f);
      _bestelFotos.push({ blob, url: URL.createObjectURL(blob), titel: '' });
      renderBestelFotos();
    } catch (e) {
      showToast('⚠️ ' + (e.message || 'Foto toevoegen mislukt'));
    }
  }
  if (afgewezen) showToast(`📷 Maximaal ${FOTO_MAX} foto's per bestelling.`);
}

function bestelFotoAantal() { return _bestelFotos.length; }

function renderBestelFotos() {
  const lijst = document.getElementById('foto-lijst');
  if (!lijst) return;
  lijst.innerHTML = _bestelFotos.map((f, i) => `
    <div class="foto-rij">
      <img src="${f.url}" alt="" class="foto-mini" />
      <div class="foto-rij-info">
        <input type="text" maxlength="60" placeholder="Titel (bijv. 'Leiding bij ketel')" value="${_escF(f.titel)}"
          oninput="_bestelFotos[${i}].titel = this.value" />
      </div>
      <button class="del-btn" onclick="verwijderBestelFoto(${i})" aria-label="Foto verwijderen">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>`).join('');
  const teller = document.getElementById('foto-teller');
  if (teller) teller.textContent = _bestelFotos.length ? `(${_bestelFotos.length})` : '';
  const knop = document.getElementById('foto-knop');
  if (knop) knop.style.display = _bestelFotos.length >= FOTO_MAX ? 'none' : '';
  // Het uitklapblok houdt een vaste hoogte aan; meegroeien met de inhoud.
  const kaart = document.getElementById('cart-fotos-card');
  const body = kaart?.querySelector('.inklapbaar-body');
  if (kaart?.classList.contains('inklapbaar-open') && body) body.style.maxHeight = body.scrollHeight + 'px';
}

function verwijderBestelFoto(i) {
  const f = _bestelFotos[i];
  if (f) URL.revokeObjectURL(f.url);
  _bestelFotos.splice(i, 1);
  renderBestelFotos();
}

function wisBestelFotos() {
  _bestelFotos.forEach(f => URL.revokeObjectURL(f.url));
  _bestelFotos = [];
  renderBestelFotos();
}

// Uploadt de gekozen foto's naar <gebruikers-id>/<willekeurige naam>.jpg.
// Bij een fout worden al geüploade foto's weer verwijderd en volgt een fout.
async function uploadBestelFotos(userId) {
  if (!userId) throw new Error('Niet ingelogd');
  const klaar = [];
  try {
    for (let i = 0; i < _bestelFotos.length; i++) {
      showToast(`📷 Foto ${i + 1} van ${_bestelFotos.length} uploaden...`);
      const pad = `${userId}/${(crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + i)}.jpg`;
      const { error } = await sb.storage.from(FOTO_BUCKET).upload(pad, _bestelFotos[i].blob, { contentType: 'image/jpeg' });
      if (error) throw new Error(error.message);
      klaar.push({ pad, titel: (_bestelFotos[i].titel || '').trim().slice(0, 60) });
    }
  } catch (e) {
    await verwijderUploads(klaar.map(k => k.pad));
    throw e;
  }
  return klaar;
}

async function verwijderUploads(paden) {
  if (!paden || !paden.length) return;
  try { await sb.storage.from(FOTO_BUCKET).remove(paden); } catch (e) {}
}

// ── Bekijken (monteur: eigen bestellingen; beheerder: alle) ───
function fotosVerlopen(aangemaaktOp) {
  const t = Date.parse(aangemaaktOp);
  return !isNaN(t) && (Date.now() - t) >= FOTO_DAGEN * 24 * 3600 * 1000;
}

async function toonBestelFotos(fotos, titel) {
  const overlay = document.getElementById('foto-overlay');
  const inhoud = document.getElementById('foto-venster-inhoud');
  document.getElementById('foto-venster-titel').textContent = titel || "Foto's";
  inhoud.innerHTML = '<div class="home-leeg">⏳ Laden...</div>';
  overlay.style.display = 'flex';
  try {
    const { data, error } = await sb.storage.from(FOTO_BUCKET).createSignedUrls((fotos || []).map(f => f.pad), 3600);
    if (error) throw new Error(error.message);
    const perPad = new Map((data || []).map(d => [d.path, d.signedUrl]));
    const rijen = (fotos || []).map(f => ({ titel: f.titel || '', url: perPad.get(f.pad) })).filter(r => r.url);
    inhoud.innerHTML = rijen.length ? rijen.map(r => `
      <a href="${r.url}" target="_blank" rel="noopener" class="foto-groot">
        <img src="${r.url}" alt="${_escF(r.titel)}" />
        ${r.titel ? `<span>${_escF(r.titel)}</span>` : ''}
      </a>`).join('') : `<div class="home-leeg">De foto's zijn niet meer beschikbaar (ze worden na ${FOTO_DAGEN} dagen gewist).</div>`;
  } catch (e) {
    inhoud.innerHTML = '<div class="home-leeg">Foto\'s laden mislukt: ' + _escF(e.message) + '</div>';
  }
}

function sluitBestelFotos() {
  document.getElementById('foto-overlay').style.display = 'none';
  document.getElementById('foto-venster-inhoud').innerHTML = '';
}
