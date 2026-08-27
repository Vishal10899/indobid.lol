import { prisma } from '../src/lib/db';
import { CANONICAL_CATEGORIES } from '../src/lib/categories';

async function syncCategories() {
  console.log('Ensuring all canonical categories exist in DB...');
  for (const cat of CANONICAL_CATEGORIES) {
    // Find if category exists by slug (case-insensitive)
    const existing = await prisma.category.findFirst({
      where: {
        OR: [
          { slug: cat.slug },
          { slug: cat.slug.toLowerCase() },
          { slug: cat.slug.toUpperCase() },
          { name: cat.name },
        ],
      },
    });

    if (existing) {
      await prisma.category.update({
        where: { id: existing.id },
        data: {
          name: cat.name,
          slug: cat.slug,
          icon: cat.icon,
          sortOrder: cat.sortOrder,
        },
      });
      console.log(`Updated existing category: ${cat.name} (${existing.id})`);
    } else {
      const created = await prisma.category.create({
        data: {
          name: cat.name,
          slug: cat.slug,
          icon: cat.icon,
          sortOrder: cat.sortOrder,
        },
      });
      console.log(`Created new category: ${cat.name} (${created.id})`);
    }
  }

  const all = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
  console.log(`Total categories in DB now: ${all.length}`);
}

syncCategories()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
