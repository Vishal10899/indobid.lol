import { PrismaClient } from '@prisma/client';
import { CANONICAL_CATEGORIES } from '../src/lib/categories';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding official categories...');
  for (const cat of CANONICAL_CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, icon: cat.icon, sortOrder: cat.sortOrder },
      create: {
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon,
        sortOrder: cat.sortOrder,
      },
    });
  }

  // Seed authorized admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'vishalkumar75912@gmail.com';
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'founder', username: 'vishalkumar', displayName: 'Vishal Kumar', isVerified: true },
    create: {
      email: adminEmail,
      username: 'vishalkumar',
      displayName: 'Vishal Kumar',
      role: 'founder',
      isVerified: true,
    },
  });

  console.log('Production taxonomy ready. Zero demo listings seeded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
