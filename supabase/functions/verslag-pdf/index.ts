// ══════════════════════════════════════════════════════════════
//  Emondt Monteurapp — Edge Function: verslag-pdf
//
//  Maakt van een vertrekverslag (tabel project_verslagen) een PDF in de stijl van
//  het installatieverslag: projectgegevens, uitgevoerde werkzaamheden, benodigd
//  voor de verdere installatie, opmerkingen en een fotoverslag (2 foto's per pagina).
//
//  Aanroep (ingelogde gebruiker):  POST  <functie-url>?id=<verslag-id>
//  Toegang: alleen de maker van het verslag en beheerders (de functie controleert dat).
//  Deploy met verify_jwt = true. Secrets: geen eigen; SUPABASE_URL, SUPABASE_ANON_KEY
//  en SUPABASE_SERVICE_ROLE_KEY zijn automatisch aanwezig.
// ══════════════════════════════════════════════════════════════

import { createClient } from 'npm:@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

// ── PDF OPMAAK (los van Supabase; wordt apart getest) ─────────
// BEGIN-OPMAAK
const GROEN = [0.45, 0.58, 0.14];
const DONKER = [0.12, 0.14, 0.12];
const GRIJS = [0.42, 0.45, 0.42];
const LIJN = [0.82, 0.85, 0.80];
const PAG = { b: 595.28, h: 841.89, rand: 48 };

// Helvetica kent alleen WinAnsi (Windows-1252); andere tekens worden een vraagteken.
const WINANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
function veilig(s: unknown): string {
  return Array.from(String(s ?? '').replace(/\r/g, '').replace(/\t/g, '  '))
    .map((c) => {
      const n = c.codePointAt(0)!;
      if (c === '\n' || (n >= 32 && n < 127) || (n >= 160 && n <= 255) || WINANSI_EXTRA.includes(c)) return c;
      return n < 32 ? ' ' : '?';
    }).join('');
}

function datumNL(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : String(iso || '');
}

type Foto = { bytes: Uint8Array; type: 'jpg' | 'png'; titel: string };
type VerslagData = {
  project: { projectnummer: string; projectnaam: string; afdeling: string; plaats?: string; adres?: string; projectleider?: string };
  verslag: { datum: string; auteur_naam: string; inhoud: any };
  fotos: Foto[];
};

