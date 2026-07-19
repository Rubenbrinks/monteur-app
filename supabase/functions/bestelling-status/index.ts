// ══════════════════════════════════════════════════════════════
//  Emondt Monteurapp — Edge Function: bestelling-status
//  Handelt de "In behandeling nemen"-knop uit de bestelmail af.
//
//  BELANGRIJK: openen van de link (GET) doet NIETS — het toont alleen
//  een bevestigingspagina met een knop. Pas bij het klikken op die knop
//  (POST) wordt de status gezet + de pushmelding verstuurd. Zo kunnen
//  mailscanners/prefetchers (Gmail e.d.) de actie niet per ongeluk uitvoeren.
//
//  Secrets (Edge Function → Secrets):
//    VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (bv. mailto:bestelling@emondt.nl)
//  (SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn automatisch beschikbaar.)
//  Deploy met verify_jwt = false (de knop komt uit een e-mail, zonder login).
// ══════════════════════════════════════════════════════════════

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:bestelling@emondt.nl';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

function html(inner: string, code = 200): Response {
  const page = `<!doctype html><html lang="nl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Emondt Monteurapp</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#041c42;color:#fff;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center">
<div style="text-align:center;padding:32px;max-width:440px">${inner}</div>
</body></html>`;
  return new Response(page, { status: code, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function melding(emoji: string, titel: string, tekst: string, code = 200): Response {
  return html(`<div style="font-size:56px;line-height:1">${emoji}</div>
<h1 style="color:#AEC336;font-size:22px;margin:14px 0 8px">${titel}</h1>
<p style="color:#cfd8e6;font-size:15px;line-height:1.5">${tekst}</p>`, code);
}

function bevestigPagina(id: string, token: string, status: string, projectnaam: string): Response {
  const actie = `?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}&status=${encodeURIComponent(status)}`;
  return html(`<div style="font-size:56px;line-height:1">🔧</div>
<h1 style="color:#AEC336;font-size:22px;margin:14px 0 8px">Bestelling in behandeling nemen?</h1>
<p style="color:#cfd8e6;font-size:15px;line-height:1.5">Project: <b>${projectnaam || '—'}</b><br>De monteur krijgt hiervan een melding.</p>
<form method="POST" action="${actie}" style="margin-top:22px">
  <button type="submit" style="background:#639922;color:#fff;border:none;font-weight:bold;font-size:16px;padding:14px 30px;border-radius:8px;cursor:pointer">✅ Ja, in behandeling nemen</button>
</form>`);
}

Deno.serve(async (req) => {
  const url    = new URL(req.url);
  const id     = url.searchParams.get('id');
  const token  = url.searchParams.get('token');
  const status = url.searchParams.get('status') || 'in_behandeling';

  if (!id || !token) return melding('⚠️', 'Ongeldige link', 'Deze link is niet compleet.', 400);

  // Bestelling ophalen + beveiligingscode controleren.
  const { data: best, error } = await sb
    .from('bestellingen')
    .select('id, user_id, projectnaam, monteur_naam, status, status_token')
    .eq('id', id)
    .single();

  if (error || !best) return melding('⚠️', 'Niet gevonden', 'Deze bestelling bestaat niet (meer).', 404);
  if (String(best.status_token) !== String(token)) return melding('⛔', 'Ongeldige code', 'De beveiligingscode klopt niet.', 403);

  // ── GET = alleen TONEN (geen actie). Beschermt tegen mailscanners. ──
  if (req.method !== 'POST') {
    if (best.status === status) return melding('ℹ️', 'Al in behandeling', 'Deze bestelling is al in behandeling genomen.');
    return bevestigPagina(id, token, status, best.projectnaam);
  }

  // ── POST = de echte actie (alleen na een menselijke klik). ──
  if (best.status === status) {
    return melding('ℹ️', 'Al bijgewerkt', 'Deze bestelling was al in behandeling genomen.');
  }

  await sb.from('bestellingen')
    .update({ status, status_bijgewerkt_op: new Date().toISOString() })
    .eq('id', id);

  // Pushmelding naar de monteur (alle toestellen).
  let verstuurd = 0;
  if (best.user_id) {
    const { data: abos } = await sb.from('push_abonnementen').select('*').eq('user_id', best.user_id);
    const payload = JSON.stringify({
      titel: 'Bestelling in behandeling',
      body:  `Je bestelling${best.projectnaam ? ' voor ' + best.projectnaam : ''} is in behandeling genomen.`,
      url:   './index.html#historie',
      tag:   'status-' + id,
    });
    for (const abo of abos || []) {
      try {
        await webpush.sendNotification(
          { endpoint: abo.endpoint, keys: { p256dh: abo.p256dh, auth: abo.auth } },
          payload,
        );
        verstuurd++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await sb.from('push_abonnementen').delete().eq('endpoint', abo.endpoint);
        }
      }
    }
  }

  const extra = verstuurd
    ? 'De monteur is met een melding op de hoogte gebracht.'
    : 'De monteur heeft nog geen meldingen aanstaan, maar ziet de status wel in de app.';
  return melding('✅', 'Gelukt!', `De bestelling is op <b>in behandeling</b> gezet. ${extra}`);
});
