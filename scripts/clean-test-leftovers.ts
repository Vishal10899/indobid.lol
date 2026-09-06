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

  // 4. Delete only test debates (strictly scoped to test prefixes)
  const deletedDebates = await prisma.debate.deleteMany({
    where: {
      OR: [
        { title: { startsWith: 'Test Debate' } },
        { title: { startsWith: 'TEST_' } },
        { authorUsername: { startsWith: 'test_' } },
        { authorUsername: { in: ['testuser', 'p17_author_a', 'p17_author_b'] } },
      ],
    },
  });
  console.log(`Deleted ${deletedDebates.count} test debates.`);

  // 5. Delete only test users (strictly scoped to test emails and usernames)
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      OR: [
        { email: { endsWith: '@example.com' } },
        { email: { startsWith: 'test' } },
        { username: { startsWith: 'test_' } },
        { username: { startsWith: 'testuser_' } },
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