async function bouwVerslagPdf(data: VerslagData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const vet = await pdf.embedFont(StandardFonts.HelveticaBold);
  const kleur = (c: number[]) => rgb(c[0], c[1], c[2]);
  const { project: pr, verslag: vs } = data;
  const inh = vs.inhoud || {};
  const kop = `${pr.projectnummer} | ${pr.projectnaam}`;
  const binnen = PAG.b - 2 * PAG.rand;

  const paginas: any[] = [];
  let pagina: any, y = 0;
  const nieuwePagina = (titel: string) => {
    pagina = pdf.addPage([PAG.b, PAG.h]);
    paginas.push({ pagina, titel });
    pagina.drawRectangle({ x: 0, y: PAG.h - 8, width: PAG.b, height: 8, color: kleur(GROEN) });
    pagina.drawText(veilig(titel), { x: PAG.rand, y: PAG.h - 58, size: 22, font: vet, color: kleur(DONKER) });
    pagina.drawText(veilig(kop).slice(0, 90), { x: PAG.rand, y: PAG.h - 78, size: 10.5, font, color: kleur(GRIJS) });
    pagina.drawLine({ start: { x: PAG.rand, y: PAG.h - 90 }, end: { x: PAG.b - PAG.rand, y: PAG.h - 90 }, thickness: 0.8, color: kleur(LIJN) });
    y = PAG.h - 116;
  };
  const ruimte = (nodig: number, titel: string) => { if (y - nodig < PAG.rand + 30) nieuwePagina(titel); };

  const breek = (tekst: string, f: any, size: number, breedte: number): string[] => {
    const regels: string[] = [];
    for (const alinea of veilig(tekst).split('\n')) {
      let huidig = '';
      for (const woord of alinea.split(/\s+/).filter(Boolean)) {
        let w = woord;
        while (f.widthOfTextAtSize(w, size) > breedte) {       // zeer lang woord: afbreken
          let k = w.length;
          while (k > 1 && f.widthOfTextAtSize(w.slice(0, k), size) > breedte) k--;
          if (huidig) { regels.push(huidig); huidig = ''; }
          regels.push(w.slice(0, k)); w = w.slice(k);
        }
        const probeer = huidig ? huidig + ' ' + w : w;
        if (f.widthOfTextAtSize(probeer, size) <= breedte) huidig = probeer;
        else { regels.push(huidig); huidig = w; }
      }
      regels.push(huidig);
    }
    return regels;
  };

  const kopje = (tekst: string) => {
    ruimte(50, 'Installatieverslag');
    pagina.drawText(veilig(tekst), { x: PAG.rand, y, size: 13, font: vet, color: kleur(GROEN) });
    y -= 20;
  };
  const alinea = (tekst: string, opts: { punt?: boolean; size?: number } = {}) => {
    const size = opts.size || 10.5, inspring = opts.punt ? 14 : 0;
    for (const [i, r] of breek(tekst, font, size, binnen - inspring).entries()) {
      ruimte(size + 6, 'Installatieverslag');
      if (opts.punt && i === 0) pagina.drawText('-', { x: PAG.rand + 2, y, size, font: vet, color: kleur(GROEN) });
      pagina.drawText(r, { x: PAG.rand + inspring, y, size, font, color: kleur(DONKER) });
      y -= size + 5;
    }
    y -= opts.punt ? 1 : 4;
  };
  const gegeven = (label: string, waarde: string) => {
    const regels = breek(waarde || '-', font, 10.5, binnen - 150);
    ruimte(regels.length * 15 + 4, 'Installatieverslag');
    pagina.drawText(veilig(label) + ':', { x: PAG.rand, y, size: 10.5, font: vet, color: kleur(GRIJS) });
    for (const r of regels) { pagina.drawText(r, { x: PAG.rand + 150, y, size: 10.5, font, color: kleur(DONKER) }); y -= 15; }
  };

  // ── Pagina 1: verslag ──
  nieuwePagina('Installatieverslag');
  kopje('Projectgegevens');
  gegeven('Project', pr.projectnaam);
  gegeven('Projectnummer', pr.projectnummer);
  gegeven('Afdeling', 'Emondt ' + (pr.afdeling || ''));
  gegeven('Locatie', [pr.adres, pr.plaats].filter(Boolean).join(', '));
  if (pr.projectleider) gegeven('Projectleider', pr.projectleider);
  gegeven('Uitvoerder', vs.auteur_naam);
  gegeven('Verslagdatum', datumNL(vs.datum));
  y -= 10;

  const lijst: { tekst: string; staat: string }[] = Array.isArray(inh.checklist) ? inh.checklist : [];
  const uitgevoerd = lijst.filter((x) => x.staat === 'uitgevoerd');
  const nogTeDoen = lijst.filter((x) => x.staat === 'nog');
  const m = inh.metingen || {};
  const meting = (v: unknown) => String(v ?? '').trim();

  kopje('Uitgevoerde werkzaamheden en controle');
  const werk: string[] = uitgevoerd.map((x) => x.tekst);
  if (meting(m.leidinglengte)) werk.push(`De leidinglengte is ${meting(m.leidinglengte)} meter.`);
  if (meting(m.druktest)) werk.push(`De leidingen zijn afgeperst op ${meting(m.druktest)} bar.`);
  if (meting(m.achtergelaten)) werk.push(`Na de druktest is ${meting(m.achtergelaten)} bar op de leidingen achtergelaten.`);
  if (werk.length) werk.forEach((w) => alinea(w, { punt: true })); else alinea('Geen werkzaamheden aangevinkt.');
  y -= 6;

  const materiaal: any[] = Array.isArray(inh.materiaal) ? inh.materiaal.filter((x: any) => x && x.naam) : [];
  kopje('Benodigd voor de verdere installatie');
  if (nogTeDoen.length || materiaal.length) {
    nogTeDoen.forEach((x) => alinea(x.tekst, { punt: true }));
    materiaal.forEach((x) => alinea(`${x.aantal ? x.aantal + ' x ' : ''}${x.naam}${x.eenheid ? ' (' + x.eenheid + ')' : ''}`, { punt: true }));
  } else alinea('Niets vermeld.');
  y -= 6;

  if (meting(inh.opmerking)) { kopje('Opmerkingen'); alinea(meting(inh.opmerking)); y -= 6; }

  ruimte(60, 'Installatieverslag');
  y -= 6;
  alinea(`Verslag opgesteld in de Emondt Monteur-app door ${vs.auteur_naam} op ${datumNL(vs.datum)}.` +
    (data.fotos.length ? ` De ${data.fotos.length} foto${data.fotos.length === 1 ? '' : "'s"} zijn opgenomen in het fotoverslag.` : ''),
    { size: 9 });

  // ── Fotoverslag: 2 per pagina ──
  const perPagina = 2, aantalFotoPag = Math.ceil(data.fotos.length / perPagina);
  for (let p = 0; p < aantalFotoPag; p++) {
    nieuwePagina(`Fotoverslag ${p + 1} / ${aantalFotoPag}`);
    const vak = (PAG.h - 116 - PAG.rand - 30) / perPagina;
    for (let k = 0; k < perPagina; k++) {
      const idx = p * perPagina + k;
      if (idx >= data.fotos.length) break;
      const f = data.fotos[idx];
      const top = PAG.h - 116 - k * vak;
      const bijschrift = `Foto ${String(idx + 1).padStart(2, '0')}${f.titel ? ' | ' + f.titel : ''}`;
      pagina.drawText(veilig(bijschrift).slice(0, 95), { x: PAG.rand, y: top, size: 10.5, font: vet, color: kleur(DONKER) });
      try {
        const img = f.type === 'png' ? await pdf.embedPng(f.bytes) : await pdf.embedJpg(f.bytes);
        const maxB = binnen, maxH = vak - 34;
        const s = Math.min(maxB / img.width, maxH / img.height, 1.6);
        const w = img.width * s, h = img.height * s;
        pagina.drawImage(img, { x: PAG.rand, y: top - 10 - h, width: w, height: h });
      } catch (_e) {
        pagina.drawText('(foto kon niet worden getoond)', { x: PAG.rand, y: top - 24, size: 10, font, color: kleur(GRIJS) });
      }
    }
  }

  // ── Koppen onder aan elke pagina met paginanummer ──
  paginas.forEach((pg, i) => {
    const rechts = `${i + 1} / ${paginas.length}`;
    const links = veilig(`${vs.auteur_naam} | Voor Emondt`);
    pg.pagina.drawText(links, { x: PAG.rand, y: 28, size: 9, font, color: kleur(GRIJS) });
    pg.pagina.drawText(rechts, { x: PAG.b - PAG.rand - font.widthOfTextAtSize(rechts, 9), y: 28, size: 9, font, color: kleur(GRIJS) });
  });

  return await pdf.save();
}
// EINDE-OPMAAK

