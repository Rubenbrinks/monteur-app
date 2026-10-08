// ══════════════════════════════════════════════════════════════
//  Emondt Monteurapp — Edge Function: fotos-opruimen
//
//  Wordt elke nacht door pg_cron aangeroepen (zie 11-bestelfotos.sql) en wist
//  alle foto's in de bucket 'bestelfotos' die ouder zijn dan FOTO_DAGEN (standaard 7).
//  Ook foto's van een bestelling die nooit is verstuurd worden zo opgeruimd.
//
//  Dit gaat bewust via de opslag-interface en niet met SQL: een bestand
//  verwijderen via SQL haalt het niet zeker echt uit de opslag.
//
//  Veilig zonder wachtwoord: de functie kan alleen verlopen foto's wissen.
//  Deploy met verify_jwt = false.
//  Optioneel secret: FOTO_DAGEN (aantal dagen bewaren).
// ══════════════════════════════════════════════════════════════

import { createClient } from 'npm:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const BUCKET = 'bestelfotos';
const DAGEN = Math.max(1, Number(Deno.env.get('FOTO_DAGEN')) || 7);
const PAGINA = 1000;

// Alle items in een map, pagina voor pagina.
async function lijst(map: string) {
  const alles: { name: string; id: string | null; created_at?: string }[] = [];
  for (let offset = 0; ; offset += PAGINA) {
    const { data, error } = await sb.storage.from(BUCKET).list(map, { limit: PAGINA, offset });
    if (error) throw new Error(error.message);
    alles.push(...(data || []));
    if (!data || data.length < PAGINA) break;
  }
  return alles;
}

Deno.serve(async () => {
  try {
    const grens = Date.now() - DAGEN * 24 * 3600 * 1000;
    const teWissen: string[] = [];
    let bekeken = 0;

    // Eerste niveau = één map per gebruiker (id is null bij een map).
    for (const map of (await lijst('')).filter((i) => i.id === null)) {
      for (const bestand of await lijst(map.name)) {
        if (bestand.id === null) continue;
        bekeken++;
        const gemaakt = bestand.created_at ? Date.parse(bestand.created_at) : NaN;
        if (!isNaN(gemaakt) && gemaakt < grens) teWissen.push(`${map.name}/${bestand.name}`);
      }
    }

    let gewist = 0;
    for (let i = 0; i < teWissen.length; i += 100) {
      const { data, error } = await sb.storage.from(BUCKET).remove(teWissen.slice(i, i + 100));
      if (error) throw new Error(error.message);
      gewist += data?.length || 0;
    }

    return new Response(JSON.stringify({ status: 'ok', dagen: DAGEN, bekeken, gewist }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('fotos-opruimen mislukt:', e);
    return new Response(JSON.stringify({ status: 'fout' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
