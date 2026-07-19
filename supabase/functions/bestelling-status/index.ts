// ══════════════════════════════════════════════════════════════
//  Emondt Monteurapp — Edge Function: bestelling-status  (JSON-API)
//
//  Wordt aangeroepen door de bevestigingspagina (behandeling.html op
//  GitHub Pages) via een fetch-POST — pas ná een menselijke klik.
//  De pagina toont de nette bevestiging; deze functie doet alleen de
//  actie: status op "in_behandeling" zetten + pushmelding versturen.
//
//  Secrets (Edge Function → Secrets):
//    VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (bv. mailto:bestelling@emondt.nl)
//  (SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn automatisch beschikbaar.)
//  Deploy met verify_jwt = false.
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

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

function json(obj: unknown, code = 200): Response {
  return new Response(JSON.stringify(obj), {
    status: code,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  // Preflight
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url    = new URL(req.url);
  const id     = url.searchParams.get('id');
  const token  = url.searchParams.get('token');
  const status = url.searchParams.get('status') || 'in_behandeling';

  // Alleen POST voert de actie uit (GET/prefetch doet niets).
  if (req.method !== 'POST') return json({ status: 'gebruik_de_knop' }, 405);
  if (!id || !token) return json({ status: 'ongeldig' }, 400);

  const { data: best, error } = await sb
    .from('bestellingen')
    .select('id, user_id, projectnaam, status, status_token')
    .eq('id', id)
    .single();

  if (error || !best) return json({ status: 'niet_gevonden' }, 404);
  if (String(best.status_token) !== String(token)) return json({ status: 'ongeldige_code' }, 403);
  if (best.status === status) return json({ status: 'al_bijgewerkt', projectnaam: best.projectnaam });

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

  return json({ status: 'ok', verstuurd, projectnaam: best.projectnaam });
});