// ── SERVER ─────────────────────────────────────────────────────
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};
const jsonFout = (obj: unknown, code: number) =>
  new Response(JSON.stringify(obj), { status: code, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonFout({ fout: 'Gebruik POST' }, 405);

  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return jsonFout({ fout: 'Verslag-id ontbreekt' }, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  const auth = req.headers.get('Authorization') || '';
  const gebruikersClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: u } = await gebruikersClient.auth.getUser();
  if (!u?.user) return jsonFout({ fout: 'Niet ingelogd' }, 401);

  const sb = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: vs } = await sb.from('project_verslagen').select('*').eq('id', id).maybeSingle();
  if (!vs) return jsonFout({ fout: 'Verslag niet gevonden' }, 404);
  const { data: profiel } = await sb.from('profiles').select('rol').eq('id', u.user.id).maybeSingle();
  if (vs.auteur_id !== u.user.id && profiel?.rol !== 'admin') {
    return jsonFout({ fout: 'Alleen de maker of een beheerder mag de PDF maken' }, 403);
  }
  const { data: project } = await sb.from('projecten').select('*').eq('id', vs.project_id).maybeSingle();
  if (!project) return jsonFout({ fout: 'Project niet gevonden' }, 404);

  const fotoLijst: { pad: string; titel?: string }[] = Array.isArray(vs.inhoud?.fotos) ? vs.inhoud.fotos : [];
  const fotos: Foto[] = [];
  for (const f of fotoLijst) {
    const { data: blob } = await sb.storage.from('projectfotos').download(f.pad);
    if (!blob) continue;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const png = bytes[0] === 0x89 && bytes[1] === 0x50;
    const jpg = bytes[0] === 0xff && bytes[1] === 0xd8;
    if (!png && !jpg) continue;                      // bijv. webp: niet in te sluiten
    fotos.push({ bytes, type: png ? 'png' : 'jpg', titel: f.titel || '' });
  }

  try {
    const pdfBytes = await bouwVerslagPdf({ project, verslag: vs, fotos });
    const naam = `Verslag-${project.projectnummer}-${vs.datum}.pdf`.replace(/[^A-Za-z0-9._-]/g, '_');
    return new Response(pdfBytes, {
      headers: { ...CORS, 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${naam}"` },
    });
  } catch (e) {
    return jsonFout({ fout: 'PDF maken mislukt: ' + (e as Error).message }, 500);
  }
});
