import { prisma } from '../src/lib/db';

async function backfill() {
  const result = await prisma.user.updateMany({
    where: { emailVerifiedAt: null },
    data: { emailVerifiedAt: new Date() },
  });
  console.log(`Successfully backfilled emailVerifiedAt for ${result.count} existing user(s).`);
}

backfill()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
