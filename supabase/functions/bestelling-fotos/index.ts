// ══════════════════════════════════════════════════════════════
//  Emondt Monteurapp — Edge Function: bestelling-fotos  (JSON-API)
//
//  Voor de pagina fotos.html (de knop "Foto's bijgevoegd" in de bestelmail).
//  Toegang loopt, net als bij bestelling-status, via de beveiligingscode van de
//  bestelling (status_token): wie de link uit de mail heeft, mag de foto's zien.
//  De functie geeft korte, tijdelijke links (1 uur) naar de privé-bucket terug.
//
//  Deploy met verify_jwt = false (de mail wordt zonder login geopend).
//  Secrets: geen eigen; SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn automatisch.
// ══════════════════════════════════════════════════════════════

import { createClient } from 'npm:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const BUCKET = 'bestelfotos';

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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ status: 'gebruik_de_pagina' }, 405);

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const token = url.searchParams.get('token');
  if (!id || !token) return json({ status: 'ongeldig' }, 400);

  const { data: best, error } = await sb
    .from('bestellingen')
    .select('id, projectnaam, fotos, status_token')
    .eq('id', id)
    .single();
  if (error || !best) return json({ status: 'niet_gevonden' }, 404);
  if (String(best.status_token) !== String(token)) return json({ status: 'ongeldige_code' }, 403);

  const fotos: { pad: string; titel?: string }[] = Array.isArray(best.fotos) ? best.fotos : [];
  if (!fotos.length) return json({ status: 'geen_fotos', projectnaam: best.projectnaam });

  const { data: links } = await sb.storage.from(BUCKET).createSignedUrls(fotos.map((f) => f.pad), 3600);
  const perPad = new Map((links || []).map((l) => [l.path, l.signedUrl]));

  const resultaat = fotos.map((f) => ({ titel: f.titel || '', url: perPad.get(f.pad) || null }));
  if (!resultaat.some((r) => r.url)) return json({ status: 'verlopen', projectnaam: best.projectnaam });

  return json({ status: 'ok', projectnaam: best.projectnaam, fotos: resultaat });
});
