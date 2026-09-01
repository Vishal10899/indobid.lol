import { prisma } from '../src/lib/db';

async function inspect() {
  console.log('=== DATABASE AUDIT REPORT ===');

  const users = await prisma.user.findMany({
    select: { id: true, username: true, displayName: true, email: true, role: true, isVerified: true, createdAt: true },
  });
  const emailOtps = await prisma.emailOtp.findMany();
  console.log(`\nTotal Email OTPs (${emailOtps.length}):`);
  emailOtps.forEach((o) => console.log(` - Email: ${o.email} | Used: ${o.used} | Expired: ${o.expiresAt < new Date()} | Created: ${o.createdAt}`));

  console.log(`\nTotal Users (${users.length}):`);
  for (const u of users) {
    const debateCount = await prisma.debate.count({ where: { authorId: u.id } });
    const contribCount = await prisma.contribution.count({ where: { authorId: u.id } });
    console.log(` - [${u.role || 'user'}] @${u.username} (${u.displayName}) | Email: ${u.email} | ID: ${u.id} | Verified: ${u.isVerified} | Debates: ${debateCount} | Contribs: ${contribCount}`);
  }

  const debates = await prisma.debate.findMany({
    select: { id: true, title: true, authorId: true, authorUsername: true, status: true, originalContribution: true, totalVerifiedContribution: true, createdAt: true },
  });
  console.log(`\nTotal Debates (${debates.length}):`);
  debates.forEach((d) => console.log(` - [${d.status}] "${d.title}" by @${d.authorUsername} (authorId: ${d.authorId}) | ₹${d.originalContribution/100} orig / ₹${d.totalVerifiedContribution/100} verified | ID: ${d.id}`));

  const payments = await prisma.payment.findMany({
    select: { id: true, providerPaymentId: true, amount: true, status: true, provider: true, createdAt: true },
  });
  console.log(`\nTotal Payments (${payments.length}):`);
  payments.forEach((p) => console.log(` - [${p.status}] ₹${p.amount/100} | ${p.providerPaymentId} | Provider: ${p.provider}`));

  const contributions = await prisma.contribution.findMany({
    select: { id: true, authorUsername: true, amount: true, sequence: true, status: true, debateId: true },
  });
  console.log(`\nTotal Contributions (${contributions.length}):`);
  contributions.forEach((c) => console.log(` - [${c.status}] Seq #${c.sequence} ₹${c.amount/100} by @${c.authorUsername} on Debate ${c.debateId}`));

  const activities = await prisma.debateActivityEvent.count();
  console.log(`\nTotal Activity Events: ${activities}`);

  const follows = await prisma.follow.count();
  console.log(`Total Follows: ${follows}`);

  const likes = await prisma.debateLike.count();
  console.log(`Total Likes: ${likes}`);

  const bookmarks = await prisma.debateBookmark.count();
  console.log(`Total Bookmarks: ${bookmarks}`);

  const messages = await prisma.directMessage.count();
  console.log(`Total Messages: ${messages}`);

  const ledgers = await prisma.creatorEarningsLedger.count();
  console.log(`Total Creator Earnings Ledgers: ${ledgers}`);

  const visitorSessions = await prisma.visitorSession.count();
  console.log(`Total Visitor Sessions: ${visitorSessions}`);

  console.log('\n=== END OF AUDIT ===');
}

inspect()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
