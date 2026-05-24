/* ── Emondt Materiaalapp — cart.js ──
 * Winkelwagen, bestelling versturen, bestelhistorie
 */

// ── WINKELWAGEN ───────────────────────────────────────────────
function renderCart() {
  const el = document.getElementById('cart-content');
  const items = Object.entries(cart);
  if (!items.length) {
    el.innerHTML = `<div class="empty-cart">
      <svg width="54" height="54" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
      </svg>
      <p>Geen artikelen geselecteerd.<br>Ga naar <strong>Artikelen</strong> om te beginnen.</p>
    </div>`;
    document.getElementById('cart-samenvatting').style.display = 'none';
    document.getElementById('cart-actie-btns').style.display = 'none';
    return;
  }
  document.getElementById('cart-samenvatting').style.display = 'block';
  document.getElementById('cart-actie-btns').style.display = 'block';
  let html = '<div class="cart-items-wrap">', totaal = 0;
  items.forEach(([code, qty]) => {
    const a = ARTIKELEN.find(x => x.code === code); if (!a) return;
    totaal += qty;
    html += `<div class="cart-item">
      <div class="cart-badge">${qty}</div>
      <div class="cart-info">
        <div class="cart-naam">${a.naam}</div>
        <div class="cart-code">${a.code}${a.leverancier ? ' · ' + a.leverancier : ''} · per ${a.eenheid}</div>
      </div>
      <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
        <button onclick="changeCartQty('${code}',-1)" style="width:30px;height:30px;border:1.5px solid var(--border);border-radius:7px;background:var(--bg);color:var(--navy);font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:700">−</button>
        <input type="number" min="0" step="${(()=>{const m=String(a.eenheid||'').match(/^(\d+)/);return m?m[1]:'1'})()}" value="${qty}" onchange="changeCartQty('${code}',0,this.value)" oninput="autoSizeQty(this)" style="height:30px;text-align:center;border:1.5px solid var(--border);border-radius:7px;font-family:'DM Sans',sans-serif;font-size:.85rem;font-weight:700;color:var(--navy);background:var(--bg);outline:none;-moz-appearance:textfield;min-width:34px;width:${Math.max(3,String(qty).length+1)}ch;padding:0 4px" />
        <button onclick="changeCartQty('${code}',1)" style="width:30px;height:30px;border:1.5px solid var(--border);border-radius:7px;background:var(--bg);color:var(--navy);font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:700">+</button>
      </div>
      <button class="del-btn" onclick="removeItem('${code}')">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>`;
  });
  html += '</div>';
  // Leverdatum: morgen als minimum, weekenden uitschakelen
  const today = new Date();
  const opgeslagenDatum = (() => { try { return localStorage.getItem('leverdatum') || ''; } catch(e){ return ''; } })();
  // Initialiseer statisch leverdatum-veld
  const ldStatic = document.getElementById('leverdatum-static');
  if (ldStatic) {
    const morgen = new Date(today);
    morgen.setDate(today.getDate() + 1);
    while (morgen.getDay() === 0 || morgen.getDay() === 6) morgen.setDate(morgen.getDate() + 1);
    const minStr = morgen.toISOString().split('T')[0];
    ldStatic.min = minStr;
    // Valideer opgeslagen datum — wis als in het verleden of weekend
    const vandaag = today.toISOString().split('T')[0];
    const dag = opgeslagenDatum ? new Date(opgeslagenDatum + 'T12:00:00').getDay() : -1;
    const ongeldig = !opgeslagenDatum || opgeslagenDatum <= vandaag || dag === 0 || dag === 6;
    ldStatic.value = ongeldig ? '' : opgeslagenDatum;
    if (ongeldig && opgeslagenDatum) {
      try { localStorage.removeItem('leverdatum'); } catch(e){}
    }
  }

  el.innerHTML = html;
  // Update samenvatting onderaan
  const inf = getInfo();
  const opgeslagenDatum2 = (() => { try { return localStorage.getItem('leverdatum') || ''; } catch(e){ return ''; } })();
  const leverdatumTxt = opgeslagenDatum2
    ? new Date(opgeslagenDatum2 + 'T12:00:00').toLocaleDateString('nl-NL', {day:'2-digit',month:'2-digit',year:'numeric'})
    : '—';
  const sumEl = document.getElementById('cart-samenvatting');
  if (sumEl) sumEl.innerHTML = `
    <div class="s-row"><span>Monteur</span><span>${inf.naam||'—'}</span></div>
    <div class="s-row"><span>Project</span><span>${inf.projectnummer ? inf.projectnummer + (inf.projectnaam?' · '+inf.projectnaam:'') : (inf.projectnaam||'—')}</span></div>
    <div class="s-row"><span>Afleveradres</span><span>${inf.locatie||'—'}</span></div>
    <div class="s-row"><span>Leverdatum</span><span>${leverdatumTxt}</span></div>
    <div class="s-row total"><span>Totaal</span><span>${totaal} stuks</span></div>`;
  // Herstel zichtbaarheid installatieknop na render
  if (deferredInstallPrompt && !window.matchMedia('(display-mode: standalone)').matches && !window.navigator.standalone) {
    setPwaKnopZichtbaar(true);
  }
}

