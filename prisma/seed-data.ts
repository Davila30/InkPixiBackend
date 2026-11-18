// Construye los datos de prueba de InkPixi sin tocar la base de datos.
// Es una función pura para poder probarla sin Prisma.

export interface MetDrawing {
  objectID: number;
  title: string;
  artist: string;
  date: string;
  medium: string;
  imageUrl: string;
  objectUrl: string;
}

export type SaveType = 'FAVORITE' | 'SAVED';

export interface SeedUser {
  username: string;
  email: string;
  fullName: string;
  location: string;
  portfolio: { title: string; description: string };
}

export interface SeedImage {
  ownerIndex: number; // posición del usuario dentro de SeedData.users
  title: string;
  description: string;
  url: string;
  publicId: string;
  price: string | null;
  format: string | null;
  categories: string[];
}

export interface SeedFavorite {
  userIndex: number;
  imageIndex: number; // posición de la imagen dentro de SeedData.images
  type: SaveType;
}

export interface SeedData {
  users: SeedUser[];
  categories: string[];
  images: SeedImage[];
  favorites: SeedFavorite[];
}

// Contraseña común de todos los usuarios de prueba (se guarda con hash bcrypt)
export const SEED_PASSWORD = 'InkPixi2026!';

export const IMAGES_PER_USER = 5;

const CATEGORIES = ['Retrato', 'Figura', 'Paisaje', 'Naturaleza', 'Animales', 'Arquitectura', 'Boceto'];

const PEOPLE = [
  ['ana_trazos', 'Ana García Ruiz', 'Madrid', 'Dibujo a lápiz, sobre todo retrato y figura humana.'],
  ['marcos_tinta', 'Marcos Fernández Gil', 'Barcelona', 'Ilustración a tinta y estudios de arquitectura.'],
  ['lucia_boceto', 'Lucía Moreno Vidal', 'Valencia', 'Cuaderno de bocetos diario: gente, calles y animales.'],
  ['pablo_carbon', 'Pablo Sánchez Ortega', 'Sevilla', 'Carboncillo y sanguina. Paisaje y naturaleza.'],
  ['carmen_lineas', 'Carmen Díaz Navarro', 'Zaragoza', 'Dibujo de línea fina y estudios del natural.'],
  ['javi_grafito', 'Javier Romero Castillo', 'Málaga', 'Grafito realista. Retratos por encargo.'],
  ['elena_sepia', 'Elena Torres Molina', 'Bilbao', 'Tintas sepia y dibujos de viaje.'],
  ['hugo_croquis', 'Hugo Vega Lara', 'Granada', 'Croquis urbanos y de arquitectura.'],
  ['sofia_pluma', 'Sofía Herrero Campos', 'Valladolid', 'Pluma y tinta. Naturaleza y animales.'],
  ['marta_estudio', 'Marta Iglesias León', 'Alicante', 'Estudios de figura y anatomía.'],
] as const;

// Las categorías se deducen de palabras del título (en inglés, como vienen del Met).
// Es una aproximación para tener datos de prueba variados, no una clasificación exacta.
const KEYWORDS: [string, RegExp][] = [
  ['Animales', /\b(horses?|dogs?|cats?|birds?|lions?|cows?|sheep|oxen|ox|bulls?|deer|fish|elephants?|animals?|camels?|donkeys?|goats?|pigs?|owls?|swans?|ducks?)\b/i],
  ['Paisaje', /\b(landscapes?|views?|rivers?|mountains?|trees?|coast|sea|lakes?|valleys?|hills?|forests?|villages?|fields?|roads?|shore|sky|clouds?)\b/i],
  ['Arquitectura', /\b(church(es)?|castles?|buildings?|architecture|palaces?|bridges?|towers?|temples?|cathedrals?|ruins?|houses?|facades?|interiors?|city|town)\b/i],
  ['Naturaleza', /\b(flowers?|plants?|fruits?|still life|leaf|leaves|branch(es)?|bouquets?|vases?|roses?)\b/i],
  ['Retrato', /\b(portraits?|heads?|self-portrait|bust|wom[ae]n|m[ae]n|girls?|boys?|child(ren)?|lady|gentleman)\b/i],
  ['Figura', /\b(figures?|nudes?|standing|seated|sitting|soldiers?|saints?|angels?|madonna|dancers?|peasants?)\b/i],
  ['Boceto', /\b(sketch(es|book)?|stud(y|ies)|designs?|drawings?)\b/i],
];

export function categorize(title: string): string[] {
  const found = KEYWORDS.filter(([, re]) => re.test(title)).map(([name]) => name);
  return found.length > 0 ? found.slice(0, 2) : ['Boceto'];
}

// Algunas obras "a la venta" para poder probar con y sin precio (índice de imagen -> precio)
const PRICES = new Map<number, string>([
  [0, '45.00'],
  [17, '120.50'],
  [34, '300.00'],
]);

function extensionOf(url: string): string | null {
  const m = /\.([a-z0-9]{3,4})(?:\?.*)?$/i.exec(url);
  return m && m[1] ? m[1].toLowerCase() : null;
}

export function buildSeed(drawings: MetDrawing[]): SeedData {
  const total = PEOPLE.length * IMAGES_PER_USER;
  if (drawings.length < total) {
    throw new Error(`Hacen falta ${total} dibujos y solo hay ${drawings.length}.`);
  }

  const users: SeedUser[] = PEOPLE.map(([username, fullName, location, bio]) => ({
    username,
    email: `${username}@inkpixi.test`, // .test es un dominio reservado: no existe de verdad
    fullName,
    location,
    portfolio: {
      title: `Portfolio de ${fullName.split(' ')[0]}`,
      description: bio,
    },
  }));

  const images: SeedImage[] = drawings.slice(0, total).map((d, i) => {
    const author = d.artist || 'Artista desconocido';
    const parts = [author + (d.date ? `, ${d.date}` : ''), d.medium].filter(Boolean);
    return {
      ownerIndex: Math.floor(i / IMAGES_PER_USER),
      title: d.title.slice(0, 200),
      description:
        `${parts.join('. ')}. Fuente: The Metropolitan Museum of Art, dominio público (Open Access). ${d.objectUrl}`,
      url: d.imageUrl,
      publicId: `seed/met-${d.objectID}`, // id ficticio: no existe en Cloudinary
      price: PRICES.get(i) ?? null,
      format: extensionOf(d.imageUrl),
      categories: categorize(d.title),
    };
  });

  // Cada usuario marca 3 FAVORITE y 2 SAVED sobre imágenes de otros usuarios, sin repetir.
  const favorites: SeedFavorite[] = [];
  const used = new Set<string>();
  const add = (userIndex: number, type: SaveType, start: number, step: number, n: number) => {
    let added = 0;
    for (let j = 0; j < images.length && added < n; j++) {
      const imageIndex = (start + j * step) % images.length;
      const key = `${userIndex}:${imageIndex}:${type}`;
      const image = images[imageIndex];
      if (!image || image.ownerIndex === userIndex || used.has(key)) continue;
      used.add(key);
      favorites.push({ userIndex, imageIndex, type });
      added++;
    }
  };
  users.forEach((_, u) => {
    add(u, 'FAVORITE', u * 7 + 3, 11, 3);
    add(u, 'SAVED', u * 13 + 5, 9, 2);
  });

  return { users, categories: CATEGORIES, images, favorites };
}
