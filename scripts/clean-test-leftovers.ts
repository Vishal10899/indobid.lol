import { prisma } from '../src/lib/db';

async function cleanLeftovers() {
  console.log('Cleaning test leftovers...');

  // 1. Delete all test email OTPs
  const deletedOtps = await prisma.emailOtp.deleteMany({
    where: {
      OR: [
        { email: { contains: 'example.com' } },
        { email: { contains: 'test' } },
      ],
    },
  });
  console.log(`Deleted ${deletedOtps.count} test OTPs.`);

  // 2. Delete test creator earnings ledger entries on test debates
  const deletedLedgers = await prisma.creatorEarningsLedger.deleteMany({
    where: {
      debateId: { not: 'cmtin8awf0013na2aphi2b96d' },
    },
  });
  console.log(`Deleted ${deletedLedgers.count} test creator ledgers.`);

  // 3. Delete test contributions on test debates
  const deletedContribs = await prisma.contribution.deleteMany({
    where: {
      debateId: { not: 'cmtin8awf0013na2aphi2b96d' },
    },
  });
  console.log(`Deleted ${deletedContribs.count} test contributions.`);

  // 4. Delete test debates (preserve real founder post cmtin8awf0013na2aphi2b96d)
  const deletedDebates = await prisma.debate.deleteMany({
    where: {
      id: { not: 'cmtin8awf0013na2aphi2b96d' },
    },
  });
  console.log(`Deleted ${deletedDebates.count} test debates.`);

  // 5. Delete test users (preserve founder)
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      AND: [
        { username: { not: 'vishalchaudhary' } },
        { email: { not: 'vishalchaudhary74096@gmail.com' } },
      ],
    },
  });
  console.log(`Deleted ${deletedUsers.count} test users.`);

  // 6. Delete test password reset tokens
  const deletedTokens = await (prisma as any).passwordResetToken.deleteMany({
    where: {
      email: { not: 'vishalchaudhary74096@gmail.com' },
    },
  });
  console.log(`Deleted ${deletedTokens.count} test reset tokens.`);

  console.log('Test leftovers cleaned successfully.');
}

cleanLeftovers()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
