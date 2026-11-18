// Datos de prueba de InkPixi: 10 usuarios, 1 portfolio por usuario, 5 dibujos por usuario,
// categorías y favoritos/guardados.
//
// Uso (antes hay que generar prisma/seed-images.json):
//   node scripts/fetch-met-drawings.mjs
//   npx prisma db seed
//
// ATENCIÓN: borra TODOS los datos de las tablas antes de insertar. Solo para desarrollo.

import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { buildSeed, SEED_PASSWORD, type MetDrawing } from './seed-data.js';

const prisma = new PrismaClient();

function loadDrawings(): MetDrawing[] {
  const file = new URL('./seed-images.json', import.meta.url);
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as MetDrawing[];
  } catch {
    throw new Error('No se pudo leer prisma/seed-images.json. Genéralo con: node scripts/fetch-met-drawings.mjs');
  }
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('El seed borra datos y no se puede ejecutar en producción.');
  }

  const seed = buildSeed(loadDrawings());
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, Number(process.env.BCRYPT_SALT_ROUNDS ?? 10));

  // Vaciar en orden de dependencias
  await prisma.favorite.deleteMany();
  await prisma.imageCategory.deleteMany();
  await prisma.image.deleteMany();
  await prisma.category.deleteMany();
  await prisma.portfolio.deleteMany();
  await prisma.user.deleteMany();

  // Usuarios, cada uno con su portfolio
  const userIds: number[] = [];
  for (const u of seed.users) {
    const created = await prisma.user.create({
      data: {
        email: u.email,
        username: u.username,
        fullName: u.fullName,
        location: u.location,
        passwordHash,
        portfolio: { create: u.portfolio },
      },
      select: { id: true },
    });
    userIds.push(created.id);
  }

  // Categorías
  await prisma.category.createMany({ data: seed.categories.map((name) => ({ name })) });
  const categories = await prisma.category.findMany();
  const categoryId = new Map(categories.map((c) => [c.name, c.id]));

  // Imágenes
  const imageIds: number[] = [];
  for (const img of seed.images) {
    const created = await prisma.image.create({
      data: {
        userId: userIds[img.ownerIndex]!,
        title: img.title,
        description: img.description,
        url: img.url,
        publicId: img.publicId,
        price: img.price,
        format: img.format,
      },
      select: { id: true },
    });
    imageIds.push(created.id);
  }

  await prisma.imageCategory.createMany({
    data: seed.images.flatMap((img, i) =>
      img.categories.map((name) => ({ imageId: imageIds[i]!, categoryId: categoryId.get(name)! })),
    ),
  });

  await prisma.favorite.createMany({
    data: seed.favorites.map((f) => ({
      userId: userIds[f.userIndex]!,
      imageId: imageIds[f.imageIndex]!,
      type: f.type,
    })),
  });

  console.log(
    `Seed completado: ${seed.users.length} usuarios, ${seed.images.length} imágenes, ` +
      `${seed.favorites.length} favoritos/guardados. Contraseña de todos: ${SEED_PASSWORD}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