function updateCartSamenvatting() {
  const items = Object.entries(cart).filter(([,q]) => q > 0);
  const sumEl = document.getElementById('cart-samenvatting');
  const actieEl = document.getElementById('cart-actie-btns');
  if (!sumEl) return;

  if (!items.length) {
    sumEl.style.display = 'none';
    if (actieEl) actieEl.style.display = 'none';
    return;
  }

  sumEl.style.display = 'block';
  if (actieEl) actieEl.style.display = 'block';

  const inf = getInfo();
  const totaal = items.reduce((s, [,q]) => s + q, 0);
  const leverdatum = localStorage.getItem('leverdatum') || '';
  const leverdatumTxt = leverdatum
    ? new Date(leverdatum + 'T12:00:00').toLocaleDateString('nl-NL', {day:'2-digit',month:'2-digit',year:'numeric'})
    : '—';

  sumEl.innerHTML = `
    <div class="s-row"><span>Monteur</span><span>${inf.naam||'—'}</span></div>
    <div class="s-row"><span>Project</span><span>${inf.projectnummer ? inf.projectnummer + (inf.projectnaam?' · '+inf.projectnaam:'') : (inf.projectnaam||'—')}</span></div>
    <div class="s-row"><span>Afleveradres</span><span>${inf.locatie||'—'}</span></div>
    <div class="s-row"><span>Leverdatum</span><span>${leverdatumTxt}</span></div>
    <div class="s-row total"><span>Totaal</span><span>${totaal} stuks</span></div>`;
}

function saveInfo() {
  const inf = getInfo();
  // Alleen persoonsgegevens bewaren (niet project/locatie)
  try { localStorage.setItem('emondt_persoon', JSON.stringify({ naam: inf.naam, telefoon: inf.telefoon, afdeling: inf.afdeling, ontvanger2: inf.ontvanger2 })); } catch(e){}
  updateCartSamenvatting();
}

function loadInfo() {
  try { localStorage.removeItem('emondt_info'); } catch(e){}
  try {
    // Persoonsgegevens laden — eerst uit account-sessie, daarna localStorage
    const sessie  = getAuthSessie();
    const persoon = JSON.parse(localStorage.getItem('emondt_persoon') || '{}');

    // Naam: voorrang aan opgeslagen naam, anders accountnaam
    const naam = persoon.naam || sessie?.gebruiker || '';
    if (naam) { const el = document.getElementById('naam'); if (el) el.value = naam; }
    if (persoon.telefoon)   { const el = document.getElementById('telefoon');   if (el) el.value = persoon.telefoon; }
    if (persoon.afdeling)   { const el = document.getElementById('afdeling');   if (el) el.value = persoon.afdeling; }
    if (persoon.ontvanger2) { const el = document.getElementById('ontvanger2'); if (el) el.value = persoon.ontvanger2; }

    // Project/locatie/leverdatum NIET laden — worden gewist na elke bestelling
  } catch(e){}
}

function kiesLocatie(sel) {
  const input = document.getElementById('locatie');
  if (!input) return;
  if (sel.value === 'vrij') {
    input.style.display = 'block';
    input.focus();
  } else {
    input.style.display = 'none';
    input.value = sel.value;
  }
  saveInfo();
}

