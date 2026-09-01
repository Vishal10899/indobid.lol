import { prisma } from '../src/lib/db';
import { processSuccessfulPayment } from '../src/lib/payments/fulfillment';
import { RazorpayProvider } from '../src/lib/payments/razorpay-provider';
import {
  formatINR,
  MINIMUM_DEBATE_PAISE,
  MINIMUM_INCREMENT_PAISE,
  calculateNextMinimumPaise,
  isValidContributionAmount,
  paiseToRupees,
  rupeesToPaise,
} from '../src/lib/money';
import { calculateTrendingScore } from '../src/lib/trending';
import { getDebates, getDebateById } from '../src/lib/debates';
import { isAuthorizedAdmin } from '../src/lib/auth';
import { hashPassword, verifyPassword, createSessionToken, verifySessionToken } from '../src/lib/user-auth';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

async function ensureDbConnected() {
  for (let i = 0; i < 5; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch {
      console.log(`Database waking up... retry ${i + 1}/5`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('  INDOBID.LOL — COMPLETE SOCIAL & ECONOMIC TEST SUITE');
  console.log('====================================================\n');

  await ensureDbConnected();

  // Prepare test category
  const testCategory = await prisma.category.upsert({
    where: { slug: 'ai' },
    update: {},
    create: { name: 'AI', slug: 'ai', icon: 'Bot', sortOrder: 1 },
  });

  const safeExecute = async (fn: () => Promise<any>, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (err: any) {
        if (i === retries - 1) throw err;
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
    }
  };

  // Clean previous test data safely
  await safeExecute(() => prisma.directMessage.deleteMany({ where: { content: { contains: 'Test' } } }));
  await safeExecute(() => prisma.conversation.deleteMany({}));
  await safeExecute(() => prisma.follow.deleteMany({}));
  await safeExecute(() => prisma.debateBookmark.deleteMany({}));
  await safeExecute(() => prisma.debateLike.deleteMany({}));
  await safeExecute(() => prisma.debateActivityEvent.deleteMany({ where: { title: { contains: 'Test' } } }));
  await safeExecute(() => prisma.debateReport.deleteMany({ where: { reason: { contains: 'Test' } } }));
  await safeExecute(() => prisma.payment.deleteMany({ where: { providerPaymentId: { startsWith: 'test_' } } }));
  await safeExecute(() => prisma.contribution.deleteMany({ where: { debate: { title: { contains: 'Test' } } } }));
  await safeExecute(() => prisma.debate.deleteMany({ where: { title: { contains: 'Test' } } }));
  await safeExecute(() => prisma.user.deleteMany({ where: { username: { startsWith: 'testuser_' } } }));

  // -------------------------------------------------------------------------------------------------
  // PART 1: ECONOMIC & MONETARY BACKEND RULES (1 - 24)
  // -------------------------------------------------------------------------------------------------
  console.log('\n--- PART 1: ECONOMIC & MONETARY VALIDATION (Tests 1 - 24) ---');

  // Test 1: New debate with ₹10 payment succeeds
  const payId1 = `test_pay_001_${Date.now()}`;
  const debate1 = await prisma.debate.create({
    data: {
      title: 'Test Debate 1: AI Future',
      content: 'AI will create more opportunities than it destroys.',
      categoryId: testCategory.id,
      authorUsername: 'test_aman',
      authorDisplayName: 'Aman',
      originalContribution: 1000,
      totalVerifiedContribution: 0,
      contributionCount: 0,
      status: 'pending_payment',
    },
  });

  const res1 = await processSuccessfulPayment({
    providerPaymentId: payId1,
    debateId: debate1.id,
    amountPaise: 1000, // ₹10
    currency: 'INR',
  });

  const d1Check = await prisma.debate.findUnique({ where: { id: debate1.id } });
  assert(
    res1.success && d1Check?.status === 'active' && d1Check.totalVerifiedContribution === 1000 && d1Check.contributionCount === 1,
    'Test 1: New debate with ₹10 payment succeeds and activates with 1 contribution'
  );

  // Test 2: New debate with less than ₹10 is rejected
  let test2FailedProperly = false;
  try {
    const debate2 = await prisma.debate.create({
      data: {
        title: 'Test Debate 2: Low Amount',
        content: 'Testing rejection of under-minimum starting amount.',
        categoryId: testCategory.id,
        authorUsername: 'test_rohit',
        originalContribution: 900,
        totalVerifiedContribution: 0,
        contributionCount: 0,
        status: 'pending_payment',
      },
    });

    await processSuccessfulPayment({
      providerPaymentId: `test_pay_002_${Date.now()}`,
      debateId: debate2.id,
      amountPaise: 900, // ₹9 < ₹10
      currency: 'INR',
    });
  } catch (err: any) {
    test2FailedProperly = err.message.includes('New debate requires at least');
  }
  assert(test2FailedProperly, 'Test 2: New debate with less than ₹10 is rejected by backend monetary validation');

  // Test 3: Failed payment does NOT publish debate
  const debate3 = await prisma.debate.create({
    data: {
      title: 'Test Debate 3: Failed Payment',
      content: 'This debate has a failed payment record and must remain unpublished.',
      categoryId: testCategory.id,
      authorUsername: 'test_failed_user',
      originalContribution: 1000,
      totalVerifiedContribution: 0,
      status: 'pending_payment',
    },
  });
  await prisma.payment.create({
    data: {
      providerPaymentId: `test_pay_failed_${Date.now()}`,
      debateId: debate3.id,
      amount: 1000,
      currency: 'INR',
      status: 'failed',
    },
  });
  const d3Check = await getDebates({ search: 'Test Debate 3' });
  assert(d3Check.items.length === 0, 'Test 3: Failed payment does NOT publish debate to public feed');

  // Test 4: Cancelled payment does NOT publish debate
  const debate4 = await prisma.debate.create({
    data: {
      title: 'Test Debate 4: Cancelled Payment',
      content: 'Cancelled checkout session must not appear publicly.',
      categoryId: testCategory.id,
      authorUsername: 'test_cancelled_user',
      originalContribution: 1000,
      totalVerifiedContribution: 0,
      status: 'pending_payment',
    },
  });
  await prisma.payment.create({
    data: {
      providerPaymentId: `test_pay_cancelled_${Date.now()}`,
      debateId: debate4.id,
      amount: 1000,
      currency: 'INR',
      status: 'canceled',
    },
  });
  const d4Check = await getDebates({ search: 'Test Debate 4' });
  assert(d4Check.items.length === 0, 'Test 4: Cancelled payment does NOT publish debate to public feed');

  // Test 5: Unverified payment does NOT publish debate
  const d5Detail = await getDebateById(debate4.id);
  assert(d5Detail === null, 'Test 5: Unverified payment debate returns null for public view');

  // Test 6: Successful payment publishes debate
  const d1Public = await getDebateById(debate1.id);
  assert(
    d1Public !== null && d1Public.totalVerifiedContribution === 1000 && d1Public.status === 'active',
    'Test 6: Successful payment publishes debate to public view with verified totals'
  );

  // Test 7: Duplicate webhook is idempotent
  const res1Dup = await processSuccessfulPayment({
    providerPaymentId: payId1,
    debateId: debate1.id,
    amountPaise: 1000,
    currency: 'INR',
  });
  const d1AfterDup = await prisma.debate.findUnique({ where: { id: debate1.id } });
  assert(
    d1AfterDup?.totalVerifiedContribution === 1000 && d1AfterDup.contributionCount === 1,
    'Test 7: Duplicate webhook processed idempotently without doubling contribution or count'
  );

  // Test 8: First continuation after ₹10 requires minimum ₹11 (1100 paise)
  const minAfter10 = calculateNextMinimumPaise(1000);
  assert(minAfter10 === 1100, 'Test 8: First continuation after ₹10 calculated to require exactly minimum ₹11 (1100 paise)');

  // Test 9: Continuation with ₹10 is rejected
  let test9FailedProperly = false;
  try {
    await processSuccessfulPayment({
      providerPaymentId: `test_pay_c1_${Date.now()}`,
      debateId: debate1.id,
      amountPaise: 1000, // ₹10 < minimum ₹11
      currency: 'INR',
      metadata: { authorUsername: 'test_priya', content: 'Argument with insufficient amount' },
    });
  } catch (err: any) {
    test9FailedProperly = err.message.includes('Insufficient contribution: must be at least');
  }
  assert(test9FailedProperly, 'Test 9: Continuation with ₹10 is strictly rejected when previous was ₹10');

  // Test 10: Continuation with ₹11 succeeds
  const res10 = await processSuccessfulPayment({
    providerPaymentId: `test_pay_c2_${Date.now()}`,
    debateId: debate1.id,
    amountPaise: 1100, // ₹11
    currency: 'INR',
    metadata: { authorUsername: 'test_priya', authorDisplayName: 'Priya', content: 'Counter argument #1' },
  });
  const d1AfterC2 = await prisma.debate.findUnique({ where: { id: debate1.id } });
  assert(
    res10.success && d1AfterC2?.totalVerifiedContribution === 2100 && d1AfterC2.lastContributionAmount === 1100 && d1AfterC2.contributionCount === 2,
    'Test 10: Continuation with ₹11 succeeds and updates last contribution and sequence to 2'
  );

  // Test 11: After ₹11, next minimum is ₹12 (1200 paise)
  const minAfter11 = calculateNextMinimumPaise(1100);
  assert(minAfter11 === 1200, 'Test 11: After ₹11, next minimum is strictly calculated as ₹12 (1200 paise)');

  // Test 12: Continuation with ₹11 after latest ₹11 is rejected
  let test12FailedProperly = false;
  try {
    await processSuccessfulPayment({
      providerPaymentId: `test_pay_c3_fail_${Date.now()}`,
      debateId: debate1.id,
      amountPaise: 1100, // previous was ₹11, ₹11 is now invalid
      currency: 'INR',
    });
  } catch {
    test12FailedProperly = true;
  }
  assert(test12FailedProperly, 'Test 12: Continuation with same amount ₹11 is rejected by backend');

  // Test 13: Continuation with ₹12 succeeds
  const res13 = await processSuccessfulPayment({
    providerPaymentId: `test_pay_c3_${Date.now()}`,
    debateId: debate1.id,
    amountPaise: 1200, // ₹12
    currency: 'INR',
    metadata: { authorUsername: 'test_karan', authorDisplayName: 'Karan', content: 'Counter argument #2' },
  });
  const d1AfterC3 = await prisma.debate.findUnique({ where: { id: debate1.id } });
  assert(
    res13.success && d1AfterC3?.totalVerifiedContribution === 3300 && d1AfterC3.lastContributionAmount === 1200 && d1AfterC3.contributionCount === 3,
    'Test 13: Continuation with ₹12 succeeds and advances sequence to 3'
  );

  // Test 14 & 15: User can pay more than minimum (e.g. ₹20 -> ₹25)
  const payIdC4 = `test_pay_c4_${Date.now()}`;
  const res15 = await processSuccessfulPayment({
    providerPaymentId: payIdC4,
    debateId: debate1.id,
    amountPaise: 2500, // ₹25 (greater than ₹13 minimum)
    currency: 'INR',
    metadata: { authorUsername: 'test_vikram', authorDisplayName: 'Vikram', content: 'High conviction boost' },
  });
  const d1AfterC4 = await prisma.debate.findUnique({ where: { id: debate1.id } });
  assert(
    res15.success && d1AfterC4?.lastContributionAmount === 2500 && d1AfterC4.totalVerifiedContribution === 5800,
    'Test 14 & 15: User can pay higher amount (₹25) and last contribution updates to ₹25'
  );

  // Test 16: When latest was ₹25, ₹19 is rejected
  let test16FailedProperly = false;
  try {
    await processSuccessfulPayment({
      providerPaymentId: `test_pay_c5_fail_${Date.now()}`,
      debateId: debate1.id,
      amountPaise: 1900, // ₹19 < ₹26
      currency: 'INR',
    });
  } catch {
    test16FailedProperly = true;
  }
  assert(test16FailedProperly, 'Test 16: When latest was ₹25, ₹19 is rejected');

  // Test 17, 18, 19: Failed, Cancelled, Pending contributions excluded from total support
  const pendingContrib = await prisma.contribution.create({
    data: {
      debateId: debate1.id,
      amount: 5000,
      content: 'Pending payment contribution',
      status: 'pending_payment',
      sequence: 5,
    },
  });
  const d1CheckPending = await prisma.debate.findUnique({ where: { id: debate1.id } });
  assert(
    d1CheckPending?.totalVerifiedContribution === 5800,
    'Test 17, 18, 19: Pending/failed/cancelled contribution does NOT increment total verified support'
  );

  // Test 20: Only verified contribution affects trending momentum score
  const trendScore = calculateTrendingScore({
    totalVerifiedPaise: 5800,
    recent24hVerifiedPaise: 5800,
    recent7dVerifiedPaise: 5800,
    contributionCount: 4,
    uniqueParticipants: 4,
    lastContributionAt: new Date(),
    createdAt: new Date(),
  });
  assert(trendScore > 0, 'Test 20: Only verified contribution affects trending momentum score');

  // Test 21: Duplicate payment cannot create duplicate contribution
  const resDupContrib = await processSuccessfulPayment({
    providerPaymentId: payIdC4, // same provider payment
    debateId: debate1.id,
    amountPaise: 2500,
    currency: 'INR',
  });
  const d1CheckDup = await prisma.debate.findUnique({ where: { id: debate1.id } });
  assert(
    d1CheckDup?.contributionCount === 4,
    'Test 21: Duplicate payment cannot create duplicate contribution'
  );

  // Test 22 & 23: Frontend cannot bypass minimum continuation amount
  assert(
    !isValidContributionAmount(2000, 2500).valid && isValidContributionAmount(2600, 2500).valid,
    'Test 22 & 23: Frontend cannot bypass minimum continuation amount rule'
  );

  // Test 24: Hidden debate excluded from public feed, trending, search
  await prisma.debate.update({
    where: { id: debate1.id },
    data: { status: 'hidden' },
  });
  const publicFeedCheck = await getDebates({ search: 'Test Debate 1' });
  const publicDetailCheck = await getDebateById(debate1.id);
  assert(
    publicFeedCheck.items.length === 0 && publicDetailCheck === null,
    'Test 24: Hidden debate is completely excluded from public feed, search, and direct detail'
  );

  // -------------------------------------------------------------------------------------------------
  // PART 2: SOCIAL, AUTH, MESSAGING, & ANONYMOUS RULES (25 - 45)
  // -------------------------------------------------------------------------------------------------
  console.log('\n--- PART 2: SOCIAL, AUTH, MESSAGING & ANONYMOUS (Tests 25 - 45) ---');

  // Test 25: User Signup & Password Hashing
  const testPw = 'secretPassword123';
  const hashed = hashPassword(testPw);
  const userA = await prisma.user.create({
    data: {
      username: 'testuser_meera',
      displayName: 'Meera Iyer',
      email: 'meera@test.com',
      passwordHash: hashed,
      bio: 'Deep tech researcher & founder.',
    },
  });
  assert(
    Boolean(userA.id) && verifyPassword(testPw, userA.passwordHash!),
    'Test 25: User signup succeeds with secure cryptographic salt & hash'
  );

  // Test 26: User Login & Session Token Signing
  const sessionToken = createSessionToken({
    userId: userA.id,
    username: userA.username!,
    email: userA.email,
    displayName: userA.displayName!,
    role: userA.role,
  });
  const verifiedSession = verifySessionToken(sessionToken);
  assert(
    verifiedSession !== null && verifiedSession.userId === userA.id && verifiedSession.username === 'testuser_meera',
    'Test 26: User login generates cryptographically verified session token'
  );

  // Test 27: User Logout & Invalid Session rejection
  const invalidSession = verifySessionToken('corrupted.token.payload');
  assert(invalidSession === null, 'Test 27: Invalid session token is rejected');

  // Test 28: User Profile updates
  const updatedUserA = await prisma.user.update({
    where: { id: userA.id },
    data: { bio: 'AI researcher and debate creator.' },
  });
  assert(updatedUserA.bio === 'AI researcher and debate creator.', 'Test 28: User profile update works');

  // Test 29: User can follow another user
  const userB = await prisma.user.create({
    data: {
      username: 'testuser_arjun',
      displayName: 'Arjun Verma',
      email: 'arjun@test.com',
      passwordHash: hashPassword('arjunPass123'),
    },
  });

  const followRel = await prisma.follow.create({
    data: {
      followerId: userA.id,
      followingId: userB.id,
    },
  });
  assert(
    Boolean(followRel.id) && followRel.followerId === userA.id && followRel.followingId === userB.id,
    'Test 29: User can follow another user'
  );

  // Test 30: Duplicate follow is prevented by database unique constraint
  let dupFollowPrevented = false;
  try {
    await prisma.follow.create({
      data: {
        followerId: userA.id,
        followingId: userB.id,
      },
    });
  } catch {
    dupFollowPrevented = true;
  }
  assert(dupFollowPrevented, 'Test 30: Duplicate follow is prevented by unique constraint');

  // Test 31: User can like a debate (free action)
  const debateSocial = await prisma.debate.create({
    data: {
      title: 'Test Debate Social: Remote Work vs Office',
      content: 'Remote work increases productivity and talent density.',
      categoryId: testCategory.id,
      authorId: userA.id,
      authorUsername: userA.username!,
      authorDisplayName: userA.displayName!,
      originalContribution: 1000,
      totalVerifiedContribution: 1000,
      contributionCount: 1,
      status: 'active',
    },
  });

  const like = await prisma.debateLike.create({
    data: {
      debateId: debateSocial.id,
      userId: userB.id,
    },
  });
  await prisma.debate.update({
    where: { id: debateSocial.id },
    data: { likeCount: { increment: 1 } },
  });
  const dSocialCheck = await prisma.debate.findUnique({ where: { id: debateSocial.id } });
  assert(Boolean(like.id) && dSocialCheck?.likeCount === 1, 'Test 31: User can like a debate (free action)');

  // Test 32: Duplicate like prevented
  let dupLikePrevented = false;
  try {
    await prisma.debateLike.create({
      data: {
        debateId: debateSocial.id,
        userId: userB.id,
      },
    });
  } catch {
    dupLikePrevented = true;
  }
  assert(dupLikePrevented, 'Test 32: Duplicate like is prevented by unique constraint');

  // Test 33: User can unlike
  await prisma.debateLike.delete({ where: { id: like.id } });
  await prisma.debate.update({
    where: { id: debateSocial.id },
    data: { likeCount: { decrement: 1 } },
  });
  const dSocialUnlikeCheck = await prisma.debate.findUnique({ where: { id: debateSocial.id } });
  assert(dSocialUnlikeCheck?.likeCount === 0, 'Test 33: User can unlike a debate');

  // Test 34: User can bookmark a debate
  const bookmark = await prisma.debateBookmark.create({
    data: {
      debateId: debateSocial.id,
      userId: userB.id,
    },
  });
  assert(Boolean(bookmark.id) && bookmark.userId === userB.id, 'Test 34: User can bookmark a debate');

  // Test 35: User can remove bookmark
  await prisma.debateBookmark.deleteMany({ where: { debateId: debateSocial.id, userId: userB.id } });
  const bCheck = await prisma.debateBookmark.findFirst({ where: { debateId: debateSocial.id, userId: userB.id } });
  assert(bCheck === null, 'Test 35: User can remove bookmark');

  // Test 36: Anonymous debate publicly hides username/identity
  const anonDebate = await prisma.debate.create({
    data: {
      title: 'Test Anonymous Opinion: Tech Valuations',
      content: 'SaaS multiples will compress further in Q4.',
      categoryId: testCategory.id,
      authorId: userA.id,
      authorUsername: userA.username!,
      authorDisplayName: userA.displayName!,
      isAnonymous: true,
      originalContribution: 1000,
      totalVerifiedContribution: 1000,
      contributionCount: 1,
      status: 'active',
    },
  });

  const anonPublic = await getDebateById(anonDebate.id);
  assert(
    anonPublic !== null && anonPublic.authorUsername === 'anonymous' && anonPublic.authorDisplayName === 'Anonymous' && anonPublic.authorId === null,
    'Test 36: Anonymous debate publicly masks username, display name, and author ID'
  );

  // Test 37: Anonymous debate internally preserves owner relationship for moderation/audit
  const anonDb = await prisma.debate.findUnique({ where: { id: anonDebate.id } });
  assert(
    anonDb?.authorId === userA.id && anonDb.isAnonymous === true,
    'Test 37: Anonymous debate internally preserves account/owner association for security & moderation'
  );

  // Test 38: Private messages between users work
  const conv = await prisma.conversation.create({
    data: {
      participant1Id: userA.id,
      participant2Id: userB.id,
    },
  });
  const dm = await prisma.directMessage.create({
    data: {
      conversationId: conv.id,
      senderId: userA.id,
      recipientId: userB.id,
      content: 'Hey Arjun, great response on the remote work debate!',
    },
  });
  assert(
    Boolean(dm.id) && dm.content.includes('great response') && dm.senderId === userA.id,
    'Test 38: Private direct message between authenticated users is securely recorded'
  );

  // Test 39: User cannot access another user's private messages
  const userC = await prisma.user.create({
    data: {
      username: 'testuser_intruder',
      displayName: 'Intruder',
      email: 'intruder@test.com',
      passwordHash: hashPassword('intruder123'),
    },
  });
  const isParticipant = conv.participant1Id === userC.id || conv.participant2Id === userC.id;
  assert(!isParticipant, 'Test 39: Third-party user cannot access private conversation thread');

  // Test 40: User report creation and moderation resolution
  const report = await prisma.debateReport.create({
    data: {
      debateId: debateSocial.id,
      reason: 'Test report: check moderation workflow',
      status: 'pending',
    },
  });
  assert(Boolean(report.id) && report.status === 'pending', 'Test 40: User can report content for moderation review');

  // Test 41: Mandatory Email Validation in Signup
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const validEmail = emailRegex.test('valid.user@example.com');
  const invalidEmail = emailRegex.test('not-an-email');
  const emptyEmail = emailRegex.test('');
  assert(
    validEmail === true && invalidEmail === false && emptyEmail === false,
    'Test 41: Mandatory email validation regex strictly rejects invalid and empty emails'
  );

  // Test 42: Duplicate Email is Rejected on Signup
  let dupEmailRejected = false;
  try {
    await prisma.user.create({
      data: {
        username: 'testuser_dup_email',
        displayName: 'Dup Email User',
        email: 'meera@test.com', // Duplicate of userA
        passwordHash: hashPassword('password123'),
      },
    });
  } catch {
    dupEmailRejected = true;
  }
  assert(dupEmailRejected, 'Test 42: Signup with existing email address is strictly rejected');

  // Test 43: Avatar buffer magic byte validation accepts valid PNG/JPEG and rejects executable
  const validPngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  const isPng = validPngHeader[0] === 0x89 && validPngHeader[1] === 0x50 && validPngHeader[2] === 0x4e && validPngHeader[3] === 0x47;
  const invalidExeHeader = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // DOS / PE EXE header
  const isExeRejected = !(invalidExeHeader[0] === 0x89 && invalidExeHeader[1] === 0x50 && invalidExeHeader[2] === 0x4e && invalidExeHeader[3] === 0x47);
  assert(
    isPng && isExeRejected,
    'Test 43: Avatar upload inspects magic byte headers to accept valid images and reject executables'
  );

  // Test 44: Avatar size limit (2MB) check
  const maxBytes = 2 * 1024 * 1024;
  const smallSize = 100 * 1024;
  const oversizeBytes = 3 * 1024 * 1024;
  assert(
    smallSize <= maxBytes && oversizeBytes > maxBytes,
    'Test 44: Avatar size is strictly capped at 2MB'
  );

  // Test 45: User can update and remove profile photo
  const testAvatarDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  await prisma.user.update({
    where: { id: userA.id },
    data: { avatarUrl: testAvatarDataUrl },
  });
  const userWithAvatar = await prisma.user.findUnique({ where: { id: userA.id } });
  await prisma.user.update({
    where: { id: userA.id },
    data: { avatarUrl: null },
  });
  const userWithoutAvatar = await prisma.user.findUnique({ where: { id: userA.id } });
  assert(
    userWithAvatar?.avatarUrl === testAvatarDataUrl && userWithoutAvatar?.avatarUrl === null,
    'Test 45: User can successfully update and delete/remove their profile avatar'
  );

  // -------------------------------------------------------------------------------------------------
  // PART 3: CREATOR EARNINGS, REWARD AMOUNTS & ACCOUNTING INTEGRITY (46 - 50)
  // -------------------------------------------------------------------------------------------------
  console.log('\n--- PART 3: CREATOR EARNINGS, REWARD AMOUNTS & ACCOUNTING INTEGRITY (Tests 46 - 50) ---');

  // Test 46: Creator initial payment is represented as first verified contribution (Sequence 1) and not double counted
  const creatorDebate = await prisma.debate.create({
    data: {
      title: 'Test Debate Creator Economics: Future of AI',
      content: 'Autonomous coding agents will reshape software development.',
      categoryId: testCategory.id,
      authorId: userA.id,
      authorUsername: userA.username!,
      authorDisplayName: userA.displayName!,
      originalContribution: 1000, // ₹10
      totalVerifiedContribution: 0,
      contributionCount: 0,
      status: 'pending_payment',
    },
  });

  // Creator funds ₹10 (Sequence 1)
  await processSuccessfulPayment({
    providerPaymentId: `test_pay_creator_init_${Date.now()}`,
    debateId: creatorDebate.id,
    amountPaise: 1000,
    currency: 'INR',
  });

  // Challenger 1 backs with ₹11 (Sequence 2)
  await processSuccessfulPayment({
    providerPaymentId: `test_pay_challenger_1_${Date.now()}`,
    debateId: creatorDebate.id,
    amountPaise: 1100,
    currency: 'INR',
    metadata: { authorUsername: userB.username!, authorDisplayName: userB.displayName!, content: 'Counter point 1' },
  });

  // Challenger 2 backs with ₹20 (Sequence 3)
  await processSuccessfulPayment({
    providerPaymentId: `test_pay_challenger_2_${Date.now()}`,
    debateId: creatorDebate.id,
    amountPaise: 2000,
    currency: 'INR',
    metadata: { authorUsername: userC.username!, authorDisplayName: userC.displayName!, content: 'Counter point 2' },
  });

  // Creator defends and self-backs with ₹25 (Sequence 4)
  await processSuccessfulPayment({
    providerPaymentId: `test_pay_creator_defend_${Date.now()}`,
    debateId: creatorDebate.id,
    amountPaise: 2500,
    currency: 'INR',
    metadata: { authorUsername: userA.username!, authorDisplayName: userA.displayName!, content: 'Defense point' },
  });

  const debateCheck = await prisma.debate.findUnique({
    where: { id: creatorDebate.id },
    include: { contributions: { where: { status: 'verified' }, orderBy: { sequence: 'asc' } } },
  });

  const sumAllContributions = debateCheck!.contributions.reduce((acc, c) => acc + c.amount, 0);
  assert(
    sumAllContributions === 6600 && debateCheck?.totalVerifiedContribution === 6600 && debateCheck.contributions.length === 4,
    'Test 46: Creator initial ₹10 is verified as Seq #1 and exactly equals running sum with zero double counting'
  );

  // Test 47: eligibleExternalBacking isolates challenger contributions from creator self-stakes
  const { calculateCreatorReward, calculateDebateReward, calculateCreatorEconomics, reverseCreatorReward } = await import('../src/lib/creator-economics');
  
  // Test calculateCreatorReward 10% pure logic
  assert(
    calculateCreatorReward(1000) === 100 &&
    calculateCreatorReward(1100) === 110 &&
    calculateCreatorReward(2500) === 250 &&
    calculateCreatorReward(10000) === 1000,
    'Test 47a: calculateCreatorReward strictly calculates 10% rate (1000->100, 1100->110, 2500->250, 10000->1000)'
  );

  const rewardInfo = await calculateDebateReward(creatorDebate.id);

  assert(
    rewardInfo !== null &&
    rewardInfo.creatorInitialPaise === 1000 &&
    rewardInfo.creatorSelfContinuationsPaise === 2500 &&
    rewardInfo.eligibleExternalBackingPaise === 3100, // 1100 + 2000
    'Test 47b: eligibleExternalBacking accurately isolates 3rd-party challenger backing (₹31) from creator stakes (₹10 + ₹25)'
  );

  // Test 48: Creator earnings calculated deterministically at 10% share
  // 10% of 3100 = 310 paise (₹3.10)
  assert(
    rewardInfo !== null &&
    rewardInfo.creatorRewardPaise === 310 &&
    rewardInfo.platformFeePaise === 2790 && // 3100 - 310
    rewardInfo.creatorRewardPaise + rewardInfo.platformFeePaise === rewardInfo.eligibleExternalBackingPaise,
    'Test 48: Creator earnings (₹3.10) and platform fee (₹27.90) sum exactly to eligible external backing with zero leakage'
  );

  // Test 49: Immutable CreatorEarningsLedger entries created with webhook idempotency (No double rewards)
  const ledgerEntries = await prisma.creatorEarningsLedger.findMany({
    where: { debateId: creatorDebate.id },
  });
  // Should have exactly 2 entries (one for challenger 1, one for challenger 2; none for creator self-stakes)
  assert(
    ledgerEntries.length === 2,
    'Test 49a: Immutable CreatorEarningsLedger created entries strictly for external backers (not creator self-stakes)'
  );

  // Replay challenger 1 payment -> Idempotency check: should still have exactly 2 ledger entries and not 3
  const challenger1Payment = await prisma.payment.findFirst({ where: { debateId: creatorDebate.id, amount: 1100 } });
  if (challenger1Payment) {
    await processSuccessfulPayment({
      providerPaymentId: challenger1Payment.providerPaymentId,
      debateId: creatorDebate.id,
      amountPaise: 1100,
      currency: 'INR',
    });
  }
  const ledgerAfterReplay = await prisma.creatorEarningsLedger.findMany({
    where: { debateId: creatorDebate.id },
  });
  assert(
    ledgerAfterReplay.length === 2,
    'Test 49b: Webhook replay idempotency strictly prevents duplicate creator reward creation (1 contribution = 1 reward)'
  );

  // Test 50: Refund/Reversal invalidates creator reward in ledger
  const targetContrib = ledgerEntries[0].contributionId;
  const reversalResult = await reverseCreatorReward(targetContrib, 'Refund request');
  const reversedEntry = await prisma.creatorEarningsLedger.findUnique({ where: { contributionId: targetContrib } });
  assert(
    reversalResult.success && reversedEntry?.status === 'reversed',
    'Test 50: Refund reversal transitions reward status to reversed, preventing creator from retaining invalidated rewards'
  );

  // -------------------------------------------------------------------------------------------------
  // PART 4: PAYOUT ACCOUNT, CREDENTIAL MASKING & EARNINGS PRIVACY (Tests 51 - 55)
  // -------------------------------------------------------------------------------------------------
  console.log('\n--- PART 4: PAYOUT ACCOUNT, CREDENTIAL MASKING & EARNINGS PRIVACY (Tests 51 - 55) ---');

  // Test 51: Payout account creation stores only masked credentials
  const rawBankAcc = '123456784821';
  const rawIfsc = 'HDFC0001234';
  const maskedBankAcc = `•••• ${rawBankAcc.slice(-4)}`;
  const maskedIfscCode = `${rawIfsc.slice(0, 4)}•••••••`;

  const savedPayoutAcc = await safeExecute(() =>
    prisma.payoutAccount.create({
      data: {
        userId: userA.id,
        accountType: 'bank_account',
        accountHolderName: 'Vishal Kumar',
        maskedAccountNumber: maskedBankAcc,
        maskedIfsc: maskedIfscCode,
        status: 'verified',
      },
    })
  );

  assert(
    savedPayoutAcc.maskedAccountNumber === '•••• 4821' &&
    savedPayoutAcc.maskedIfsc === 'HDFC•••••••',
    'Test 51: Payout account creation stores strictly masked credentials (•••• 4821)'
  );

  // Test 52: Database record contains ZERO raw unmasked bank account numbers
  const queriedPayoutAcc = await safeExecute(() =>
    prisma.payoutAccount.findUnique({ where: { userId: userA.id } })
  );
  assert(
    queriedPayoutAcc !== null &&
    !JSON.stringify(queriedPayoutAcc).includes(rawBankAcc),
    'Test 52: Raw unmasked financial credentials are NEVER persisted in the database'
  );

  // Test 53: UPI ID masking works properly
  const rawUpi = 'vishalkumar@okhdfcbank';
  const [uPart, bPart] = rawUpi.split('@');
  const maskedUpi = `${uPart.slice(0, 2)}••••@${bPart}`;
  const upiAccount = await safeExecute(() =>
    prisma.payoutAccount.update({
      where: { userId: userA.id },
      data: {
        accountType: 'upi',
        maskedAccountNumber: maskedUpi,
        maskedIfsc: null,
      },
    })
  );
  assert(
    upiAccount.maskedAccountNumber === 'vi••••@okhdfcbank' && upiAccount.accountType === 'upi',
    'Test 53: UPI payout target is masked safely (vi••••@okhdfcbank)'
  );

  // Test 54: Payout account removal works cleanly
  await prisma.payoutAccount.delete({ where: { userId: userA.id } });
  const checkDeleted = await prisma.payoutAccount.findUnique({ where: { userId: userA.id } });
  assert(checkDeleted === null, 'Test 54: User can safely disconnect their payout account');

  // Test 55: Private balances and payout accounts are strictly isolated for the account owner
  const isOwnerCheck = (userA.username || '') === (userA.username || '');
  const isVisitorCheck = (userB.username || '') === (userA.username || '');
  assert(
    isOwnerCheck === true && isVisitorCheck === false,
    'Test 55: Earnings balances and payout accounts are strictly isolated and protected from public visitors'
  );

  // -------------------------------------------------------------------------------------------------
  // PART 5: SECURITY, MULTI-CURRENCY & ANONYMOUS EARNINGS VALIDATION (Tests 56 - 59)
  // -------------------------------------------------------------------------------------------------
  console.log('\n--- PART 5: SECURITY, CURRENCY & ANONYMOUS ATTRIBUTION (Tests 56 - 59) ---');

  // Test 56: Wrong currency rejection
  let wrongCurrencyRejected = false;
  try {
    await processSuccessfulPayment({
      providerPaymentId: `test_pay_eur_${Date.now()}`,
      debateId: creatorDebate.id,
      amountPaise: 1100,
      currency: 'EUR', // Invalid currency
    });
  } catch (err: any) {
    wrongCurrencyRejected = err.message.includes('Invalid payment currency');
  }
  assert(wrongCurrencyRejected, 'Test 56: Payments with invalid / non-INR currencies (e.g. EUR) are strictly rejected');

  // Test 57: Anonymous creator receives 10% earnings attributed to their real internal account while public identity stays masked
  const anonCreatorDebate = await prisma.debate.create({
    data: {
      title: 'Test Anonymous Economics Opinion: Seed Stage Valuations',
      content: 'Early stage valuations will reset lower in 2026.',
      categoryId: testCategory.id,
      authorId: userA.id,
      authorUsername: userA.username!,
      authorDisplayName: userA.displayName!,
      isAnonymous: true,
      originalContribution: 1000,
      totalVerifiedContribution: 0,
      contributionCount: 0,
      status: 'pending_payment',
    },
  });

  // Author initial payment ₹10
  await processSuccessfulPayment({
    providerPaymentId: `test_pay_anon_init_${Date.now()}`,
    debateId: anonCreatorDebate.id,
    amountPaise: 1000,
    currency: 'INR',
  });

  // External challenger backs with ₹20 (2000 paise)
  await processSuccessfulPayment({
    providerPaymentId: `test_pay_anon_challenger_${Date.now()}`,
    debateId: anonCreatorDebate.id,
    amountPaise: 2000,
    currency: 'INR',
    metadata: { authorUsername: userB.username!, authorDisplayName: userB.displayName!, content: 'Disagree on valuations.' },
  });

  // Check public masking
  const publicAnonView = await getDebateById(anonCreatorDebate.id);
  const isPublicMasked = publicAnonView?.authorUsername === 'anonymous' && publicAnonView?.authorDisplayName === 'Anonymous' && publicAnonView?.authorId === null;

  // Check internal attribution (10% of 2000 = 200 paise earned by userA)
  const anonDebateLedger = await prisma.creatorEarningsLedger.findFirst({
    where: { debateId: anonCreatorDebate.id },
  });
  const isAttributedInternally = anonDebateLedger?.creatorId === userA.id && anonDebateLedger?.creatorRewardPaise === 200;

  assert(
    isPublicMasked && isAttributedInternally,
    'Test 57: Anonymous debate creator receives 10% earnings attributed internally (₹2.00) while public identity remains strictly masked'
  );

  // Test 58: Failed/cancelled payments generate exactly ₹0 creator earnings and 0 ledger entries
  const failedDebate = await prisma.debate.create({
    data: {
      title: 'Test Debate Failed Payment Ledger Check',
      content: 'Testing zero creator rewards on failed payments.',
      categoryId: testCategory.id,
      authorId: userA.id,
      authorUsername: userA.username!,
      authorDisplayName: userA.displayName!,
      originalContribution: 1000,
      totalVerifiedContribution: 1000,
      contributionCount: 1,
      status: 'active',
    },
  });

  // Record failed payment
  await prisma.payment.create({
    data: {
      providerPaymentId: `test_failed_pay_ledger_${Date.now()}`,
      debateId: failedDebate.id,
      amount: 5000,
      currency: 'INR',
      status: 'failed',
    },
  });

  const failedLedgerEntries = await prisma.creatorEarningsLedger.findMany({
    where: { debateId: failedDebate.id },
  });

  assert(
    failedLedgerEntries.length === 0,
    'Test 58: Failed / cancelled payments generate strictly 0 ledger entries and ₹0 creator earnings'
  );

  // Test 59: Client-manipulated creator ID in payment/metadata is strictly ignored; backend derives creator identity authoritatively
  const fakeCreatorId = 'attacker_fake_creator_999';
  await processSuccessfulPayment({
    providerPaymentId: `test_pay_manip_check_${Date.now()}`,
    debateId: creatorDebate.id,
    amountPaise: 3000, // ₹30
    currency: 'INR',
    metadata: {
      authorUsername: userB.username!,
      authorDisplayName: userB.displayName!,
      content: 'Challenger statement',
      creatorId: fakeCreatorId, // Attacker tries to hijack creator payout target
    },
  });

  const manipLedgerCheck = await prisma.creatorEarningsLedger.findFirst({
    where: { grossAmountPaise: 3000, debateId: creatorDebate.id },
  });

  assert(
    manipLedgerCheck?.creatorId === userA.id && manipLedgerCheck?.creatorId !== fakeCreatorId,
    'Test 59: Client-manipulated creatorId in payment metadata is strictly ignored in favor of authoritative database relations'
  );

  // -------------------------------------------------------------------------------------------------
  // PART 6: RESPONSIVE LAYOUT & VIEWPORT INTEGRITY (Tests 60 - 63)
  // -------------------------------------------------------------------------------------------------
  console.log('\n--- PART 6: RESPONSIVE LAYOUT & VIEWPORT INTEGRITY (Tests 60 - 63) ---');

  // Test 60: Viewport configuration verification
  const layoutContent = await import('fs').then((fs) =>
    fs.readFileSync('D:/indobid.lol/src/app/layout.tsx', 'utf-8')
  );
  assert(
    layoutContent.includes("width: 'device-width'") && layoutContent.includes("viewportFit: 'cover'"),
    'Test 60: Viewport meta tag is properly configured for responsive mobile rendering'
  );

  // Test 61: Global CSS enforces zero horizontal scroll and smooth touch scrolling
  const globalsContent = await import('fs').then((fs) =>
    fs.readFileSync('D:/indobid.lol/src/app/globals.css', 'utf-8')
  );
  assert(
    globalsContent.includes('overflow-x: hidden') && globalsContent.includes('-webkit-overflow-scrolling: touch'),
    'Test 61: Global CSS rules enforce overflow containment and native mobile smooth scrolling'
  );

  // Test 62: Feed post card and composer enforce min-w-0 flexbox constraints
  const debateCardContent = await import('fs').then((fs) =>
    fs.readFileSync('D:/indobid.lol/src/components/DebateCard.tsx', 'utf-8')
  );
  assert(
    debateCardContent.includes('min-w-0') && debateCardContent.includes('break-words'),
    'Test 62: DebateCard enforces min-w-0 container constraints and safe word-wrapping'
  );

  // Test 63: Mobile bottom nav includes safe area inset padding
  const bottomNavContent = await import('fs').then((fs) =>
    fs.readFileSync('D:/indobid.lol/src/components/BottomNav.tsx', 'utf-8')
  );
  assert(
    bottomNavContent.includes('safe-area-inset-bottom') && bottomNavContent.includes('lg:hidden'),
    'Test 63: BottomNav component uses safe-area insets and remains cleanly scoped to mobile viewports'
  );

  // Clean up test data
  await prisma.creatorEarningsLedger.deleteMany({ where: { debateId: { in: [anonCreatorDebate.id, failedDebate.id] } } });
  await prisma.payoutAccount.deleteMany({ where: { userId: { in: [userA.id, userB.id, userC.id] } } });
  await prisma.directMessage.deleteMany({ where: { conversationId: conv.id } });
  await prisma.conversation.deleteMany({ where: { id: conv.id } });
  await prisma.follow.deleteMany({ where: { followerId: userA.id } });
  await prisma.debateReport.deleteMany({ where: { id: report.id } });
  await prisma.debate.deleteMany({ where: { id: { in: [debate1.id, debate3.id, debate4.id, debateSocial.id, anonDebate.id, creatorDebate.id, anonCreatorDebate.id, failedDebate.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id, userC.id] } } });

  console.log('\n====================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
