/* ── Emondt Materiaalapp — beheer-algemeen.js ──
 * Beheer van gebruikers (rollen), mededelingen en agenda.
 */

const ROL_NAMEN = { monteur: 'Monteur', zzp: 'ZZP / Ingeleend', admin: 'Admin' };

function _escA(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── GEBRUIKERS (rollen) ───────────────────────────────────────
let _gebruikersLijst = [];

async function laadGebruikers() {
  const lijst = document.getElementById('gebruikers-lijst');
  const status = document.getElementById('gebruikers-status');
  if (!lijst) return;
  status.textContent = '⏳ Laden...';
  const { data, error } = await sb
    .from('profiles')
    .select('id, gebruikersnaam, naam, afdeling, rol')
    .order('naam', { ascending: true })
    .limit(2000);
  if (error) { status.innerHTML = '<span style="color:var(--danger)">❌ ' + _escA(error.message) + '</span>'; return; }
  status.textContent = '';
  _gebruikersLijst = data || [];
  toonGebruikers();
}

function toonGebruikers() {
  const lijst = document.getElementById('gebruikers-lijst');
  if (!lijst) return;
  const zoek = (document.getElementById('gebruikers-zoek')?.value || '').trim().toLowerCase();
  const ik = getAuthSessie()?.id;
  const rijen = _gebruikersLijst.filter(g =>
    !zoek || [g.naam, g.gebruikersnaam, g.afdeling].some(v => String(v || '').toLowerCase().includes(zoek)));
  if (!rijen.length) { lijst.innerHTML = '<div style="color:var(--muted);font-size:.84rem;padding:8px 0">Geen gebruikers gevonden.</div>'; return; }
  lijst.innerHTML = rijen.map(g => `
    <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1;min-width:0">
        <div style="font-size:.88rem;font-weight:600;color:var(--text)">${_escA(g.naam || g.gebruikersnaam || '—')}</div>
        <div style="font-size:.74rem;color:var(--muted)">${_escA(g.gebruikersnaam || '')}${g.afdeling ? ' · ' + _escA(g.afdeling) : ''}</div>
      </div>
      <select onchange="wijzigRol('${_escA(g.id)}', this)" ${g.id === ik ? 'disabled title="Je kunt je eigen rol niet wijzigen"' : ''}
        style="flex-shrink:0;padding:7px 8px;border-radius:8px;border:1px solid var(--border-strong);background:var(--bg);color:var(--text);font-family:inherit;font-size:.82rem">
        ${Object.entries(ROL_NAMEN).map(([k, v]) => `<option value="${k}" ${g.rol === k ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
    </div>`).join('');
}

async function wijzigRol(id, select) {
  const g = _gebruikersLijst.find(x => x.id === id);
  if (!g) return;
  const nieuw = select.value;
  const status = document.getElementById('gebruikers-status');
  const naam = g.naam || g.gebruikersnaam;
  if (nieuw === 'admin' && !confirm(`${naam} beheerder maken? Beheerders kunnen alles in de app aanpassen.`)) {
    select.value = g.rol; return;
  }
  select.disabled = true;
  const { error } = await sb.from('profiles').update({ rol: nieuw }).eq('id', id);
  select.disabled = false;
  if (error) {
    select.value = g.rol;
    status.innerHTML = '<span style="color:var(--danger)">❌ Wijzigen mislukt: ' + _escA(error.message) + '</span>';
    return;
  }
  g.rol = nieuw;
  status.innerHTML = `<span style="color:green">✅ ${_escA(naam)} is nu ${_escA(ROL_NAMEN[nieuw])}.</span>`;
}