function kiesLeverdatum(input) {
  const waarschuwing = document.getElementById('leverdatum-waarschuwing');
  const tekst = document.getElementById('leverdatum-waarschuwing-tekst');

  if (!input.value) {
    if (waarschuwing) waarschuwing.style.display = 'none';
    return;
  }

  // Vergelijk datums als strings om tijdzone-problemen te vermijden
  const gekozen = input.value; // "YYYY-MM-DD"
  const nu = new Date();
  const vandaag = nu.toISOString().split('T')[0];

  const d = new Date(gekozen + 'T12:00:00');
  const dag = d.getDay(); // 0=zo, 6=za

  let fout = null;
  if (gekozen <= vandaag) {
    fout = 'Kies een datum vanaf morgen — vandaag en eerdere datums zijn niet geldig.';
  } else if (dag === 6) {
    fout = 'Zaterdag is geen werkdag. Kies een datum van maandag t/m vrijdag.';
  } else if (dag === 0) {
    fout = 'Zondag is geen werkdag. Kies een datum van maandag t/m vrijdag.';
  }

  if (fout) {
    if (waarschuwing) { tekst.textContent = fout; waarschuwing.style.display = 'block'; }
    input.setCustomValidity(fout);
    input.value = '';
    try { localStorage.removeItem('leverdatum'); } catch(e){}
  } else {
    if (waarschuwing) waarschuwing.style.display = 'none';
    input.setCustomValidity('');
    try { localStorage.setItem('leverdatum', gekozen); } catch(e){}
  }
}

function changeCartQty(code, delta, directValue) {
  const stap = getStap(code);
  let nieuw;
  if (directValue !== undefined) {
    nieuw = Math.max(0, parseInt(directValue) || 0);
    if (stap > 1 && nieuw > 0) nieuw = rondeOpStap(nieuw, stap);
  } else {
    const huidig = cart[code] || 0;
    nieuw = delta > 0 ? (huidig === 0 ? stap : huidig + stap) : Math.max(0, huidig - stap);
  }
  _setCart(code, nieuw);
  renderCart();
}

function removeItem(code) {
  delete cart[code];
  const qEl = document.getElementById('qty-' + code);
  const cEl = document.getElementById('card-' + code);
  if (qEl) qEl.value = 0;
  if (cEl) cEl.classList.remove('selected');
  updateBadge(); renderCart();
}

function leegMaken() {
  if (!confirm('Hele bestelling wissen?')) return;
  cart = {};
  try { localStorage.removeItem('emondt_cart'); } catch(e){}
  document.querySelectorAll('.qty-val').forEach(el => el.value = 0);
  document.querySelectorAll('.artikel-card').forEach(el => el.classList.remove('selected'));
  updateBadge(); renderCart();
}


