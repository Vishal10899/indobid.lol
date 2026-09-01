import { prisma } from '../src/lib/db';
import { hashPassword } from '../src/lib/user-auth';

async function productionCleanup() {
  console.log('====================================================');
  console.log('  INDOBID.LOL — PRODUCTION DATABASE CLEANUP');
  console.log('====================================================\n');

  // 1. Identify Demo & Test Debates
  const demoDebates = await prisma.debate.findMany({
    where: {
      OR: [
        { authorUsername: { in: ['rohan_tech', 'aravind_ai', 'priya_vc', 'dev_kunal', 'kavya_builds', 'samir_capital', 'ananya_macro', 'vikram_trades', 'tanmay_remote', 'aditya_dev', 'test', 'vishalkumar'] } },
        { authorUsername: { startsWith: 'test' } },
        { title: { startsWith: 'Test Debate' } },
        { title: { startsWith: 'Founder Free Post: The Future of IndoBid' } },
        { title: { startsWith: 'Admin Console: Official Announcement' } },
        { title: { startsWith: 'Original Title Before Author Edit' } },
        { title: { startsWith: 'Debate to be hidden' } },
        { title: { startsWith: 'njhsdhdsbdsbcndbvdfbnv' } },
        { title: 'ddrfd' },
      ],
      // NEVER delete the real live Founder debate "We’re live."
      NOT: [
        { title: 'We’re live.' },
      ],
    },
    select: { id: true, title: true, authorUsername: true },
  });

  console.log(`1. Found ${demoDebates.length} test/demo debates to remove:`);
  demoDebates.forEach((d) => console.log(` - [${d.id}] "${d.title}" by @${d.authorUsername}`));

  const demoDebateIds = demoDebates.map((d) => d.id);

  if (demoDebateIds.length > 0) {
    await prisma.debateActivityEvent.deleteMany({ where: { debateId: { in: demoDebateIds } } });
    await prisma.debateLike.deleteMany({ where: { debateId: { in: demoDebateIds } } });
    await prisma.debateBookmark.deleteMany({ where: { debateId: { in: demoDebateIds } } });
    await prisma.debateReport.deleteMany({ where: { debateId: { in: demoDebateIds } } });
    await prisma.debateImpression.deleteMany({ where: { debateId: { in: demoDebateIds } } });
    await prisma.payment.deleteMany({ where: { debateId: { in: demoDebateIds } } });
    await prisma.contribution.deleteMany({ where: { debateId: { in: demoDebateIds } } });
    const debateDel = await prisma.debate.deleteMany({ where: { id: { in: demoDebateIds } } });
    console.log(` -> Deleted ${debateDel.count} test debates and associated relations.`);
  }

  // 2. Identify Demo & Test Users
  const usersToDelete = await prisma.user.findMany({
    where: {
      OR: [
        { username: { in: ['rohan_tech', 'aravind_ai', 'priya_vc', 'dev_kunal', 'kavya_builds', 'samir_capital', 'ananya_macro', 'vikram_trades', 'tanmay_remote', 'aditya_dev', 'test', 'vishalkumar'] } },
        { username: { startsWith: 'test_' } },
        { username: { startsWith: 'testuser_' } },
        { username: { startsWith: 'direct_otp_' } },
        { username: { startsWith: 'unverified_' } },
        { username: { startsWith: 'apiuser_' } },
        { username: { startsWith: 'resetuser_' } },
        { email: { endsWith: '@example.com' } },
        { email: 'vishal@gmail.com' },
      ],
      // NEVER delete the official Founder account!
      NOT: [
        { username: 'vishalchaudhary' },
        { email: 'vishalchaudhary74096@gmail.com' },
      ],
    },
    select: { id: true, username: true, email: true },
  });

  console.log(`\n2. Found ${usersToDelete.length} demo/test users to remove:`);
  usersToDelete.forEach((u) => console.log(` - [${u.id}] @${u.username} (${u.email})`));

  const userIdsToDelete = usersToDelete.map((u) => u.id);

  if (userIdsToDelete.length > 0) {
    await prisma.follow.deleteMany({
      where: { OR: [{ followerId: { in: userIdsToDelete } }, { followingId: { in: userIdsToDelete } }] },
    });
    await prisma.notification.deleteMany({
      where: { userId: { in: userIdsToDelete } },
    });
    await prisma.directMessage.deleteMany({
      where: { OR: [{ senderId: { in: userIdsToDelete } }, { recipientId: { in: userIdsToDelete } }] },
    });
    await prisma.conversation.deleteMany({
      where: { OR: [{ participant1Id: { in: userIdsToDelete } }, { participant2Id: { in: userIdsToDelete } }] },
    });
    await prisma.payoutAccount.deleteMany({
      where: { userId: { in: userIdsToDelete } },
    });
    await prisma.creatorEarningsLedger.deleteMany({
      where: { creatorId: { in: userIdsToDelete } },
    });
    const userDel = await prisma.user.deleteMany({
      where: { id: { in: userIdsToDelete } },
    });
    console.log(` -> Deleted ${userDel.count} demo/test users.`);
  }

  // 3. Remove old redundant seed admin record if exists
  const oldAdmin = await prisma.user.findFirst({
    where: { email: 'vishalkumar75912@gmail.com' },
  });
  if (oldAdmin) {
    // Check if old admin has any content
    const oldDebates = await prisma.debate.count({ where: { authorId: oldAdmin.id } });
    if (oldDebates === 0) {
      await prisma.user.delete({ where: { id: oldAdmin.id } });
      console.log(`\n3. Cleaned up old unused admin record (${oldAdmin.email}).`);
    }
  }

  // Clean test OTP and password reset tokens
  const deletedOtps = await prisma.emailOtp.deleteMany({
    where: {
      OR: [
        { email: { endsWith: '@example.com' } },
        { email: { startsWith: 'test' } },
        { email: { startsWith: 'otp_test' } },
        { email: { startsWith: 'direct_otp' } },
      ],
    },
  });
  if (deletedOtps.count > 0) {
    console.log(` -> Cleaned ${deletedOtps.count} test email OTP records.`);
  }

  const deletedResetTokens = await prisma.passwordResetToken.deleteMany({
    where: {
      OR: [
        { email: { endsWith: '@example.com' } },
        { email: { startsWith: 'test' } },
        { email: { startsWith: 'resetuser' } },
      ],
    },
  });
  if (deletedResetTokens.count > 0) {
    console.log(` -> Cleaned ${deletedResetTokens.count} test password reset tokens.`);
  }

  // 4. Safely provision/update the single authoritative Founder Account
  console.log('\n4. Provisioning authoritative Founder account: VishalChaudhary74096@gmail.com / @vishalchaudhary...');
  const founderEmail = 'vishalchaudhary74096@gmail.com';
  let founderUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: founderEmail, mode: 'insensitive' } },
        { username: 'vishalchaudhary' },
      ],
    },
  });

  const adminSecret = process.env.ADMIN_SECRET_KEY || '1Agust@1999848448';
  const newPasswordHash = hashPassword(adminSecret);

  if (founderUser) {
    founderUser = await prisma.user.update({
      where: { id: founderUser.id },
      data: {
        email: founderEmail,
        username: 'vishalchaudhary',
        displayName: 'Vishal Chaudhary',
        role: 'founder',
        isVerified: true,
        emailVerifiedAt: founderUser.emailVerifiedAt || new Date(),
        passwordHash: founderUser.passwordHash || newPasswordHash,
        bio: 'Founder of IndoBid.lol · Back opinions with conviction.',
      },
    });
    console.log(` -> Founder account updated and verified: @${founderUser.username} (${founderUser.email}) [ID: ${founderUser.id}]`);
  } else {
    founderUser = await prisma.user.create({
      data: {
        email: founderEmail,
        username: 'vishalchaudhary',
        displayName: 'Vishal Chaudhary',
        role: 'founder',
        isVerified: true,
        emailVerifiedAt: new Date(),
        passwordHash: newPasswordHash,
        bio: 'Founder of IndoBid.lol · Back opinions with conviction.',
      },
    });
    console.log(` -> Created new Founder account: @${founderUser.username} (${founderUser.email}) [ID: ${founderUser.id}]`);
  }

  // 5. Update and publish the Founder's live debate "We’re live."
  const liveDebate = await prisma.debate.findFirst({
    where: { title: 'We’re live.' },
  });

  if (liveDebate) {
    await prisma.debate.update({
      where: { id: liveDebate.id },
      data: {
        authorId: founderUser.id,
        authorUsername: 'vishalchaudhary',
        authorDisplayName: 'Vishal Chaudhary',
        status: 'active',
        originalContribution: 0,
        totalVerifiedContribution: 0,
        contributionCount: 0,
      },
    });

    // Remove any pending test contributions on live debate
    await prisma.contribution.deleteMany({
      where: { debateId: liveDebate.id, status: 'pending_payment' },
    });

    console.log(`\n5. Live Founder debate "We’re live." is now published active with ₹0 original contribution.`);
  }

  // 6. Clean up test OTPs and visitor sessions
  const cleanedOtps = await prisma.emailOtp.deleteMany({
    where: {
      OR: [
        { email: { contains: 'test' } },
        { email: { contains: 'example.com' } },
        { expiresAt: { lt: new Date() } },
      ],
    },
  });
  console.log(`\n6. Cleaned ${cleanedOtps.count} expired/test OTP records.`);

  const testVisitorSessions = await prisma.visitorSession.deleteMany({
    where: {
      OR: [
        { sessionToken: { startsWith: 'test_' } },
        { sessionToken: { startsWith: 'visitor_test_' } },
      ],
    },
  });
  console.log(`   Cleaned ${testVisitorSessions.count} test visitor sessions.`);

  console.log('\n====================================================');
  console.log('  PRODUCTION CLEANUP COMPLETED SUCCESSFULLY');
  console.log('====================================================');
}

productionCleanup()
  .catch((e) => {
    console.error('Cleanup error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
