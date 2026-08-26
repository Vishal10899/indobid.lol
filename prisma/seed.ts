import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: 'AI', slug: 'ai', icon: 'Bot', sortOrder: 1 },
  { name: 'Startups', slug: 'startups', icon: 'Rocket', sortOrder: 2 },
  { name: 'SaaS', slug: 'saas', icon: 'Cloud', sortOrder: 3 },
  { name: 'Developer Tools', slug: 'developer-tools', icon: 'Code', sortOrder: 4 },
  { name: 'Creators', slug: 'creators', icon: 'Sparkles', sortOrder: 5 },
  { name: 'Social Media', slug: 'social-media', icon: 'Share2', sortOrder: 6 },
  { name: 'Marketing', slug: 'marketing', icon: 'Megaphone', sortOrder: 7 },
  { name: 'Finance', slug: 'finance', icon: 'DollarSign', sortOrder: 8 },
  { name: 'Ecommerce', slug: 'ecommerce', icon: 'ShoppingCart', sortOrder: 9 },
  { name: 'Design', slug: 'design', icon: 'Palette', sortOrder: 10 },
  { name: 'Gaming', slug: 'gaming', icon: 'Gamepad2', sortOrder: 11 },
  { name: 'Health', slug: 'health', icon: 'Heart', sortOrder: 12 },
  { name: 'Education', slug: 'education', icon: 'GraduationCap', sortOrder: 13 },
  { name: 'Media', slug: 'media', icon: 'Tv', sortOrder: 14 },
  { name: 'Personal Brand', slug: 'personal-brand', icon: 'User', sortOrder: 15 },
  { name: 'Other', slug: 'other', icon: 'Globe', sortOrder: 16 },
];

async function main() {
  console.log('Seeding official categories...');
  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, icon: cat.icon, sortOrder: cat.sortOrder },
      create: cat,
    });
  }

  // Seed authorized admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'vishalkumar75912@gmail.com';
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'admin' },
    create: {
      email: adminEmail,
      role: 'admin',
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