// ── E-MAIL ────────────────────────────────────────────────────
function verstuurEmail() {
  const inf = getInfo();
  const items = Object.entries(cart);
  if (!items.length) { alert('Voeg eerst artikelen toe.'); return; }

  let leverdatum = '';
  try { leverdatum = localStorage.getItem('leverdatum') || ''; } catch(e){}

  const verplicht = [
    {id:'naam',label:'Naam',tab:'info'},{id:'afdeling',label:'Afdeling',tab:'info'},
    {id:'projectnaam',label:'Projectnaam',tab:'winkelwagen'},{id:'locatie',label:'Afleveradres',tab:'winkelwagen'},
    {id:'telefoon',label:'Telefoonnummer',tab:'info'},
  ];
  for (const v of verplicht) {
    if (!inf[v.id]||inf[v.id].trim()==='') {
      alert(`Vul het verplichte veld "${v.label}" in.`); showTab(v.tab);
      const el = document.getElementById(v.id); if(el) el.focus(); return;
    }
  }

  // ── Leverdatum verplicht ──────────────────────────────────
  if (!leverdatum) {
    alert('Kies een gewenste leverdatum.');
    showTab('winkelwagen');
    return;
  }

  // ── Waarschuwing na 14:00 ─────────────────────────────────
  const nu = new Date();
  const uur = nu.getHours();
  const minuut = nu.getMinutes();
  if (uur >= 14) {
    const tijdStr = `${String(uur).padStart(2,'0')}:${String(minuut).padStart(2,'0')}`;
    if (!confirm(`⚠️ Let op: het is nu ${tijdStr}

Bestellingen die na 14:00 binnenkomen worden verwerkt op de volgende werkdag.

Wil je toch versturen?`)) return;
  }

  const datum = new Date().toLocaleDateString('nl-NL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const projref = inf.projectnummer || inf.projectnaam || '';
  const subject = `Materiaal bestellen${projref?' '+projref:''}${inf.projectnaam?' – '+inf.projectnaam:''} – ${inf.naam||'monteur'} – ${datum}`;

  // ── Bouw e-mailbody (platte tekst) ────────────────────────
  const cats = [...new Set(items.map(([code]) => ARTIKELEN.find(x=>x.code===code)?.cat).filter(Boolean))];
  let body = `MATERIAAL BESTELLEN – EMONDT GROEP
${'='.repeat(46)}

`;
  body += `Datum:           ${datum}
`;
  if (leverdatum) body += `Leverdatum:      ${new Date(leverdatum).toLocaleDateString('nl-NL',{day:'2-digit',month:'2-digit',year:'numeric'})}
`;
  body += `Monteur:         ${inf.naam||'—'}
`;
  if (inf.telefoon) body += `Telefoon:        ${inf.telefoon}
`;
  body += `Afdeling:        ${inf.afdeling||'—'}
`;
  body += `Projectnummer:   ${inf.projectnummer||'—'}
`;
  body += `Projectnaam:     ${inf.projectnaam||'—'}
`;
  body += `Afleveradres:    ${inf.locatie||'—'}

`;
  body += `GEVRAAGDE ARTIKELEN
${'─'.repeat(46)}
`;
  let totaal = 0;
  const artikelItems = [];
  cats.forEach(cat => {
    body += `
[ ${cat.toUpperCase()} ]
`;
    items.forEach(([code, qty]) => {
      const a = ARTIKELEN.find(x=>x.code===code);
      if (!a || a.cat !== cat) return;
      totaal += qty;
      artikelItems.push({ code: a.code, naam: a.naam, cat: a.cat, eenheid: a.eenheid || 'stuk', leverancier: a.leverancier || '', qty });
      const eenheid     = a.eenheid     || 'stuk';
      const leverancier = a.leverancier ? `  Leverancier: ${a.leverancier}\n` : '';
      body += `  ${a.code.padEnd(12)} ${String(qty).padStart(4)} x  ${a.naam}  [per ${eenheid}]
${leverancier}`;
    });
  });
  body += `
${'─'.repeat(46)}
TOTAAL: ${totaal} artikelen
`;
  if (inf.opmerkingen) body += `
OPMERKINGEN
${inf.opmerkingen}
`;
  body += `
${'='.repeat(46)}
Emondt Materiaalapp · www.emondt.nl`;

  // ── Verstuur via mailto ───────────────────────────────────
  // ── Verstuur via Scripts (automatisch) of mailto (fallback) ──
  // Script verstuurt de mail automatisch — geen mailto nodig
  // logBestellingSheets handelt zowel mail als logging af

  // ── Log bestelling in Google Sheets (+ mail via script) ──
  logBestellingSheets({
    datum,
    naam:          inf.naam,
    telefoon:      inf.telefoon,
    afdeling:      inf.afdeling,
    projectnummer: inf.projectnummer,
    projectnaam:   inf.projectnaam,
    locatie:       inf.locatie,
    leverdatum,
    opmerkingen:   inf.opmerkingen,
    ontvanger2:    inf.ontvanger2 || '',
    items:         artikelItems,
  });
  showToast('⏳ Bestelling wordt verstuurd...');
}


// ── BESTELHISTORIE ────────────────────────────────────────────
let _historieData = [];

function slaHistorieOp(bestelling) {
  try {
    const hist = JSON.parse(localStorage.getItem('emondt_historie') || '[]');
    hist.unshift({ ...bestelling, id: Date.now() });
    localStorage.setItem('emondt_historie', JSON.stringify(hist.slice(0, 50)));
  } catch(e){}
}

function _parseArtikelenData(artikelenData) {
  if (!artikelenData) return [];
  return artikelenData.split('|').filter(Boolean).map(r => {
    const [code, qty, naam, eenheid, leverancier] = r.split('×');
    return { code: code||'', qty: parseInt(qty)||1, naam: naam||'', eenheid: eenheid||'stuk', leverancier: leverancier||'' };
  });
}

// Fallback parser voor leesbare tekst uit oude sheet-rijen
// Formaat: "5× PVC bocht (KT-0042) per stuk – Leverancier"
function _parseArtikelenTekst(tekst) {
  if (!tekst) return [];
  return tekst.split('\n').filter(Boolean).map(r => {
    const m = r.match(/^(\d+)×\s+(.+?)\s+\(([^)]+)\)(?:\s+per\s+(\S+))?(?:\s+[–-]\s+(.+))?$/);
    if (!m) return null;
    return { qty: parseInt(m[1])||1, naam: (m[2]||'').trim(), code: (m[3]||'').trim(), eenheid: (m[4]||'stuk').trim(), leverancier: (m[5]||'').trim() };
  }).filter(Boolean);
}

function _getArtikelen(b) {
  if (b.artikelenData) return _parseArtikelenData(b.artikelenData);
  return _parseArtikelenTekst(b.artikelenTekst || '');
}

