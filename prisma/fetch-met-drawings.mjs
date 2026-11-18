// Descarga del API público del Met (sin clave) una lista de dibujos en DOMINIO PÚBLICO
// y la guarda en prisma/seed-images.json para que la use prisma/seed.ts.
//
// Uso:  node scripts/fetch-met-drawings.mjs
// Requiere Node 18+ (fetch global). Solo hay que ejecutarlo una vez y subir el JSON al repo.
//
// Documentación del API: https://metmuseum.github.io/

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://collectionapi.metmuseum.org/public/collection/v1';
const TARGET = 50; // 10 usuarios x 5 dibujos
const MAX_PER_ARTIST = 2; // para que haya variedad
const PER_QUERY = 200; // ids que se guardan por cada término (solo se consultan los necesarios)
const DEPARTMENT_DRAWINGS_AND_PRINTS = 9;
const QUERIES = [
  'drawing', 'sketch', 'portrait', 'landscape', 'study',
  'figure', 'animal', 'flowers', 'architecture', 'village',
];
const OUT = fileURLToPath(new URL('../prisma/seed-images.json', import.meta.url));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, attempts = 4) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      if (res.status === 404) return null; // objeto que ya no existe
      if (i === attempts) throw new Error(`HTTP ${res.status} en ${url}`);
    } catch (err) {
      if (i === attempts) throw err;
    }
    await sleep(500 * i); // espera creciente ante 403/429/5xx o fallos de red
  }
  return null;
}

async function searchIds(q) {
  const params = new URLSearchParams({
    isPublicDomain: 'true',
    hasImages: 'true',
    departmentId: String(DEPARTMENT_DRAWINGS_AND_PRINTS),
    q,
  });
  const data = await getJson(`${API}/search?${params}`);
  return (data?.objectIDs ?? []).slice(0, PER_QUERY);
}

// Mezcla las listas de ids una a una (round robin) y quita repetidos
function interleave(lists) {
  const seen = new Set();
  const out = [];
  const max = Math.max(...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) {
    for (const list of lists) {
      const id = list[i];
      if (id !== undefined && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  return out;
}

// Un objeto sirve si es dominio público, tiene imagen y es un dibujo (no un grabado/estampa)
function isUsableDrawing(o) {
  if (!o || o.isPublicDomain !== true) return false;
  if (!o.primaryImageSmall) return false;
  const kind = `${o.classification ?? ''} ${o.objectName ?? ''}`;
  if (!/drawing|sketch/i.test(kind)) return false;
  if (/print/i.test(o.classification ?? '')) return false;
  return true;
}

async function main() {
  console.log('Buscando candidatos en el Met...');
  const lists = [];
  for (const q of QUERIES) {
    lists.push(await searchIds(q));
    await sleep(150);
  }
  const candidates = interleave(lists);
  console.log(`${candidates.length} candidatos. Filtrando...`);

  const result = [];
  const perArtist = new Map();

  for (const id of candidates) {
    if (result.length >= TARGET) break;
    const o = await getJson(`${API}/objects/${id}`);
    await sleep(100); // el Met pide no pasar de 80 peticiones por segundo
    if (!isUsableDrawing(o)) continue;

    const artist = (o.artistDisplayName ?? '').trim();
    const artistKey = artist || `anon-${id}`;
    if ((perArtist.get(artistKey) ?? 0) >= MAX_PER_ARTIST) continue;
    perArtist.set(artistKey, (perArtist.get(artistKey) ?? 0) + 1);

    result.push({
      objectID: o.objectID,
      title: (o.title ?? '').trim() || 'Sin título',
      artist,
      date: (o.objectDate ?? '').trim(),
      medium: (o.medium ?? '').trim(),
      imageUrl: o.primaryImageSmall, // versión web (~1000 px), mucho más ligera que la original
      objectUrl: o.objectURL,
    });
    console.log(`  ${String(result.length).padStart(2)}/${TARGET}  ${o.title}`);
  }

  if (result.length < TARGET) {
    throw new Error(`Solo se han encontrado ${result.length} dibujos válidos (hacen falta ${TARGET}).`);
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(`\nGuardado ${result.length} dibujos en ${OUT}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
