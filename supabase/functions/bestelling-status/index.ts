// ══════════════════════════════════════════════════════════════
//  Emondt Monteurapp — Edge Function: bestelling-status
//  Handelt de "In behandeling nemen"-knop uit de bestelmail af:
//   1. controleert de beveiligingscode (token) van de bestelling
//   2. zet de status op "in_behandeling"
//   3. stuurt een pushmelding naar de monteur
//   4. toont een nette bevestigingspagina
//
//  Benodigde secrets (Edge Function → Secrets):
//    VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (bv. mailto:bestelling@emondt.nl)
//  (SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn automatisch beschikbaar.)
//
//  Deploy zonder JWT-controle (de knop komt uit een e-mail, zonder login):
//    verify_jwt = false  (zie supabase/config.toml)
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

function pagina(emoji: string, titel: string, tekst: string, code = 200): Response {
  const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${titel}</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#041c42;color:#fff;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center">
<div style="text-align:center;padding:32px;max-width:420px">
<div style="font-size:56px;line-height:1">${emoji}</div>
<h1 style="color:#AEC336;font-size:22px;margin:14px 0 8px">${titel}</h1>
<p style="color:#cfd8e6;font-size:15px;line-height:1.5">${tekst}</p>
</div></body></html>`;
  return new Response(html, { status: code, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

Deno.serve(async (req) => {
  const url    = new URL(req.url);
  const id     = url.searchParams.get('id');
  const token  = url.searchParams.get('token');
  const status = url.searchParams.get('status') || 'in_behandeling';

  if (!id || !token) return pagina('⚠️', 'Ongeldige link', 'Deze link is niet compleet.', 400);

  // Bestelling ophalen + code controleren
  const { data: best, error } = await sb
    .from('bestellingen')
    .select('id, user_id, projectnaam, monteur_naam, status, status_token')
    .eq('id', id)
    .single();

  if (error || !best) return pagina('⚠️', 'Niet gevonden', 'Deze bestelling bestaat niet (meer).', 404);
  if (String(best.status_token) !== String(token)) return pagina('⛔', 'Ongeldige code', 'De beveiligingscode klopt niet.', 403);

  if (best.status === status) {
    return pagina('ℹ️', 'Al bijgewerkt', 'Deze bestelling was al in behandeling genomen.');
  }

  // Status bijwerken
  await sb.from('bestellingen')
    .update({ status, status_bijgewerkt_op: new Date().toISOString() })
    .eq('id', id);

  // Pushmelding naar de monteur (alle toestellen)
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
        // Verlopen/ongeldig abonnement opruimen
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await sb.from('push_abonnementen').delete().eq('endpoint', abo.endpoint);
        }
      }
    }
  }

  const naam = best.monteur_naam ? ` ${best.monteur_naam}` : '';
  const extra = verstuurd
    ? `${naam ? naam.trim() + ' is' : 'De monteur is'} met een melding op de hoogte gebracht.`
    : 'De monteur heeft nog geen meldingen aanstaan, maar ziet de status wel in de app.';
  return pagina('✅', 'Gelukt!', `De bestelling is op <b>in behandeling</b> gezet. ${extra}`);
});