function _renderHistorieLijst(hist) {
  const el = document.getElementById('historie-lijst');
  if (!el) return;
  if (!hist.length) {
    el.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--muted);font-size:.9rem">Nog geen bestellingen gevonden.</div>';
    return;
  }
  el.innerHTML = hist.map((b, i) => {
    const artikelen = _getArtikelen(b);
    const leverdatumTxt = b.leverdatum
      ? new Date(b.leverdatum + 'T12:00:00').toLocaleDateString('nl-NL', {day:'2-digit', month:'long', year:'numeric'})
      : '—';
    const totaal = artikelen.reduce((s, a) => s + (a.qty || 0), 0);
    const kanHerbestellen = artikelen.length > 0;

    return `
    <div class="hist-item" onclick="toggleHistDetail(${i})">
      <div class="hist-datum">${b.datum || '—'}</div>
      <div class="hist-project">${b.projectnaam || 'Geen projectnaam'}${b.projectnummer ? ' <span style="font-weight:400;color:var(--muted);font-size:.82rem">· ' + b.projectnummer + '</span>' : ''}</div>
      <div class="hist-meta">${b.naam || '—'} · ${b.afdeling || '—'}</div>
      <div class="hist-detail" id="hist-detail-${i}">

        <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 12px;font-size:.82rem;margin-bottom:12px">
          <span style="color:var(--muted)">Monteur</span><span style="font-weight:600">${b.naam || '—'}</span>
          <span style="color:var(--muted)">Afdeling</span><span>${b.afdeling || '—'}</span>
          <span style="color:var(--muted)">Afleveradres</span><span>${b.locatie || '—'}</span>
          <span style="color:var(--muted)">Leverdatum</span><span style="font-weight:600;color:var(--navy)">${leverdatumTxt}</span>
          ${b.opmerkingen ? `<span style="color:var(--muted)">Opmerkingen</span><span style="font-style:italic">${b.opmerkingen}</span>` : ''}
        </div>

        <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--green);margin-bottom:6px">Artikelen</div>
        <div style="background:var(--bg);border-radius:8px;overflow:hidden;margin-bottom:12px">
          ${artikelen.length ? artikelen.map((a, ai) => `
            <div class="hist-artikel-rij" style="background:${ai % 2 === 0 ? 'var(--white)' : 'var(--bg)'}">
              <span class="hist-artikel-qty">${a.qty}×</span>
              <span style="flex:1">${a.naam}</span>
              <span style="color:var(--muted);font-size:.74rem;font-family:'DM Mono',monospace">${a.code}</span>
            </div>`).join('') : `<div style="padding:10px 12px;font-size:.82rem;color:var(--muted)">Artikeldetails niet beschikbaar</div>`}
          ${artikelen.length ? `<div style="background:var(--navy);color:var(--green);padding:7px 12px;font-size:.8rem;font-weight:700;display:flex;justify-content:space-between">
            <span>Totaal</span><span>${totaal} stuks · ${artikelen.length} artikel${artikelen.length !== 1 ? 'en' : ''}</span>
          </div>` : ''}
        </div>

        ${kanHerbestellen ? `<button onclick="event.stopPropagation();herbestelHistorie(${i})" class="btn btn-primary" style="margin-bottom:0">
          🔁 Opnieuw bestellen
        </button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function renderHistorie() {
  const el = document.getElementById('historie-lijst');
  if (!el) return;
  const url = getSheetsUrl();
  const sessie = getAuthSessie();
  if (!url || !sessie) {
    el.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--muted);font-size:.9rem">Niet beschikbaar — geen verbinding.</div>';
    return;
  }
  el.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--muted);font-size:.9rem">⏳ Bestellingen laden...</div>';
  fetch(`${url}?actie=bestellingen_lezen&gebruiker=${encodeURIComponent(sessie.gebruiker)}&t=${Date.now()}`)
    .then(r => r.json())
    .then(r => {
      if (r.status !== 'ok') throw new Error(r.message || 'Fout');
      _historieData = r.bestellingen || [];
      _renderHistorieLijst(_historieData);
    })
    .catch(() => {
      el.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--muted);font-size:.9rem">⚠️ Kon bestellingen niet laden. Controleer verbinding.</div>';
    });
}

function toggleHistDetail(i) {
  const el = document.getElementById('hist-detail-' + i);
  const kaart = el?.closest('.hist-item');
  if (!el) return;
  el.classList.toggle('open');
  kaart?.classList.toggle('open', el.classList.contains('open'));
}

function herbestelHistorie(i) {
  const b = _historieData[i];
  if (!b) return;
  const artikelen = _getArtikelen(b);
  artikelen.forEach(a => { if (a.code && a.qty) cart[a.code] = a.qty; });
  saveCart();
  updateBadge();
  showTab('winkelwagen');
  showToast('🔁 Artikelen herladen in bestelling');
}
