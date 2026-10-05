// ══════════════════════════════════════════════════════════════
//  Emondt Monteurapp — Edge Function: meldingen-beheer  (JSON-API)
//
//  Voor het beheerpaneel in de app. Twee acties (POST, veld "actie"):
//    statistiek  → hoeveel gebruikers/apparaten hebben meldingen aan
//    versturen   → eigen pushmelding sturen (eerst test, dan iedereen)
//
//  Beveiliging: de aanroeper moet ingelogd zijn én rol 'admin' hebben in
//  public.profiles. Er is dus geen gedeeld wachtwoord nodig. Deploy met
//  verify_jwt = true (zie config.toml).
//
//  Secrets (Edge Function → Secrets): dezelfde als bij bestelling-status:
//    VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
//  (SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn automatisch beschikbaar.)
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
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

function json(obj: unknown, code = 200): Response {
  return new Response(JSON.stringify(obj), {
    status: code,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// Welke pushdienst zit er achter dit adres? (alleen voor de statistiek)
function soort(endpoint: string): string {
  const e = String(endpoint || '');
  if (e.includes('web.push.apple.com'))   return 'iPhone / iPad';
  if (e.includes('fcm.googleapis.com'))   return 'Android / Chrome';
  if (e.includes('mozilla.com'))          return 'Firefox';
  if (e.includes('notify.windows.com'))   return 'Edge / Windows';
  return 'Overig';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ fout: 'gebruik POST' }, 405);

  // ── Wie belt er? Alleen ingelogde beheerders. ──
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: { user } } = await sb.auth.getUser(jwt);
  if (!user) return json({ fout: 'niet ingelogd' }, 401);
  const { data: profiel } = await sb.from('profiles').select('rol').eq('id', user.id).single();
  if (profiel?.rol !== 'admin') return json({ fout: 'alleen voor beheerders' }, 403);

  const body = await req.json().catch(() => ({}));

  // ── Statistiek ──────────────────────────────────────────────
  if (body.actie === 'statistiek') {
    const { data: profielen } = await sb.from('profiles').select('id, gebruikersnaam, naam, afdeling');
    const { data: abos } = await sb.from('push_abonnementen').select('user_id, endpoint');

    const metMeldingen = new Set((abos || []).map((a) => a.user_id));
    const perSoort: Record<string, number> = {};
    for (const a of abos || []) {
      const s = soort(a.endpoint);
      perSoort[s] = (perSoort[s] || 0) + 1;
    }
    const zonder = (profielen || [])
      .filter((p) => !metMeldingen.has(p.id))
      .map((p) => p.naam || p.gebruikersnaam || '—')
      .sort((a, b) => a.localeCompare(b, 'nl'));

    // Per afdeling en per persoon, voor de doelgroepkeuze bij het versturen.
    const perAfdeling: Record<string, { totaal: number; bereikbaar: number }> = {};
    const personen = (profielen || []).map((p) => {
      const afd = (p.afdeling || '').trim();
      const bereikbaar = metMeldingen.has(p.id);
      if (afd) {
        const r = perAfdeling[afd] ||= { totaal: 0, bereikbaar: 0 };
        r.totaal++;
        if (bereikbaar) r.bereikbaar++;
      }
      return { id: p.id, naam: p.naam || p.gebruikersnaam || '—', afdeling: afd, bereikbaar };
    }).sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));

    return json({
      status: 'ok',
      afdelingen: perAfdeling,
      personen,
      gebruikers: (profielen || []).length,
      bereikbaar: [...metMeldingen].filter((id) => (profielen || []).some((p) => p.id === id)).length,
      apparaten: (abos || []).length,
      perSoort,
      zonderMeldingen: zonder,
    });
  }

  // ── Versturen ───────────────────────────────────────────────
  if (body.actie === 'versturen') {
    const titel = String(body.titel ?? '').trim();
    const tekst = String(body.tekst ?? '').trim();
    // Test = alleen naar de eigen apparaten van de beheerder (veiligste stand).
    const alleenTest = body.test !== false;

    if (!titel) return json({ fout: 'titel ontbreekt' }, 400);
    if (titel.length > 60) return json({ fout: 'titel is te lang (max 60 tekens)' }, 400);
    if (tekst.length > 180) return json({ fout: 'tekst is te lang (max 180 tekens)' }, 400);

    let vraag = sb.from('push_abonnementen').select('id, endpoint, p256dh, auth');
    let doelgroep = 'iedereen';
    if (alleenTest) {
      vraag = vraag.eq('user_id', user.id);
    } else if (typeof body.afdeling === 'string' && body.afdeling.trim()) {
      const afd = body.afdeling.trim();
      const { data: leden } = await sb.from('profiles').select('id').eq('afdeling', afd);
      const ids = (leden || []).map((l) => l.id);
      if (!ids.length) return json({ fout: 'geen gebruikers in afdeling ' + afd }, 400);
      vraag = vraag.in('user_id', ids);
      doelgroep = 'afdeling ' + afd;
    } else if (Array.isArray(body.userIds)) {
      const ids = body.userIds.filter((x: unknown) => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x as string));
      if (!ids.length || ids.length !== body.userIds.length) return json({ fout: 'ongeldige of lege selectie' }, 400);
      vraag = vraag.in('user_id', ids);
      doelgroep = ids.length + ' gekozen personen';
    }
    const { data: abos, error } = await vraag;
    if (error) return json({ fout: 'kon abonnementen niet ophalen' }, 500);
    if (!abos?.length) {
      return json({ status: 'ok', verstuurd: 0, geprobeerd: 0, opgeruimd: 0,
        reden: alleenTest ? 'Jij hebt zelf geen meldingen aanstaan op een apparaat.' : 'Niemand in deze doelgroep heeft meldingen aan.' });
    }

    const payload = JSON.stringify({
      titel,
      body: tekst || ' ',
      url: './index.html',
      // Eigen tag per bericht, anders overschrijft een nieuwe melding de vorige.
      tag: 'bericht-' + Date.now(),
    });

    let verstuurd = 0, opgeruimd = 0;
    const fouten: string[] = [];
    await Promise.all(abos.map(async (abo) => {
      try {
        await webpush.sendNotification(
          { endpoint: abo.endpoint, keys: { p256dh: abo.p256dh, auth: abo.auth } },
          payload,
          { TTL: 86400, urgency: 'high' },
        );
        verstuurd++;
      } catch (e: any) {
        // 404/410 = toestel bestaat niet meer → opruimen.
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await sb.from('push_abonnementen').delete().eq('id', abo.id);
          opgeruimd++;
        } else {
          fouten.push(`${soort(abo.endpoint)}: code ${e?.statusCode ?? '?'}`);
        }
      }
    }));

    return json({
      status: 'ok',
      modus: alleenTest ? 'test' : doelgroep,
      verstuurd,
      geprobeerd: abos.length,
      opgeruimd,
      fouten: fouten.slice(0, 5),
    });
  }

  return json({ fout: 'onbekende actie' }, 400);
});
