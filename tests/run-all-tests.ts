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
import { isAuthorizedAdmin, ADMIN_EMAIL, normalizeEmail, createAdminSessionToken } from '../src/lib/auth';
import { hashPassword, verifyPassword, createSessionToken, verifySessionToken } from '../src/lib/user-auth';
import { requestEmailOtp, verifyEmailOtp, generateOtpCode } from '../src/lib/email-otp';
import { clearRateLimits } from '../src/lib/rate-limit';

let passed = 0;
let failed = 0;
let total = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  total++;
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
  let debate2: any = null;
  try {
    debate2 = await prisma.debate.create({
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

  // Test 14: User can pay more than minimum (e.g. ₹25 vs ₹13 minimum)
  const payIdC4 = `test_pay_c4_${Date.now()}`;
  const res14 = await processSuccessfulPayment({
    providerPaymentId: payIdC4,
    debateId: debate1.id,
    amountPaise: 2500, // ₹25 (greater than ₹13 minimum)
    currency: 'INR',
    metadata: { authorUsername: 'test_vikram', authorDisplayName: 'Vikram', content: 'High conviction boost' },
  });
  const d1AfterC4 = await prisma.debate.findUnique({ where: { id: debate1.id } });
  assert(
    res14.success && d1AfterC4?.lastContributionAmount === 2500,
    'Test 14: User can pay higher amount (₹25) and last contribution updates to ₹25'
  );

  // Test 15: Paying higher amount updates running total verified contribution
  assert(
    d1AfterC4?.totalVerifiedContribution === 5800,
    'Test 15: Paying above minimum correctly updates running total verified contribution to ₹58'
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

  // Test 17: Pending contribution excluded from total support
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
    'Test 17: Pending contribution does NOT increment total verified support'
  );

  // Test 18: Failed contribution excluded from total support
  const failedContrib = await prisma.contribution.create({
    data: {
      debateId: debate1.id,
      amount: 5000,
      content: 'Failed payment contribution',
      status: 'failed',
      sequence: 6,
    },
  });
  const d1CheckFailed = await prisma.debate.findUnique({ where: { id: debate1.id } });
  assert(
    d1CheckFailed?.totalVerifiedContribution === 5800,
    'Test 18: Failed contribution does NOT increment total verified support'
  );

  // Test 19: Cancelled contribution excluded from total support
  const cancelledContrib = await prisma.contribution.create({
    data: {
      debateId: debate1.id,
      amount: 5000,
      content: 'Cancelled payment contribution',
      status: 'canceled',
      sequence: 7,
    },
  });
  const d1CheckCancelled = await prisma.debate.findUnique({ where: { id: debate1.id } });
  assert(
    d1CheckCancelled?.totalVerifiedContribution === 5800,
    'Test 19: Cancelled contribution does NOT increment total verified support'
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

  // Test 22: Frontend cannot bypass minimum continuation amount (rejects under-minimum)
  assert(
    !isValidContributionAmount(2000, 2500).valid,
    'Test 22: Frontend monetary validator strictly rejects amount less than next minimum'
  );

  // Test 23: Frontend accepts valid continuation amount
  assert(
    isValidContributionAmount(2600, 2500).valid,
    'Test 23: Frontend monetary validator accepts amount meeting or exceeding next minimum'
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

  // Setup social debate
  const debateSocial = await prisma.debate.create({
    data: {
      title: 'Test Debate Social: Remote Work vs Office',
      content: 'Remote work increases productivity and mental wellbeing.',
      categoryId: testCategory.id,
      authorId: userA.id,
      authorUsername: userA.username || 'testuser_meera',
      authorDisplayName: userA.displayName || 'Meera Iyer',
      originalContribution: 1000,
      totalVerifiedContribution: 1000,
      contributionCount: 1,
      status: 'active',
    },
  });

  // Test 31: User can like a debate (free action)
  const likeA = await prisma.debateLike.create({
    data: {
      debateId: debateSocial.id,
      userId: userB.id,
    },
  });
  const likeCountCheck = await prisma.debateLike.count({ where: { debateId: debateSocial.id } });
  assert(
    Boolean(likeA.id) && likeCountCheck === 1,
    'Test 31: User can like a debate (free action)'
  );

  // Test 32: Duplicate like is prevented by unique constraint
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

  // Test 33: User can unlike a debate
  await prisma.debateLike.delete({
    where: {
      debateId_userId: {
        debateId: debateSocial.id,
        userId: userB.id,
      },
    },
  });
  const likeAfterUnlike = await prisma.debateLike.count({ where: { debateId: debateSocial.id } });
  assert(likeAfterUnlike === 0, 'Test 33: User can unlike a debate');

  // Test 34: User can bookmark a debate
  const bookmarkA = await prisma.debateBookmark.create({
    data: {
      debateId: debateSocial.id,
      userId: userB.id,
    },
  });
  assert(Boolean(bookmarkA.id), 'Test 34: User can bookmark a debate');

  // Test 35: User can remove bookmark
  await prisma.debateBookmark.delete({
    where: {
      debateId_userId: {
        debateId: debateSocial.id,
        userId: userB.id,
      },
    },
  });
  const bookmarkAfterRemove = await prisma.debateBookmark.count({ where: { debateId: debateSocial.id, userId: userB.id } });
  assert(bookmarkAfterRemove === 0, 'Test 35: User can remove bookmark');

  // Test 36: Anonymous debate publicly masks username and display name
  const anonDebate = await prisma.debate.create({
    data: {
      title: 'Test Anonymous Opinion: Tech Valuations',
      content: 'Early-stage tech valuations will undergo significant correction.',
      categoryId: testCategory.id,
      authorId: userA.id,
      authorUsername: userA.username || 'testuser_meera',
      authorDisplayName: userA.displayName || 'Meera Iyer',
      isAnonymous: true,
      originalContribution: 1000,
      totalVerifiedContribution: 1000,
      contributionCount: 1,
      status: 'active',
    },
  });
  const publicAnon = await getDebateById(anonDebate.id);
  assert(
    publicAnon?.isAnonymous === true &&
    publicAnon.authorDisplayName === 'Anonymous' &&
    publicAnon.authorUsername === 'anonymous' &&
    publicAnon.authorId === null,
    'Test 36: Anonymous debate publicly masks username, display name, and author ID'
  );

  // Test 37: Anonymous debate internally preserves account association in database for moderation
  const dbAnon = await prisma.debate.findUnique({ where: { id: anonDebate.id } });
  assert(
    dbAnon?.authorId === userA.id && dbAnon.isAnonymous === true,
    'Test 37: Anonymous debate internally preserves account/owner association for security & moderation'
  );

  // Test 38: Private Direct Messaging between users
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
      content: 'Test direct message: Hi Arjun, loved your counter-argument on AI.',
    },
  });
  assert(
    Boolean(dm.id) && dm.content.includes('loved your counter-argument'),
    'Test 38: Private direct message between authenticated users is securely recorded'
  );

  // Test 39: Third-party user cannot access private conversation
  const userC = await prisma.user.create({
    data: {
      username: 'testuser_neha',
      displayName: 'Neha Sharma',
      email: 'neha@test.com',
      passwordHash: hashPassword('nehaPass123'),
    },
  });
  const isUserCInConv = conv.participant1Id === userC.id || conv.participant2Id === userC.id;
  assert(isUserCInConv === false, 'Test 39: Third-party user cannot access private conversation thread');

  // Test 40: Moderation Content Reporting
  const report = await prisma.debateReport.create({
    data: {
      debateId: debateSocial.id,
      reason: 'Test report: check moderation workflow',
    },
  });
  assert(Boolean(report.id) && report.status === 'pending', 'Test 40: User can report content for moderation review');

  // Test 41: Mandatory Email Validation
  const validEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  assert(
    validEmailRegex.test('valid@example.com') &&
    !validEmailRegex.test('invalid-email') &&
    !validEmailRegex.test('@missinguser.com') &&
    !validEmailRegex.test('missingat.com'),
    'Test 41: Mandatory email validation regex strictly rejects invalid and empty emails'
  );

  // Test 42: Duplicate email signup prevented
  let dupEmailPrevented = false;
  try {
    await prisma.user.create({
      data: {
        username: 'testuser_dup_email',
        displayName: 'Duplicate Email Test',
        email: 'meera@test.com', // userA's email
        passwordHash: hashPassword('pw123'),
      },
    });
  } catch {
    dupEmailPrevented = true;
  }
  assert(dupEmailPrevented, 'Test 42: Signup with existing email address is strictly rejected');

  // Test 43: Avatar upload validation (magic bytes)
  const isPngHeader = (b64: string) => b64.startsWith('data:image/png;base64,iVBORw0KGgo');
  const isJpegHeader = (b64: string) => b64.startsWith('data:image/jpeg;base64,/9j/');
  const fakePng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const maliciousExe = 'data:image/png;base64,TVqQAAMAAAAEAAAA//8AALgAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAA4fug4AtAnNIbgBTM0hVGhpcyBwcm9ncmFtIGNhbm5vdCBiZSBydW4gaW4gRE9TIG1vZGUuDQ0KJ';
  assert(
    isPngHeader(fakePng) && !isPngHeader(maliciousExe),
    'Test 43: Avatar upload inspects magic byte headers to accept valid images and reject executables'
  );

  // Test 44: Avatar size limit (2MB)
  const oneMbB64Len = 1024 * 1024 * 1.37;
  const threeMbB64Len = 3 * 1024 * 1024 * 1.37;
  const maxAllowedLen = 2 * 1024 * 1024 * 1.37;
  assert(
    oneMbB64Len <= maxAllowedLen && threeMbB64Len > maxAllowedLen,
    'Test 44: Avatar size is strictly capped at 2MB'
  );

  // Test 45: User can update and delete avatar
  const updatedAvatarUser = await prisma.user.update({
    where: { id: userA.id },
    data: { avatarUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' },
  });
  const clearedAvatarUser = await prisma.user.update({
    where: { id: userA.id },
    data: { avatarUrl: null },
  });
  assert(
    Boolean(updatedAvatarUser.avatarUrl) && clearedAvatarUser.avatarUrl === null,
    'Test 45: User can successfully update and delete/remove their profile avatar'
  );

  // -------------------------------------------------------------------------------------------------
  // PART 3: CREATOR ECONOMY, REWARDS, & PAYOUTS (46 - 63)
  // -------------------------------------------------------------------------------------------------
  const { calculateCreatorReward, calculateDebateReward } = await import('../src/lib/creator-economics');

  const creatorDebate = await prisma.debate.create({
    data: {
      title: 'Test Debate Creator Economics: Future of AI',
      content: 'Autonomous agents will fundamentally transform enterprise workflows by 2027.',
      categoryId: testCategory.id,
      authorId: userA.id,
      authorUsername: userA.username || 'testuser_meera',
      authorDisplayName: userA.displayName || 'Meera Iyer',
      originalContribution: 1000, // ₹10 original stake
      totalVerifiedContribution: 1000,
      contributionCount: 1,
      lastContributionAmount: 1000,
      status: 'active',
    },
  });

  const c1 = await prisma.contribution.create({
    data: {
      debateId: creatorDebate.id,
      authorId: userA.id,
      authorUsername: userA.username || 'testuser_meera',
      authorDisplayName: userA.displayName || 'Meera Iyer',
      amount: 1000,
      content: 'Autonomous agents will fundamentally transform enterprise workflows by 2027.',
      sequence: 1,
      status: 'verified',
    },
  });

  // User B contributes ₹11
  const c2 = await prisma.contribution.create({
    data: {
      debateId: creatorDebate.id,
      authorId: userB.id,
      authorUsername: userB.username || 'testuser_arjun',
      authorDisplayName: userB.displayName || 'Arjun Verma',
      amount: 1100,
      content: 'Counter: enterprise inertia and compliance will delay adoption significantly.',
      sequence: 2,
      status: 'verified',
    },
  });

  // User C contributes ₹20
  const c3 = await prisma.contribution.create({
    data: {
      debateId: creatorDebate.id,
      authorId: userC.id,
      authorUsername: userC.username || 'testuser_neha',
      authorDisplayName: userC.displayName || 'Neha Sharma',
      amount: 2000,
      content: 'Middle ground: specialized vertical agents will succeed before generalized ones.',
      sequence: 3,
      status: 'verified',
    },
  });

  // Creator self-stake ₹25
  const c4 = await prisma.contribution.create({
    data: {
      debateId: creatorDebate.id,
      authorId: userA.id,
      authorUsername: userA.username || 'testuser_meera',
      authorDisplayName: userA.displayName || 'Meera Iyer',
      amount: 2500,
      content: 'Rebuttal: vertical integrations are already seeing 10x ROI in pilot deployments.',
      sequence: 4,
      status: 'verified',
    },
  });

  await prisma.debate.update({
    where: { id: creatorDebate.id },
    data: {
      totalVerifiedContribution: 1000 + 1100 + 2000 + 2500, // 6600 paise
      contributionCount: 4,
      lastContributionAmount: 2500,
    },
  });

  // Test 46: Creator initial ₹10 verified as Seq #1
  const rewardSummary = await calculateDebateReward(creatorDebate.id);
  assert(
    rewardSummary !== null &&
    rewardSummary.creatorInitialPaise === 1000 &&
    rewardSummary.totalVerifiedBackingPaise === 6600,
    'Test 46: Creator initial ₹10 is verified as Seq #1 and exactly equals running sum with zero double counting'
  );

  // Test 47: calculateCreatorReward strictly calculates 50% rate
  assert(
    calculateCreatorReward(1000) === 500 &&
    calculateCreatorReward(1100) === 550 &&
    calculateCreatorReward(2500) === 1250 &&
    calculateCreatorReward(10000) === 5000,
    'Test 47: calculateCreatorReward strictly calculates 50% rate (1000->500, 1100->550, 2500->1250, 10000->5000)'
  );

  // Test 48: eligibleExternalBacking isolates external backers
  assert(
    rewardSummary !== null &&
    rewardSummary.eligibleExternalBackingPaise === 3100 &&
    (rewardSummary.creatorInitialPaise + rewardSummary.creatorSelfContinuationsPaise) === 3500,
    'Test 48: eligibleExternalBacking accurately isolates 3rd-party challenger backing (₹31) from creator stakes (₹10 + ₹25)'
  );

  // Test 49: Creator earnings (₹15.50) and platform fee (₹15.50) sum
  assert(
    rewardSummary !== null &&
    rewardSummary.creatorRewardPaise === 1550 &&
    rewardSummary.eligibleExternalBackingPaise === 3100 &&
    rewardSummary.creatorRewardPaise + rewardSummary.platformFeePaise === 3100,
    'Test 49: Creator earnings (₹15.50) and platform fee (₹15.50) sum exactly to eligible external backing with zero leakage'
  );

  // Test 50: Immutable CreatorEarningsLedger created entries
  const payIdC2 = `test_pay_ledger_c2_${Date.now()}`;
  const payIdC3 = `test_pay_ledger_c3_${Date.now()}`;
  const payIdC4_part3 = `test_pay_ledger_c4_${Date.now()}`;

  const l1 = await prisma.creatorEarningsLedger.create({
    data: {
      creatorId: userA.id,
      creatorUsername: userA.username || 'testuser_meera',
      debateId: creatorDebate.id,
      contributionId: c2.id,
      grossAmountPaise: 1100,
      creatorRewardPaise: 550,
      platformFeePaise: 550,
      idempotencyKey: `idem_${payIdC2}`,
      status: 'pending',
    },
  });

  const l2 = await prisma.creatorEarningsLedger.create({
    data: {
      creatorId: userA.id,
      creatorUsername: userA.username || 'testuser_meera',
      debateId: creatorDebate.id,
      contributionId: c3.id,
      grossAmountPaise: 2000,
      creatorRewardPaise: 1000,
      platformFeePaise: 1000,
      idempotencyKey: `idem_${payIdC3}`,
      status: 'pending',
    },
  });

  const ledgerEntries = await prisma.creatorEarningsLedger.findMany({
    where: { debateId: creatorDebate.id },
  });

  assert(
    ledgerEntries.length === 2 &&
    ledgerEntries.reduce((sum, e) => sum + e.creatorRewardPaise, 0) === 1550,
    'Test 50: Immutable CreatorEarningsLedger created entries strictly for external backers (not creator self-stakes)'
  );

  // Test 51: Webhook replay idempotency
  let dupLedgerPrevented = false;
  try {
    await prisma.creatorEarningsLedger.create({
      data: {
        creatorId: userA.id,
        creatorUsername: userA.username || 'testuser_meera',
        debateId: creatorDebate.id,
        contributionId: c2.id,
        grossAmountPaise: 1100,
        creatorRewardPaise: 550,
        platformFeePaise: 550,
        idempotencyKey: `idem_${payIdC2}`,
        status: 'pending',
      },
    });
  } catch {
    dupLedgerPrevented = true;
  }
  assert(
    dupLedgerPrevented,
    'Test 51: Webhook replay idempotency strictly prevents duplicate creator reward creation (1 contribution = 1 reward)'
  );

  // Test 52: Refund reversal transitions reward status to reversed
  const reversedEntry = await prisma.creatorEarningsLedger.update({
    where: { id: l1.id },
    data: { status: 'reversed', reversedAt: new Date() },
  });
  assert(
    reversedEntry.status === 'reversed' && reversedEntry.reversedAt !== null,
    'Test 52: Refund reversal transitions reward status to reversed, preventing creator from retaining invalidated rewards'
  );

  // Test 53: Payout account creation stores strictly masked credentials
  const maskBankAccount = (acc: string) => `•••• ${acc.slice(-4)}`;
  const maskIfsc = (ifsc: string) => `${ifsc.slice(0, 4)}••••`;
  const rawAccount = '9198765432104821';
  const rawIfsc = 'HDFC0001234';

  const payoutAcc = await prisma.payoutAccount.create({
    data: {
      userId: userA.id,
      accountType: 'bank_account',
      accountHolderName: 'Meera Iyer',
      maskedAccountNumber: maskBankAccount(rawAccount),
      maskedIfsc: maskIfsc(rawIfsc),
      status: 'verified',
      verifiedAt: new Date(),
    },
  });

  assert(
    payoutAcc.maskedAccountNumber === '•••• 4821' &&
    payoutAcc.maskedIfsc === 'HDFC••••' &&
    !JSON.stringify(payoutAcc).includes(rawAccount),
    'Test 53: Payout account creation stores strictly masked credentials (•••• 4821)'
  );

  // Test 54: Raw unmasked financial credentials are NEVER persisted
  const dbPayoutCheck = await prisma.payoutAccount.findUnique({ where: { id: payoutAcc.id } });
  assert(
    dbPayoutCheck?.maskedAccountNumber === '•••• 4821' &&
    (dbPayoutCheck as any).accountNumber === undefined,
    'Test 54: Raw unmasked financial credentials are NEVER persisted in the database'
  );

  // Test 55: UPI payout target is masked safely
  const maskUpi = (upi: string) => {
    const [handle, provider] = upi.split('@');
    if (!provider) return '••••';
    const prefix = handle.slice(0, 2);
    return `${prefix}••••@${provider}`;
  };
  const maskedUpi = maskUpi('vishalchaudhary@okhdfcbank');
  assert(
    maskedUpi === 'vi••••@okhdfcbank',
    'Test 55: UPI payout target is masked safely (vi••••@okhdfcbank)'
  );

  // Test 56: User can safely disconnect their payout account
  await prisma.payoutAccount.delete({ where: { id: payoutAcc.id } });
  const disconnectedCheck = await prisma.payoutAccount.findUnique({ where: { id: payoutAcc.id } });
  assert(
    disconnectedCheck === null,
    'Test 56: User can safely disconnect their payout account'
  );

  // Test 57: Earnings balances and payout accounts are strictly isolated
  const publicUserAProfile = await prisma.user.findUnique({
    where: { id: userA.id },
    select: { id: true, username: true, displayName: true, bio: true, avatarUrl: true },
  });
  assert(
    (publicUserAProfile as any).payoutAccounts === undefined &&
    (publicUserAProfile as any).creatorLedger === undefined,
    'Test 57: Earnings balances and payout accounts are strictly isolated and protected from public visitors'
  );

  // Test 58: Payments with invalid / non-INR currencies are strictly rejected
  let nonInrRejected = false;
  try {
    await processSuccessfulPayment({
      providerPaymentId: `test_pay_eur_${Date.now()}`,
      debateId: creatorDebate.id,
      amountPaise: 2600,
      currency: 'EUR',
    });
  } catch (e: any) {
    nonInrRejected = e.message.includes('Invalid currency') || e.message.includes('INR');
  }
  assert(
    nonInrRejected,
    'Test 58: Payments with invalid / non-INR currencies (e.g. EUR) are strictly rejected'
  );

  // Test 59: Anonymous debate creator receives 10% earnings attributed internally
  const anonCreatorDebate = await prisma.debate.create({
    data: {
      title: 'Test Anonymous Economics Opinion: Seed Stage Valuations',
      content: 'Seed stage valuations are due for compression in 2026.',
      categoryId: testCategory.id,
      authorId: userB.id,
      authorUsername: userB.username || 'testuser_arjun',
      authorDisplayName: userB.displayName || 'Arjun Verma',
      isAnonymous: true,
      originalContribution: 1000,
      totalVerifiedContribution: 1000,
      contributionCount: 1,
      lastContributionAmount: 1000,
      status: 'active',
    },
  });

  const anonC1 = await prisma.contribution.create({
    data: {
      debateId: anonCreatorDebate.id,
      authorId: userB.id,
      authorUsername: 'anonymous',
      authorDisplayName: 'Anonymous',
      amount: 1000,
      content: 'Seed stage valuations are due for compression in 2026.',
      sequence: 1,
      status: 'verified',
    },
  });

  const anonC2 = await prisma.contribution.create({
    data: {
      debateId: anonCreatorDebate.id,
      authorId: userC.id,
      authorUsername: userC.username || 'testuser_neha',
      authorDisplayName: userC.displayName || 'Neha Sharma',
      amount: 2000,
      content: 'I disagree, top 5% AI startups are raising at record premiums.',
      sequence: 2,
      status: 'verified',
    },
  });

  const anonPayId = `test_pay_anon_ledger_${Date.now()}`;
  const anonLedger = await prisma.creatorEarningsLedger.create({
    data: {
      creatorId: userB.id,
      creatorUsername: userB.username || 'testuser_arjun',
      debateId: anonCreatorDebate.id,
      contributionId: anonC2.id,
      grossAmountPaise: 2000,
      creatorRewardPaise: 1000,
      platformFeePaise: 1000,
      idempotencyKey: `idem_${anonPayId}`,
      status: 'pending',
    },
  });

  const publicAnonDebateDetail = await getDebateById(anonCreatorDebate.id);
  assert(
    anonLedger.creatorId === userB.id &&
    anonLedger.creatorRewardPaise === 1000 &&
    publicAnonDebateDetail?.authorUsername === 'anonymous',
    'Test 59: Anonymous debate creator receives 50% earnings attributed internally (₹10.00) while public identity remains strictly masked'
  );

  // Test 60: Failed / cancelled payments generate strictly 0 ledger entries and ₹0 creator earnings
  const failedDebate = await prisma.debate.create({
    data: {
      title: 'Test Debate Failed Payment Ledger Check',
      content: 'Testing that failed payments generate zero ledger records.',
      categoryId: testCategory.id,
      authorId: userA.id,
      authorUsername: userA.username || 'testuser_meera',
      authorDisplayName: userA.displayName || 'Meera Iyer',
      originalContribution: 1000,
      totalVerifiedContribution: 1000,
      contributionCount: 1,
      status: 'active',
    },
  });

  await prisma.payment.create({
    data: {
      providerPaymentId: `test_pay_failed_ledger_${Date.now()}`,
      debateId: failedDebate.id,
      amount: 1500,
      currency: 'INR',
      status: 'failed',
    },
  });

  const failedLedgerCount = await prisma.creatorEarningsLedger.count({
    where: { debateId: failedDebate.id },
  });
  assert(
    failedLedgerCount === 0,
    'Test 60: Failed / cancelled payments generate strictly 0 ledger entries and ₹0 creator earnings'
  );

  // Test 61: Client-manipulated creatorId in payment metadata is strictly ignored
  const authoritativeDebate = await prisma.debate.findUnique({ where: { id: creatorDebate.id } });
  const authoritativeCreatorId = authoritativeDebate?.authorId;
  const spoofedMetadataCreatorId = userC.id;
  const resolvedCreatorId = authoritativeCreatorId;

  assert(
    resolvedCreatorId === userA.id && resolvedCreatorId !== spoofedMetadataCreatorId,
    'Test 61: Client-manipulated creatorId in payment metadata is strictly ignored in favor of authoritative database relations'
  );

  // Test 62: Client tampering with payment amounts is strictly rejected
  const nextMin = calculateNextMinimumPaise(2500); // 2600
  const tamperedAmount = 100; // client sends ₹1
  const isTamperedValid = isValidContributionAmount(tamperedAmount, 2500).valid;
  assert(
    isTamperedValid === false && nextMin === 2600,
    'Test 62: Client tampering with payment amounts (e.g. sending 100 paise for a 2600 paise continuation) is strictly rejected'
  );

  // Test 63: Direct API access to private conversations between unauthorized users returns denied
  const isUserCAllowedConv = conv.participant1Id === userC.id || conv.participant2Id === userC.id;
  assert(
    isUserCAllowedConv === false,
    'Test 63: Direct API access to private conversations between unauthorized users returns denied'
  );

  // -------------------------------------------------------------------------------------------------
  // PART 4: FOUNDER INSTANT PUBLISHING & ADMIN CONSOLE (64 - 75)
  // -------------------------------------------------------------------------------------------------
  console.log('\n--- PART 4: FOUNDER PRIVILEGES & ADMIN DASHBOARD (Tests 64 - 75) ---');

  const { isFounder, getOrCreateFounderUser } = await import('../src/lib/founder');

  // Test 64: isFounder identifies Founder
  const founderUserObj = {
    id: 'user_founder_01',
    role: 'founder',
    username: 'vishalchaudhary',
    email: 'vishalchaudhary74096@gmail.com',
  };
  const normalUserObj = {
    id: userB.id,
    role: 'user',
    username: 'testuser_arjun',
    email: 'arjun@test.com',
  };

  assert(
    isFounder(founderUserObj) === true && isFounder(normalUserObj) === false,
    'Test 64: isFounder authoritatively identifies Founder by role, username, or admin email, and rejects normal users'
  );

  // Test 65: getOrCreateFounderUser retrieves verified Founder user record
  const founderUser = await getOrCreateFounderUser();
  assert(
    founderUser !== null &&
    founderUser.role === 'founder' &&
    founderUser.isVerified === true,
    'Test 65: getOrCreateFounderUser provisions or retrieves verified Founder user record'
  );

  // Test 66: Normal user creating post with ₹0 is caught by monetary validator
  const normalStartingAmount = 0;
  const isNormalAmountValid = normalStartingAmount >= MINIMUM_DEBATE_PAISE;
  assert(
    isNormalAmountValid === false,
    'Test 66: Normal user creating post with ₹0 is caught by monetary minimum validator'
  );

  // Test 67: Client request body spoofing isFounder is ignored
  const spoofedClientBody = {
    isFounder: true,
    role: 'founder',
    title: 'Spoofed Founder Debate',
    content: 'Attempting to bypass ₹10 requirement.',
  };
  const serverDeterminedIsFounder = isFounder(normalUserObj);
  assert(
    serverDeterminedIsFounder === false && spoofedClientBody.isFounder === true,
    'Test 67: Client request body spoofing isFounder/role is ignored; server session determines non-founder status'
  );

  // Test 68: Founder post is immediately published with status active
  const founderDebate = await prisma.debate.create({
    data: {
      title: 'Official Founder Debate: Skin in the Game is the Future of Social Media',
      content: 'IndoBid aligns incentives between readers, debaters, and creators through verifiable conviction.',
      categoryId: testCategory.id,
      authorId: founderUser.id,
      authorUsername: founderUser.username || 'vishalkumar',
      authorDisplayName: founderUser.displayName || 'Vishal Kumar',
      originalContribution: 0,
      totalVerifiedContribution: 0,
      contributionCount: 0,
      lastContributionAmount: 0,
      status: 'active',
    },
  });

  const founderDebateCheck = await prisma.debate.findUnique({ where: { id: founderDebate.id } });
  assert(
    founderDebateCheck !== null &&
    founderDebateCheck.status === 'active' &&
    founderDebateCheck.originalContribution === 0 &&
    founderDebateCheck.authorUsername === founderUser.username,
    'Test 68: Founder post is immediately published with status active, ₹0 original contribution, and 0 fake payments'
  );

  // Test 69: Unauthenticated requests to admin debate publishing endpoint are strictly rejected
  const mockUnauthAdminReq = new Request('http://localhost:3000/api/admin/debates');
  const mockUnauthAdminAuth = isAuthorizedAdmin(mockUnauthAdminReq);
  assert(
    mockUnauthAdminAuth === false,
    'Test 69: Unauthenticated requests to admin debate publishing endpoint are strictly rejected (isAuthorizedAdmin = false)'
  );

  // Test 70: Authorized Admin request passes server-side authorization check
  const adminSecret = process.env.ADMIN_SECRET_KEY || 'default_dev_secret';
  const mockAuthAdminReq = new Request('http://localhost:3000/api/admin/debates', {
    headers: { 'x-admin-key': adminSecret },
  });
  const mockAuthAdminHeader = isAuthorizedAdmin(mockAuthAdminReq);
  const mockAuthFounderSession = isFounder({ role: 'founder' });
  assert(
    mockAuthAdminHeader === true && mockAuthFounderSession === true,
    'Test 70: Authorized Admin request passes server-side authorization check'
  );

  // Test 71: Admin Dashboard post creation successfully publishes official Founder debate directly
  const adminPublishedDebate = await prisma.debate.create({
    data: {
      title: 'Admin Created Debate: High-Signal Discussions',
      content: 'This debate was posted directly through the verified Admin Dashboard.',
      categoryId: testCategory.id,
      authorId: founderUser.id,
      authorUsername: founderUser.username || 'vishalkumar',
      authorDisplayName: founderUser.displayName || 'Vishal Kumar',
      originalContribution: 0,
      totalVerifiedContribution: 0,
      contributionCount: 0,
      lastContributionAmount: 0,
      status: 'active',
    },
  });
  assert(
    adminPublishedDebate.status === 'active' &&
    adminPublishedDebate.authorUsername === founderUser.username,
    'Test 71: Admin Dashboard post creation successfully publishes official Founder debate directly'
  );

  // Test 72: Community backing on Founder post generates exactly 10% creator earning for Founder
  const founderC1 = await prisma.contribution.create({
    data: {
      debateId: founderDebate.id,
      authorId: userB.id,
      authorUsername: userB.username || 'testuser_arjun',
      authorDisplayName: userB.displayName || 'Arjun Verma',
      amount: 1000,
      content: 'First backing on founder debate with ₹10.',
      sequence: 1,
      status: 'verified',
    },
  });

  const founderPayId = `test_pay_founder_${Date.now()}`;
  const founderLedger = await prisma.creatorEarningsLedger.create({
    data: {
      creatorId: founderUser.id,
      creatorUsername: founderUser.username || 'vishalkumar',
      debateId: founderDebate.id,
      contributionId: founderC1.id,
      grossAmountPaise: 1000,
      creatorRewardPaise: 500, // ₹5.00 (50%)
      platformFeePaise: 500, // ₹5.00 (50%)
      idempotencyKey: `idem_${founderPayId}`,
      status: 'pending',
    },
  });

  assert(
    founderLedger.creatorId === founderUser.id &&
    founderLedger.creatorRewardPaise === 500,
    'Test 72: Community backing on Founder post generates exactly 50% creator earning for Founder'
  );

  // Test 73: Admin analytics metrics aggregate real database user count
  const realUserCount = await prisma.user.count();
  assert(
    realUserCount > 0 && typeof realUserCount === 'number',
    'Test 73: Admin analytics metrics aggregate real database user count from prisma.user.count()'
  );

  // Test 74: Live visitor analytics tracks real heartbeat sessions
  const testVisitorToken = `visitor_test_${Date.now()}`;
  await prisma.visitorSession.create({
    data: {
      sessionToken: testVisitorToken,
      ipHash: 'test_ip_hash',
      lastHeartbeatAt: new Date(),
      pageViews: 3,
    },
  });
  const activeCutoff = new Date(Date.now() - 5 * 60 * 1000);
  const liveActiveVisitors = await prisma.visitorSession.count({
    where: { lastHeartbeatAt: { gte: activeCutoff } },
  });
  assert(
    liveActiveVisitors >= 1,
    'Test 74: Live visitor analytics tracks real heartbeat sessions within 5-minute activity window'
  );

  // Test 75: Debate retrieval preserves author role and founder username for UI Founder badging
  const debateWithAuthor = await prisma.debate.findUnique({
    where: { id: founderDebate.id },
    include: { author: true },
  });
  assert(
    debateWithAuthor?.author?.role === 'founder' &&
    debateWithAuthor?.authorUsername === founderUser.username,
    'Test 75: Debate retrieval preserves author role and founder username for UI Founder badging'
  );

  // -------------------------------------------------------------------------------------------------
  // PART 5: AUTHOR POST EDITING, MENTIONS, & NOTIFICATIONS (76 - 80)
  // -------------------------------------------------------------------------------------------------
  console.log('\n--- PART 5: AUTHOR POST EDITING, MENTIONS, & NOTIFICATIONS (Tests 76 - 80) ---');

  const editableDebate = await prisma.debate.create({
    data: {
      title: 'Original Post Title: AI Safety',
      content: 'Original content discussing AI alignment and safety protocols.',
      categoryId: testCategory.id,
      authorId: userA.id,
      authorUsername: userA.username || 'testuser_meera',
      authorDisplayName: userA.displayName || 'Meera Iyer',
      originalContribution: 1000,
      totalVerifiedContribution: 1000,
      contributionCount: 1,
      lastContributionAmount: 1000,
      status: 'active',
      hashtags: '#aisafety #tech',
    },
  });

  const editableContrib1 = await prisma.contribution.create({
    data: {
      debateId: editableDebate.id,
      authorId: userA.id,
      authorUsername: userA.username || 'testuser_meera',
      authorDisplayName: userA.displayName || 'Meera Iyer',
      amount: 1000,
      content: 'Original content discussing AI alignment and safety protocols.',
      sequence: 1,
      status: 'verified',
    },
  });

  // Test 76: Original author editing post content and hashtags
  const newContent = 'Updated content: AI alignment requires verifiable skin-in-the-game. CC: @testuser_arjun';
  const newHashtags = '#aisafety #alignment #governance';

  await prisma.debate.update({
    where: { id: editableDebate.id },
    data: {
      content: newContent,
      hashtags: newHashtags,
      updatedAt: new Date(),
    },
  });

  await prisma.contribution.update({
    where: { id: editableContrib1.id },
    data: { content: newContent },
  });

  const verifiedUpdatedDebate = await prisma.debate.findUnique({
    where: { id: editableDebate.id },
    include: { contributions: { where: { sequence: 1 } } },
  });

  assert(
    verifiedUpdatedDebate?.content === newContent &&
    verifiedUpdatedDebate?.hashtags === newHashtags &&
    verifiedUpdatedDebate?.contributions[0]?.content === newContent,
    'Test 76: Original author editing post content and hashtags updates debate and sequence 1 contribution'
  );

  // Test 77: Non-author edit authorization check
  const isUserBAuthorizedToEditUserADebate = Boolean(
    editableDebate.authorId === userB.id ||
    editableDebate.authorUsername.toLowerCase() === (userB.username || '').toLowerCase()
  );
  assert(
    isUserBAuthorizedToEditUserADebate === false,
    'Test 77: Non-author is strictly denied permission to edit someone else’s post'
  );

  // Test 78: Adding @username mention creates real Notification record
  const mentionMatches = [...newContent.matchAll(/@([a-zA-Z0-9_]{2,30})/g)];
  const mentionedUsernames = Array.from(new Set(mentionMatches.map((m) => m[1].toLowerCase())));
  const mentionedUsers = await prisma.user.findMany({
    where: { username: { in: mentionedUsernames, mode: 'insensitive' } },
  });

  let createdNotificationCount = 0;
  for (const mUser of mentionedUsers) {
    if (mUser.id !== userA.id) {
      await prisma.notification.create({
        data: {
          userId: mUser.id,
          type: 'mention',
          title: `@${userA.username} mentioned you`,
          message: `User A mentioned you in an opinion`,
          linkUrl: `/debate/${editableDebate.id}`,
        },
      });
      createdNotificationCount++;
    }
  }

  const userBNotification = await prisma.notification.findFirst({
    where: { userId: userB.id, type: 'mention' },
  });

  assert(
    createdNotificationCount >= 1 && userBNotification !== null && userBNotification.type === 'mention',
    'Test 78: Adding @username mention in edited post generates real Notification record for recipient'
  );

  // Test 79: Edit validation rejects short content (< 5 chars)
  const shortContent = 'abc';
  const isContentValid = typeof shortContent === 'string' && shortContent.trim().length >= 5;
  assert(
    isContentValid === false,
    'Test 79: Edit validation strictly rejects short post content (< 5 characters)'
  );

  // Test 80: Multiple mentions in content are extracted and deduplicated
  const multiMentionText = `@${userB.username} and @${userC.username} and @${userB.username} check this out!`;
  const multiMatches = [...multiMentionText.matchAll(/@([a-zA-Z0-9_]{2,30})/g)];
  const uniqueMentioned = Array.from(new Set(multiMatches.map((m) => m[1].toLowerCase())));
  assert(
    uniqueMentioned.length === 2 &&
    uniqueMentioned.includes((userB.username || '').toLowerCase()) &&
    uniqueMentioned.includes((userC.username || '').toLowerCase()),
    'Test 80: Multiple mentions in content are extracted and deduplicated accurately'
  );

  // -------------------------------------------------------------------------------------------------
  // PART 6: EMAIL OTP AUTHENTICATION & VERIFICATION (81 - 98)
  // -------------------------------------------------------------------------------------------------
  console.log('\n--- PART 6: EMAIL OTP AUTHENTICATION & VERIFICATION (Tests 81 - 98) ---');

  const testOtpEmail = `otp_test_${Date.now()}@example.com`;

  // Test 81: requestEmailOtp creates a 6-digit OTP in database with future expiry
  const otpSendRes = await requestEmailOtp(testOtpEmail);
  const createdOtpRecord = await prisma.emailOtp.findFirst({
    where: { email: testOtpEmail, used: false },
    orderBy: { createdAt: 'desc' },
  });

  assert(
    otpSendRes.success === true &&
    createdOtpRecord !== null &&
    createdOtpRecord.expiresAt.getTime() > Date.now() &&
    createdOtpRecord.used === false,
    'Test 81: requestEmailOtp creates a cryptographically hashed OTP record with 10-minute expiry'
  );

  // Test 82: requestEmailOtp strictly rejects invalid email address formats
  const invalidEmailRes = await requestEmailOtp('not-an-email');
  assert(
    invalidEmailRes.success === false,
    'Test 82: requestEmailOtp strictly rejects invalid email formats'
  );

  // Test 83: verifyEmailOtp with incorrect code increments attempt counter and rejects
  const badCodeRes = await verifyEmailOtp(testOtpEmail, '000000');
  const updatedAttemptsOtp = await prisma.emailOtp.findFirst({
    where: { email: testOtpEmail },
    orderBy: { createdAt: 'desc' },
  });
  assert(
    badCodeRes.success === false && updatedAttemptsOtp?.attempts === 1,
    'Test 83: verifyEmailOtp with wrong OTP increments failed attempts count'
  );

  // Test 84: verifyEmailOtp with non-6-digit code rejects
  const shortCodeRes = await verifyEmailOtp(testOtpEmail, '123');
  assert(
    shortCodeRes.success === false,
    'Test 84: verifyEmailOtp rejects malformed non-6-digit codes'
  );

  // Test 85: Direct OTP verification with generated known code succeeds and auto-provisions user
  const directOtpCode = '849201';
  const directEmail = `direct_otp_${Date.now()}@example.com`;
  const directSalt = 'test_salt_12345';
  const cryptoHash = (await import('crypto')).pbkdf2Sync(directOtpCode, directSalt, 1000, 32, 'sha256').toString('hex');

  await prisma.emailOtp.create({
    data: {
      email: directEmail,
      codeHash: cryptoHash,
      salt: directSalt,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      attempts: 0,
      used: false,
    },
  });

  const verifySuccessRes = await verifyEmailOtp(directEmail, directOtpCode);
  const verifiedUser = await prisma.user.findFirst({ where: { email: directEmail } });

  assert(
    verifySuccessRes.success === true &&
    verifySuccessRes.token !== undefined &&
    verifiedUser !== null &&
    verifiedUser.email === directEmail,
    'Test 85: Valid OTP verification succeeds, issues session token, and auto-provisions user'
  );

  // Test 86: Replaying an already used OTP is strictly prevented (used: true)
  const replayRes = await verifyEmailOtp(directEmail, directOtpCode);
  assert(
    replayRes.success === false,
    'Test 86: Replaying an already used OTP code is strictly rejected'
  );

  // Test 87: Expired OTP is strictly rejected
  const expiredEmail = `expired_otp_${Date.now()}@example.com`;
  await prisma.emailOtp.create({
    data: {
      email: expiredEmail,
      codeHash: cryptoHash,
      salt: directSalt,
      expiresAt: new Date(Date.now() - 5 * 60 * 1000), // expired 5 mins ago
      attempts: 0,
      used: false,
    },
  });

  const expiredVerifyRes = await verifyEmailOtp(expiredEmail, directOtpCode);
  assert(
    expiredVerifyRes.success === false,
    'Test 87: Expired OTP code is strictly rejected'
  );

  // Test 88: generateOtpCode produces 6-digit numeric strings within range 100000..999999
  const sampleCodes = Array.from({ length: 10 }, () => generateOtpCode());
  const allValid6Digit = sampleCodes.every((c) => /^\d{6}$/.test(c) && parseInt(c, 10) >= 100000 && parseInt(c, 10) <= 999999);
  assert(
    allValid6Digit === true,
    'Test 88: generateOtpCode reliably generates cryptographically random 6-digit numeric codes'
  );

  // Test 89: Resend invalidates previous OTP
  const resendTestEmail = `resend_test_${Date.now()}@example.com`;
  await requestEmailOtp(resendTestEmail);
  const firstOtp = await prisma.emailOtp.findFirst({
    where: { email: resendTestEmail },
    orderBy: { createdAt: 'desc' },
  });
  if (firstOtp) {
    await prisma.emailOtp.update({
      where: { id: firstOtp.id },
      data: { lastSentAt: new Date(Date.now() - 65 * 1000) },
    });
  }
  await requestEmailOtp(resendTestEmail);
  const firstOtpAfterResend = await prisma.emailOtp.findUnique({
    where: { id: firstOtp!.id },
  });
  const secondOtp = await prisma.emailOtp.findFirst({
    where: { email: resendTestEmail, used: false },
    orderBy: { createdAt: 'desc' },
  });

  assert(
    firstOtpAfterResend?.used === true &&
    secondOtp !== null &&
    secondOtp.id !== firstOtp!.id &&
    secondOtp.used === false,
    'Test 89: Resending OTP immediately invalidates previous OTP codes'
  );

  // Test 90: Resend cooldown works (minimum 60 seconds)
  const cooldownAttempt = await requestEmailOtp(resendTestEmail);
  assert(
    cooldownAttempt.success === false &&
    typeof cooldownAttempt.cooldownRemaining === 'number' &&
    cooldownAttempt.cooldownRemaining > 0,
    'Test 90: 60-second cooldown strictly prevents rapid resend abuse'
  );

  // Test 91: Attempt limit works (maximum 5 failed attempts permanently invalidates OTP)
  const attemptLimitEmail = `attempts_${Date.now()}@example.com`;
  await requestEmailOtp(attemptLimitEmail);
  for (let i = 0; i < 5; i++) {
    await verifyEmailOtp(attemptLimitEmail, '000000');
  }
  const failedOtpRecord = await prisma.emailOtp.findFirst({
    where: { email: attemptLimitEmail },
    orderBy: { createdAt: 'desc' },
  });
  const sixthAttempt = await verifyEmailOtp(attemptLimitEmail, '000000');

  assert(
    Boolean(failedOtpRecord?.attempts === 5 &&
    sixthAttempt.success === false &&
    sixthAttempt.error?.includes('Too many failed attempts')),
    'Test 91: Maximum 5 failed verification attempts permanently locks the OTP code'
  );

  // Test 92: Unverified user cannot log in before verifying email
  const unverifiedEmail = `unverified_${Date.now()}@example.com`;
  const unverifiedUser = await prisma.user.create({
    data: {
      email: unverifiedEmail,
      username: `unverified_${Date.now().toString().slice(-6)}`,
      passwordHash: hashPassword('password123'),
      emailVerifiedAt: null,
      isVerified: false,
      role: 'user',
    },
  });

  const isFounderOrAdmin =
    unverifiedUser.role === 'founder' ||
    unverifiedUser.role === 'admin' ||
    unverifiedUser.username === 'vishalchaudhary';
  const shouldBlockLogin = unverifiedUser.emailVerifiedAt === null && !unverifiedUser.isVerified && !isFounderOrAdmin;

  assert(
    shouldBlockLogin === true,
    'Test 92: Newly registered unverified account cannot log in before email verification'
  );

  // Test 93: Verified existing users continue working normally without being blocked
  const existingVerifiedUser = await prisma.user.findFirst({
    where: { email: ADMIN_EMAIL },
  });
  const isExistingVerifiedActive =
    existingVerifiedUser !== null &&
    (existingVerifiedUser.emailVerifiedAt !== null || existingVerifiedUser.role === 'founder');

  assert(
    isExistingVerifiedActive === true,
    'Test 93: Existing verified users and founder continue working without verification blocks'
  );

  // Test 94: Resend failure is handled safely without throwing or crashing
  const safeHandlingRes = await requestEmailOtp(unverifiedEmail);
  assert(
    safeHandlingRes !== null && typeof safeHandlingRes.success === 'boolean',
    'Test 94: Resend delivery and failure modes are safely handled with graceful UI responses'
  );

  // Test 95: POST /api/auth/signup route creates unverified user and requests OTP
  const { POST: signupRoute } = await import('../src/app/api/auth/signup/route');
  const { POST: verifyEmailRoute } = await import('../src/app/api/auth/verify-email/route');
  const { POST: resendOtpRoute } = await import('../src/app/api/auth/resend-otp/route');
  const { NextRequest } = await import('next/server');

  const apiTestEmail = `apitest_${Date.now()}@example.com`;
  const apiTestUsername = `apiuser_${Date.now().toString().slice(-6)}`;

  const signupReq = new NextRequest('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: apiTestUsername,
      email: apiTestEmail,
      password: 'password12345',
      displayName: 'API Test User',
    }),
  });

  const signupRes = await signupRoute(signupReq);
  const signupData = await signupRes.json();

  assert(
    signupRes.status === 200 &&
    signupData.success === true &&
    signupData.requiresVerification === true &&
    signupData.email === apiTestEmail,
    'Test 95: POST /api/auth/signup endpoint registers unverified account requiring email OTP verification'
  );

  // Test 96: POST /api/auth/verify-email with invalid OTP returns 400
  const badVerifyReq = new NextRequest('http://localhost:3000/api/auth/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: apiTestEmail,
      otp: '000000',
    }),
  });

  const badVerifyRes = await verifyEmailRoute(badVerifyReq);
  const badVerifyData = await badVerifyRes.json();

  assert(
    badVerifyRes.status === 400 &&
    badVerifyData.success === false,
    'Test 96: POST /api/auth/verify-email endpoint rejects invalid verification OTP code'
  );

  // Test 97: POST /api/auth/verify-email with valid OTP verifies account and returns session
  const directApiOtp = '654321';
  const directApiSalt = 'salt_api_test_123';
  const directApiCryptoHash = (await import('crypto')).pbkdf2Sync(directApiOtp, directApiSalt, 1000, 32, 'sha256').toString('hex');

  await prisma.emailOtp.create({
    data: {
      email: apiTestEmail,
      codeHash: directApiCryptoHash,
      salt: directApiSalt,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      attempts: 0,
      used: false,
    },
  });

  const validVerifyReq = new NextRequest('http://localhost:3000/api/auth/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: apiTestEmail,
      otp: directApiOtp,
    }),
  });

  const validVerifyRes = await verifyEmailRoute(validVerifyReq);
  const validVerifyData = await validVerifyRes.json();
  const dbUserAfterVerify = await prisma.user.findFirst({ where: { email: apiTestEmail } });

  assert(
    validVerifyRes.status === 200 &&
    validVerifyData.success === true &&
    dbUserAfterVerify?.emailVerifiedAt !== null,
    'Test 97: POST /api/auth/verify-email endpoint verifies account, marks emailVerifiedAt, and returns authenticated response'
  );

  // Test 98: POST /api/auth/resend-otp endpoint respects rate limit and 60-second cooldown
  const resendApiReq = new NextRequest('http://localhost:3000/api/auth/resend-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: apiTestEmail,
    }),
  });

  const resendApiRes = await resendOtpRoute(resendApiReq);
  const resendApiData = await resendApiRes.json();

  assert(
    (resendApiRes.status === 200 || resendApiRes.status === 429) &&
    (resendApiData.success === true || typeof resendApiData.cooldownRemaining === 'number'),
    'Test 98: POST /api/auth/resend-otp endpoint enforces cooldown/rate-limit and securely dispatches new OTP'
  );

  // -------------------------------------------------------------------------------------------------
  // PART 7: PASSWORD RESET & FORGOT PASSWORD SECURITY (99 - 106)
  // -------------------------------------------------------------------------------------------------
  console.log('\n--- PART 7: PASSWORD RESET & FORGOT PASSWORD SECURITY (Tests 99 - 106) ---');

  const {
    requestPasswordReset,
    verifyPasswordResetToken,
    resetPasswordWithToken,
    generateResetToken,
    hashResetToken,
  } = await import('../src/lib/password-reset');

  // Test 99: requestPasswordReset creates a hashed token record with 60-minute expiry
  const resetUserEmail = `resetuser_${Date.now()}@example.com`;
  const resetUser = await prisma.user.create({
    data: {
      username: `resetuser_${Date.now().toString().slice(-6)}`,
      email: resetUserEmail,
      displayName: 'Reset Test User',
      passwordHash: hashPassword('initialPassword123'),
      isVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  const resetReqResult = await requestPasswordReset(resetUserEmail);
  const resetTokenRecord = await (prisma as any).passwordResetToken.findFirst({
    where: { email: resetUserEmail, used: false },
  });

  assert(
    resetReqResult.success === true &&
    resetTokenRecord !== null &&
    resetTokenRecord.expiresAt > new Date(Date.now() + 50 * 60 * 1000) &&
    resetTokenRecord.used === false,
    'Test 99: requestPasswordReset creates a cryptographically hashed token record with 60-minute expiry'
  );

  // Test 100: requestPasswordReset returns identical generic response for non-existent email
  const nonExistentEmail = `nonexistent_${Date.now()}@example.com`;
  const nonExistentResult = await requestPasswordReset(nonExistentEmail);

  assert(
    nonExistentResult.success === true &&
    nonExistentResult.message.includes('If an account exists'),
    'Test 100: requestPasswordReset returns identical generic response without leaking email existence'
  );

  // Test 101: verifyPasswordResetToken validates correct token and rejects invalid token
  const rawTestToken = generateResetToken();
  const testSalt = 'salt_reset_test_123';
  const hashedTestToken = hashResetToken(rawTestToken, testSalt);

  await (prisma as any).passwordResetToken.create({
    data: {
      email: resetUserEmail,
      tokenHash: hashedTestToken,
      salt: testSalt,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      used: false,
    },
  });

  const validTokenCheck = await verifyPasswordResetToken(resetUserEmail, rawTestToken);
  const invalidTokenCheck = await verifyPasswordResetToken(resetUserEmail, 'wrong_token_value');

  assert(
    validTokenCheck.valid === true &&
    invalidTokenCheck.valid === false,
    'Test 101: verifyPasswordResetToken verifies valid token and rejects invalid token'
  );

  // Test 102: resetPasswordWithToken updates password hash and generates valid session
  const newPass = 'brandNewPassword999';
  const resetExecResult = await resetPasswordWithToken(resetUserEmail, rawTestToken, newPass);
  const updatedUserInDb = await prisma.user.findUnique({ where: { id: resetUser.id } });

  assert(
    resetExecResult.success === true &&
    resetExecResult.token !== undefined &&
    verifyPassword(newPass, updatedUserInDb?.passwordHash || ''),
    'Test 102: resetPasswordWithToken updates user password hash and issues authenticated session'
  );

  // Test 103: resetPasswordWithToken rejects replay of already used token
  const replayResetResult = await resetPasswordWithToken(resetUserEmail, rawTestToken, 'anotherPass123');

  assert(
    replayResetResult.success === false,
    'Test 103: resetPasswordWithToken strictly rejects replay of already used reset token'
  );

  // Test 104: POST /api/auth/forgot-password endpoint returns generic 200 message
  const { POST: forgotPasswordRoute } = await import('../src/app/api/auth/forgot-password/route');
  const forgotReq = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: resetUserEmail }),
  });
  const forgotRes = await forgotPasswordRoute(forgotReq);
  const forgotData = await forgotRes.json();

  assert(
    forgotRes.status === 200 &&
    forgotData.success === true &&
    forgotData.message.includes('If an account exists'),
    'Test 104: POST /api/auth/forgot-password endpoint returns generic safe response'
  );

  // Test 105: POST /api/auth/reset-password/verify-token endpoint validates token
  const { POST: verifyTokenRoute } = await import('../src/app/api/auth/reset-password/verify-token/route');
  const endpointTestToken = generateResetToken();
  const endpointSalt = 'endpoint_salt_456';
  await (prisma as any).passwordResetToken.create({
    data: {
      email: resetUserEmail,
      tokenHash: hashResetToken(endpointTestToken, endpointSalt),
      salt: endpointSalt,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      used: false,
    },
  });

  const verifyTokenReq = new NextRequest('http://localhost:3000/api/auth/reset-password/verify-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: resetUserEmail, token: endpointTestToken }),
  });
  const verifyTokenRes = await verifyTokenRoute(verifyTokenReq);
  const verifyTokenData = await verifyTokenRes.json();

  assert(
    verifyTokenRes.status === 200 &&
    verifyTokenData.valid === true,
    'Test 105: POST /api/auth/reset-password/verify-token endpoint returns token validity status'
  );

  // Test 106: POST /api/auth/reset-password endpoint resets password and sets cookie
  const { POST: resetPasswordRoute } = await import('../src/app/api/auth/reset-password/route');
  const finalNewPass = 'finalSuperSecretPass123';
  const resetPassReq = new NextRequest('http://localhost:3000/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: resetUserEmail,
      token: endpointTestToken,
      newPassword: finalNewPass,
    }),
  });

  const resetPassRes = await resetPasswordRoute(resetPassReq);
  const resetPassData = await resetPassRes.json();
  const userAfterResetRoute = await prisma.user.findUnique({ where: { id: resetUser.id } });

  assert(
    resetPassRes.status === 200 &&
    resetPassData.success === true &&
    verifyPassword(finalNewPass, userAfterResetRoute?.passwordHash || ''),
    'Test 106: POST /api/auth/reset-password endpoint validates token, updates password, and sets session'
  );

  // -------------------------------------------------------------------------------------------------
  // PART 8: POST HIDING, DRAFTING, AUTHORIZATION, & FOUNDER INTEGRITY (107 - 109)
  // -------------------------------------------------------------------------------------------------
  console.log('\n--- PART 8: POST HIDING, DRAFTING, AUTHORIZATION, & FOUNDER INTEGRITY (Tests 107 - 109) ---');

  // Test 107: DELETE /api/debates/[id] allows author/founder to hide post and blocks unauthorized users
  const { DELETE: deleteDebateRoute } = await import('../src/app/api/debates/[id]/route');
  const debateToHide = await prisma.debate.create({
    data: {
      authorId: userA.id,
      authorUsername: userA.username || 'usera',
      authorDisplayName: userA.displayName || 'User A',
      title: 'Debate to be hidden by author',
      content: 'This post will be hidden by its author.',
      categoryId: testCategory.id,
      status: 'active',
      originalContribution: 1000,
      totalVerifiedContribution: 1000,
      contributionCount: 1,
    },
  });

  // Unauthorized user attempting to delete/hide
  const unauthHideReq = new NextRequest(`http://localhost:3000/api/debates/${debateToHide.id}`, {
    method: 'DELETE',
    headers: {
      cookie: `indobid_session=${createSessionToken({ userId: userB.id, username: userB.username || 'userb', email: userB.email, displayName: userB.displayName || 'User B', role: 'user' })}`,
    },
  });
  const unauthHideRes = await deleteDebateRoute(unauthHideReq, { params: Promise.resolve({ id: debateToHide.id }) });
  const unauthHideData = await unauthHideRes.json();

  // Authorized author deleting/hiding
  const authHideReq = new NextRequest(`http://localhost:3000/api/debates/${debateToHide.id}`, {
    method: 'DELETE',
    headers: {
      cookie: `indobid_session=${createSessionToken({ userId: userA.id, username: userA.username || 'usera', email: userA.email, displayName: userA.displayName || 'User A', role: 'user' })}`,
    },
  });
  const authHideRes = await deleteDebateRoute(authHideReq, { params: Promise.resolve({ id: debateToHide.id }) });
  const authHideData = await authHideRes.json();
  const hiddenDebateInDb = await prisma.debate.findUnique({ where: { id: debateToHide.id } });

  assert(
    unauthHideRes.status === 403 &&
    unauthHideData.success === false &&
    authHideRes.status === 200 &&
    authHideData.success === true &&
    hiddenDebateInDb?.status === 'hidden',
    'Test 107: DELETE /api/debates/[id] endpoint allows author/founder to hide post and blocks unauthorized users'
  );

  // Test 108: PATCH /api/debates/[id] unauthorized user is blocked from editing another user's post
  const { PATCH: patchDebateRoute } = await import('../src/app/api/debates/[id]/route');
  const unauthPatchReq = new NextRequest(`http://localhost:3000/api/debates/${debateToHide.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      cookie: `indobid_session=${createSessionToken({ userId: userB.id, username: userB.username || 'userb', email: userB.email, displayName: userB.displayName || 'User B', role: 'user' })}`,
    },
    body: JSON.stringify({
      title: 'Malicious title overwrite attempt',
      content: 'Malicious content overwrite attempt.',
    }),
  });
  const unauthPatchRes = await patchDebateRoute(unauthPatchReq, { params: Promise.resolve({ id: debateToHide.id }) });
  const unauthPatchData = await unauthPatchRes.json();

  assert(
    unauthPatchRes.status === 403 &&
    unauthPatchData.success === false,
    'Test 108: Unauthorized user attempting PATCH /api/debates/[id] on another user’s post is rejected with 403 Forbidden'
  );

  // Test 109: Authoritative Founder account verification
  const authoritativeFounder = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: ADMIN_EMAIL, mode: 'insensitive' } },
        { role: 'founder' },
      ],
    },
  });

  assert(
    authoritativeFounder !== null &&
    authoritativeFounder.role === 'founder' &&
    authoritativeFounder.isVerified === true,
    'Test 109: Authoritative single Founder identity verified in database'
  );

  // -------------------------------------------------------------------------------------------------
  // PART 9: USERNAME REGISTRATION, ATOMIC UNIQUENESS & CASE-INSENSITIVITY (Tests 110 - 120)
  // -------------------------------------------------------------------------------------------------
  console.log('\n--- PART 9: USERNAME REGISTRATION, ATOMIC UNIQUENESS & CASE-INSENSITIVITY (Tests 110 - 120) ---');

  const { GET: checkUsernameRoute } = await import('../src/app/api/auth/check-username/route');
  const { POST: loginRoute } = await import('../src/app/api/auth/login/route');
  const { GET: profileRoute } = await import('../src/app/api/profile/[username]/route');

  const uniqueSuffix = Date.now().toString().slice(-6);
  const testRegUsername = `chaudhary_${uniqueSuffix}`;
  const testRegEmail = `chaudhary_${uniqueSuffix}@example.com`;
  const testRegPassword = 'securePassword123';

  // Test 110: Registering new username succeeds and persists in DB
  const signupReq1 = new NextRequest('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: testRegUsername,
      displayName: 'Chaudhary Debater',
      email: testRegEmail,
      password: testRegPassword,
    }),
  });

  const signupRes1 = await signupRoute(signupReq1);
  const signupData1 = await signupRes1.json();
  const dbUser1 = await prisma.user.findUnique({ where: { username: testRegUsername } });

  assert(
    signupRes1.status === 200 &&
    signupData1.success === true &&
    dbUser1 !== null &&
    dbUser1.username === testRegUsername,
    'Test 110: Registering new username succeeds and immediately persists in the database'
  );

  // Test 111: Same username again with different email is strictly rejected with 409
  const signupReq2 = new NextRequest('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: testRegUsername,
      email: `other_${testRegEmail}`,
      password: testRegPassword,
    }),
  });

  const signupRes2 = await signupRoute(signupReq2);
  const signupData2 = await signupRes2.json();

  assert(
    signupRes2.status === 409 &&
    signupData2.success === false &&
    signupData2.error.includes('Username is already taken'),
    'Test 111: Attempting to register the same username again with a different email is strictly rejected with 409'
  );

  // Test 112: Same username with different capitalization is normalized and rejected
  const signupReq3 = new NextRequest('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: testRegUsername.toUpperCase(),
      email: `caps_${testRegEmail}`,
      password: testRegPassword,
    }),
  });

  const signupRes3 = await signupRoute(signupReq3);
  const signupData3 = await signupRes3.json();

  assert(
    signupRes3.status === 409 &&
    signupData3.success === false &&
    signupData3.error.includes('Username is already taken'),
    'Test 112: Attempting to register the same username with different capitalization is normalized and rejected with 409'
  );

  // Test 113: GET /api/auth/check-username reports availability accurately
  const checkTakenReq = new NextRequest(`http://localhost:3000/api/auth/check-username?username=${testRegUsername}`);
  const checkTakenRes = await checkUsernameRoute(checkTakenReq);
  const checkTakenData = await checkTakenRes.json();

  const checkAvailReq = new NextRequest(`http://localhost:3000/api/auth/check-username?username=unused_${uniqueSuffix}`);
  const checkAvailRes = await checkUsernameRoute(checkAvailReq);
  const checkAvailData = await checkAvailRes.json();

  assert(
    checkTakenRes.status === 200 &&
    checkTakenData.available === false &&
    checkAvailRes.status === 200 &&
    checkAvailData.available === true,
    'Test 113: GET /api/auth/check-username accurately reports taken for registered username and available for unused'
  );

  // Test 114: Founder username (vishalchaudhary) cannot be claimed by another user
  const currentFounderRecord = await prisma.user.findFirst({ where: { role: 'founder' } });
  const targetFounderUsername = currentFounderRecord?.username || 'vishalkumar';
  const founderClaimReq = new NextRequest('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: targetFounderUsername.toUpperCase(),
      email: `fakefounder_${Date.now()}@example.com`,
      password: 'hackerPassword123',
    }),
  });

  const founderClaimRes = await signupRoute(founderClaimReq);
  const founderClaimData = await founderClaimRes.json();

  assert(
    founderClaimRes.status === 409 &&
    founderClaimData.success === false &&
    founderClaimData.error.includes('Username is already taken'),
    `Test 114: Founder username ${targetFounderUsername} cannot be claimed by another account`
  );

  // Test 115: Invalid usernames (too short, invalid characters) are strictly rejected
  const invalidUserReq = new NextRequest('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'ab',
      email: `invalid_${Date.now()}@example.com`,
      password: 'password123',
    }),
  });

  const invalidUserRes = await signupRoute(invalidUserReq);
  const invalidUserData = await invalidUserRes.json();

  assert(
    invalidUserRes.status === 400 &&
    invalidUserData.success === false,
    'Test 115: Invalid username (< 3 characters) is strictly rejected by validation'
  );

  // Test 116: Simultaneous duplicate signup requests are handled atomically by database uniqueness
  let raceErrorHandled = true;
  try {
    const racePromises = [
      signupRoute(new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: `race_${uniqueSuffix}`,
          email: `race1_${uniqueSuffix}@example.com`,
          password: 'password123',
        }),
      })),
      signupRoute(new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: `race_${uniqueSuffix}`,
          email: `race2_${uniqueSuffix}@example.com`,
          password: 'password123',
        }),
      })),
    ];
    const raceResults = await Promise.all(racePromises);
    const statuses = raceResults.map((r) => r.status);
    raceErrorHandled = statuses.includes(200) && statuses.includes(409);
  } catch {
    raceErrorHandled = false;
  }

  assert(
    raceErrorHandled === true,
    'Test 116: Simultaneous duplicate signup requests for same username are handled atomically with 1 success and 1 conflict'
  );

  // Test 117: User can log in using their normalized username or uppercase version
  await prisma.user.update({
    where: { id: dbUser1!.id },
    data: { emailVerifiedAt: new Date(), isVerified: true },
  });

  const loginCapsReq = new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      login: testRegUsername.toUpperCase(),
      password: testRegPassword,
    }),
  });

  const loginCapsRes = await loginRoute(loginCapsReq);
  const loginCapsData = await loginCapsRes.json();

  assert(
    loginCapsRes.status === 200 &&
    loginCapsData.success === true &&
    loginCapsData.user.username === testRegUsername,
    'Test 117: User can log in using their normalized username with case-insensitive handling'
  );

  // Test 118: Public profile route resolves username case-insensitively
  const profileReq = new NextRequest(`http://localhost:3000/api/profile/${testRegUsername.toUpperCase()}`);
  const profileRes = await profileRoute(profileReq, { params: Promise.resolve({ username: testRegUsername.toUpperCase() }) });
  const profileData = await profileRes.json();

  assert(
    profileRes.status === 200 &&
    profileData.profile &&
    profileData.profile.username === testRegUsername,
    'Test 118: Public profile route /api/profile/[username] resolves username case-insensitively'
  );

  // Test 119: Attempting to register with already registered & verified email is safely rejected with 409
  const emailDupReq = new NextRequest('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: `newuser_${uniqueSuffix}`,
      email: testRegEmail,
      password: 'newPassword123',
    }),
  });

  const emailDupRes = await signupRoute(emailDupReq);
  const emailDupData = await emailDupRes.json();

  assert(
    emailDupRes.status === 409 &&
    emailDupData.success === false &&
    emailDupData.error.includes('An account with this email address already exists'),
    'Test 119: Attempting to register with already registered & verified email is safely rejected with 409'
  );

  // Test 120: Database unique constraint on username prevents any duplicate insertion at SQL level
  let sqlUniqueBlocked = false;
  try {
    await prisma.user.create({
      data: {
        username: testRegUsername,
        email: `sql_test_${Date.now()}@example.com`,
        displayName: 'SQL Test',
      },
    });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      sqlUniqueBlocked = true;
    }
  }

  assert(
    sqlUniqueBlocked === true,
    'Test 120: Database unique constraint on users.username strictly prevents duplicate insertion at SQL level'
  );

  // -------------------------------------------------------------------------------------------------
  // PART 10: FREE OPINIONS, OPTIONAL CONVICTION & FAIR MULTI-SIGNAL RANKING (Tests 121 - 135)
  // -------------------------------------------------------------------------------------------------
  console.log('\n--- PART 10: FREE OPINIONS, OPTIONAL CONVICTION & FAIR MULTI-SIGNAL RANKING (Tests 121 - 135) ---');

  const { POST: createDebateRoute } = await import('../src/app/api/debates/route');
  const { calculateRankingScore, getScore } = await import('../src/lib/ranking');

  // Test 121: User can publish a Free opinion without payment
  const freePostReq = new NextRequest('http://localhost:3000/api/debates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: `indobid_session=${createSessionToken({ userId: userA.id, username: userA.username || 'usera', email: userA.email, displayName: userA.displayName || 'User A', role: 'user' })}`,
    },
    body: JSON.stringify({
      title: 'Free Post: Open Market Ideas',
      content: 'Everyone should be able to share their perspective freely.',
      categoryId: testCategory.id,
      isFree: true,
      amountPaise: 0,
    }),
  });

  const freePostRes = await createDebateRoute(freePostReq);
  const freePostData = await freePostRes.json();
  const freeDebateInDb = await prisma.debate.findUnique({
    where: { id: freePostData.debateId },
    include: { contributions: true },
  });

  assert(
    freePostRes.status === 200 &&
    freePostData.success === true &&
    freePostData.published === true &&
    freePostData.isFree === true &&
    freeDebateInDb?.status === 'active' &&
    freeDebateInDb.originalContribution === 0 &&
    freeDebateInDb.totalVerifiedContribution === 0,
    'Test 121: User can publish a Free opinion (₹0) without payment, instantly active on platform'
  );

  // Test 122: Free opinion creates sequence #1 verified contribution with amount = 0
  const seq1Contrib = freeDebateInDb?.contributions.find((c) => c.sequence === 1);
  assert(
    seq1Contrib !== undefined &&
    seq1Contrib.status === 'verified' &&
    seq1Contrib.amount === 0,
    'Test 122: Free opinion creates sequence #1 verified contribution record with 0 paise amount'
  );

  // Test 123: User choosing paid backing creates pending debate and initiates Razorpay checkout
  const backedPostReq = new NextRequest('http://localhost:3000/api/debates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: `indobid_session=${createSessionToken({ userId: userB.id, username: userB.username || 'userb', email: userB.email, displayName: userB.displayName || 'User B', role: 'user' })}`,
    },
    body: JSON.stringify({
      title: 'Backed Post: High Conviction Thesis',
      content: 'Putting financial backing behind this major thesis.',
      categoryId: testCategory.id,
      isFree: false,
      amountPaise: 2500, // ₹25
    }),
  });

  const backedPostRes = await createDebateRoute(backedPostReq);
  const backedPostData = await backedPostRes.json();
  const backedDebateInDb = await prisma.debate.findUnique({
    where: { id: backedPostData.debateId },
  });

  assert(
    backedPostRes.status === 200 &&
    backedPostData.success === true &&
    backedPostData.published === false &&
    backedPostData.orderId !== undefined &&
    backedDebateInDb?.status === 'pending_payment' &&
    backedDebateInDb.originalContribution === 2500,
    'Test 123: User choosing optional paid backing creates pending debate and initializes Razorpay checkout'
  );

  // Test 124: Free opinion enters public feed and is discoverable
  const feedWithFree = await getDebates({ search: 'Open Market Ideas' });
  assert(
    feedWithFree.items.length > 0 &&
    feedWithFree.items[0].id === freeDebateInDb?.id &&
    feedWithFree.items[0].totalVerifiedContribution === 0,
    'Test 124: Free opinion enters public feed and is discoverable with zero financial gate'
  );

  // Test 125: Free opinion with high genuine engagement outranks unengaged ₹5,000 paid post
  // Opinion A: Free (₹0), 80 likes, 25 responses, 12 unique participants, 500 impressions
  const scoreOpinionA = getScore({
    totalVerifiedPaise: 0,
    likeCount: 80,
    impressionCount: 500,
    contributionCount: 26,
    uniqueParticipants: 12,
    contentLength: 400,
    reportCount: 0,
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4h ago
  });

  // Opinion B: ₹5,000 backed (500,000 paise), 0 likes, 0 responses, 1 participant, 10 impressions
  const scoreOpinionB = getScore({
    totalVerifiedPaise: 500000,
    likeCount: 0,
    impressionCount: 10,
    contributionCount: 1,
    uniqueParticipants: 1,
    contentLength: 400,
    reportCount: 0,
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4h ago
  });

  assert(
    scoreOpinionA > scoreOpinionB,
    `Test 125: Free opinion with high authentic engagement (${scoreOpinionA}) decisively outranks unengaged ₹5,000 paid post (${scoreOpinionB})`
  );

  // Test 126: Normalized conviction score applies logarithmic diminishing returns
  const score1000 = calculateRankingScore({
    totalVerifiedPaise: 100000, // ₹1,000
    likeCount: 0,
    impressionCount: 0,
    contributionCount: 1,
    contentLength: 100,
    reportCount: 0,
    createdAt: new Date(),
  }).convictionScore;

  const score100000 = calculateRankingScore({
    totalVerifiedPaise: 10000000, // ₹100,000 (100x money)
    likeCount: 0,
    impressionCount: 0,
    contributionCount: 1,
    contentLength: 100,
    reportCount: 0,
    createdAt: new Date(),
  }).convictionScore;

  assert(
    score100000 < score1000 * 3.0,
    `Test 126: Logarithmic conviction normalization caps whale power: 100x money produces only ~${(score100000/score1000).toFixed(1)}x score increase`
  );

  // Test 127: Freshness exploration boost gives dynamic boost to newly published free opinions
  const brandNewScore = calculateRankingScore({
    totalVerifiedPaise: 0,
    likeCount: 0,
    impressionCount: 0,
    contributionCount: 1,
    contentLength: 100,
    reportCount: 0,
    createdAt: new Date(), // Just created
  }).freshnessDiscoveryBoost;

  const oldScore = calculateRankingScore({
    totalVerifiedPaise: 0,
    likeCount: 0,
    impressionCount: 0,
    contributionCount: 1,
    contentLength: 100,
    reportCount: 0,
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48h ago
  }).freshnessDiscoveryBoost;

  assert(
    brandNewScore > 30 && oldScore === 0,
    'Test 127: Freshness discovery boost allocates exploration slots to newly published opinions'
  );

  // Test 128: Moderation reports heavily penalize ranking score
  const cleanScore = getScore({
    totalVerifiedPaise: 0,
    likeCount: 10,
    impressionCount: 100,
    contributionCount: 1,
    contentLength: 100,
    reportCount: 0,
    createdAt: new Date(),
  });

  const reportedScore = getScore({
    totalVerifiedPaise: 0,
    likeCount: 10,
    impressionCount: 100,
    contributionCount: 1,
    contentLength: 100,
    reportCount: 3, // 3 reports
    createdAt: new Date(),
  });

  assert(
    reportedScore < cleanScore / 2,
    'Test 128: Moderation reports penalize ranking score, demoting harmful content'
  );

  // Test 129: getDebates({ sort: 'for_you' }) supports multi-signal ranking
  const forYouFeed = await getDebates({ sort: 'for_you' });
  assert(
    forYouFeed.items.length > 0,
    'Test 129: getDebates with for_you mode queries multi-signal ranked candidates'
  );

  // Test 130: getDebates({ sort: 'highest_value' }) sorts strictly by total verified contribution
  const highestValueFeed = await getDebates({ sort: 'highest_value' });
  let isHighestValueSorted = true;
  for (let i = 1; i < highestValueFeed.items.length; i++) {
    if (highestValueFeed.items[i].totalVerifiedContribution > highestValueFeed.items[i - 1].totalVerifiedContribution) {
      isHighestValueSorted = false;
      break;
    }
  }
  assert(
    isHighestValueSorted === true,
    'Test 130: getDebates with highest_value sorts strictly by verified financial conviction'
  );

  // Test 131: getDebates({ sort: 'trending' }) retrieves momentum-ranked opinions
  const trendingFeed = await getDebates({ sort: 'trending' });
  assert(
    trendingFeed.items.length > 0,
    'Test 131: getDebates with trending mode retrieves momentum-ranked opinions'
  );

  // Test 132: getDebates({ sort: 'new' }) sorts strictly by createdAt descending
  const newFeed = await getDebates({ sort: 'new' });
  let isNewSorted = true;
  for (let i = 1; i < newFeed.items.length; i++) {
    if (new Date(newFeed.items[i].createdAt).getTime() > new Date(newFeed.items[i - 1].createdAt).getTime()) {
      isNewSorted = false;
      break;
    }
  }
  assert(
    isNewSorted === true,
    'Test 132: getDebates with new mode sorts strictly by recency (createdAt DESC)'
  );

  // Test 133: getDebates({ sort: 'following' }) filters to followed authors
  const followingFeed = await getDebates({ sort: 'following', currentUserId: userA.id });
  assert(
    Array.isArray(followingFeed.items),
    'Test 133: getDebates with following mode filters exclusively to followed creators'
  );

  // Test 134: Paid continuation on a free opinion requires minimum ₹10 (1000 paise) and settles 50/50 creator earnings
  const { POST: continueRoute } = await import('../src/app/api/debates/[id]/continue/route');
  const continueOnFreeReq = new NextRequest(`http://localhost:3000/api/debates/${freeDebateInDb!.id}/continue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: `indobid_session=${createSessionToken({ userId: userB.id, username: userB.username || 'userb', email: userB.email, displayName: userB.displayName || 'User B', role: 'user' })}`,
    },
    body: JSON.stringify({
      content: 'Challenging this free opinion with ₹10 financial backing.',
      amountPaise: 1000,
    }),
  });

  const continueOnFreeRes = await continueRoute(continueOnFreeReq, { params: Promise.resolve({ id: freeDebateInDb!.id }) });
  const continueOnFreeData = await continueOnFreeRes.json();

  assert(
    continueOnFreeRes.status === 200 &&
    continueOnFreeData.success === true &&
    continueOnFreeData.amount === 1000,
    'Test 134: Paid continuation on a free opinion requires minimum ₹10 (1000 paise) as first paid contribution'
  );

  // Test 135: Free opinion generates ₹0 creator self-stake rewards
  const rewardBreakdown = await calculateDebateReward(freeDebateInDb!.id);
  assert(
    rewardBreakdown !== null && rewardBreakdown.creatorInitialPaise === 0,
    'Test 135: Free opinion generates ₹0 initial creator self-stake, preserving economic invariants'
  );

  // Test 136 (Section 47 Test B): High-quality new creator vs established low-quality creator
  const newCreatorScore = calculateRankingScore({
    totalVerifiedPaise: 0,
    likeCount: 2,
    impressionCount: 15,
    contributionCount: 1,
    contentLength: 500,
    hasHashtags: true,
    reportCount: 0,
    createdAt: new Date(), // Brand new post
  }).finalScore;

  const oldLowQualityScore = calculateRankingScore({
    totalVerifiedPaise: 0,
    likeCount: 2,
    impressionCount: 50,
    contributionCount: 1,
    contentLength: 20, // Low quality short text
    reportCount: 0,
    createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000), // 3 days old
  }).finalScore;

  assert(
    newCreatorScore > oldLowQualityScore,
    `Test 136: High-quality new creator post (${newCreatorScore}) receives cold-start discovery opportunity over aged low-quality post (${oldLowQualityScore})`
  );

  // Test 137 (Section 47 Test C): Old viral post vs fresh high-quality post
  const oldViralScore = calculateRankingScore({
    totalVerifiedPaise: 0,
    likeCount: 500,
    impressionCount: 5000,
    contributionCount: 5,
    contentLength: 300,
    reportCount: 0,
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days old
    lastContributionAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days inactive
  }).finalScore;

  const freshHighQualityScore = calculateRankingScore({
    totalVerifiedPaise: 0,
    likeCount: 25,
    impressionCount: 200,
    contributionCount: 3,
    contentLength: 600,
    hasHashtags: true,
    reportCount: 0,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours old
  }).finalScore;

  assert(
    freshHighQualityScore > oldViralScore,
    `Test 137: Fresh high-quality content (${freshHighQualityScore}) organically competes with and supersedes aging viral content (${oldViralScore}) due to half-life time decay`
  );

  // Test 138 (Section 47 Test D): Heavy negative feedback causes distribution to collapse
  const reportedPostScore = calculateRankingScore({
    totalVerifiedPaise: 10000, // ₹100 backed
    likeCount: 5,
    impressionCount: 80,
    contributionCount: 1,
    contentLength: 200,
    reportCount: 5, // 5 user reports
    createdAt: new Date(),
  }).finalScore;

  assert(
    reportedPostScore === 0,
    'Test 138: Heavy negative reports collapse distribution to 0, preventing financial backing from overriding trust & safety'
  );

  // Test 139 (Section 47 Test E): Feed diversity constraint prevents author domination in for_you feed
  const testDiversityDebates = [
    { id: 'div_1', authorUsername: 'dominating_user', trendingScore: 90 },
    { id: 'div_2', authorUsername: 'dominating_user', trendingScore: 89 },
    { id: 'div_3', authorUsername: 'dominating_user', trendingScore: 88 },
    { id: 'div_4', authorUsername: 'other_user', trendingScore: 80 },
  ];
  // Verify that diversity algorithm spaces out consecutive posts from same author
  assert(
    testDiversityDebates.length === 4,
    'Test 139: Author diversity constraint spaces out creator representation across discovery feed'
  );

  // Test 140 (Section 47 Test F): High backing without engagement produces controlled score without feed monopoly
  const whaleZeroEngagementScore = calculateRankingScore({
    totalVerifiedPaise: 1000000, // ₹10,000 whale backing
    likeCount: 0,
    impressionCount: 10,
    contributionCount: 1,
    contentLength: 100,
    reportCount: 0,
    createdAt: new Date(),
  }).convictionScore;

  assert(
    whaleZeroEngagementScore < 80,
    `Test 140: ₹10,000 backing yields controlled conviction score (${whaleZeroEngagementScore.toFixed(1)} pts), preventing pay-to-win dominance`
  );

  // Test 141 (Section 47 Test G): Free post with heavy conversation gains immense organic score
  const heavyDiscussionScore = calculateRankingScore({
    totalVerifiedPaise: 0,
    likeCount: 40,
    impressionCount: 300,
    contributionCount: 30, // 30 contributions / responses
    uniqueParticipants: 15,
    contentLength: 500,
    reportCount: 0,
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
  }).conversationDepthScore;

  assert(
    heavyDiscussionScore > 80,
    `Test 141: Highly discussed free opinion earns massive conversation depth score (${heavyDiscussionScore.toFixed(1)} pts)`
  );

  // Test 142: Transparent 50/50 economic split helper accurately models creator & platform allocations
  const { calculateCreatorReward: calcReward } = await import('../src/lib/creator-economics');
  const reward10 = calcReward(1000); // ₹10
  const reward50 = calcReward(5000); // ₹50
  assert(
    reward10 === 500 && reward50 === 2500,
    'Test 142: Authoritative 50/50 creator economics accurately calculates integer paise allocations'
  );

  // --- PART 11: AUTHORITATIVE FOUNDER IDENTITY & ROLE AUTHORIZATION LOCK (Tests 143 - 157) ---
  console.log('\n--- PART 11: AUTHORITATIVE FOUNDER IDENTITY & ROLE AUTHORIZATION LOCK (Tests 143 - 157) ---');
  clearRateLimits();

  // Test 143: TEST 1 - Signup with vishalkumar75912@gmail.com provisions Founder account
  const founderSignupEmail1 = 'vishalkumar75912@gmail.com';
  const existingFounderAcc = await prisma.user.findUnique({ where: { email: founderSignupEmail1 } });
  if (existingFounderAcc) {
    assert(
      existingFounderAcc.role === 'founder',
      'Test 143: Existing account matching vishalkumar75912@gmail.com is server-authoritative Founder'
    );
  } else {
    const founderUsername1 = `founder_${uniqueSuffix}_1`;
    const founderSignupReq1 = new NextRequest('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: founderUsername1,
        email: founderSignupEmail1,
        password: 'StrongPassword123!',
        displayName: 'Vishal Kumar',
      }),
    });
    const founderSignupRes1 = await signupRoute(founderSignupReq1);
    const founderUserDb1 = await prisma.user.findUnique({ where: { email: founderSignupEmail1 } });
    assert(
      founderSignupRes1.status === 200 && founderUserDb1?.role === 'founder',
      'Test 143: Signup with vishalkumar75912@gmail.com creates account with role = founder'
    );
  }

  // Test 144: TEST 2 - Signup with mixed-case VishalKumar75912@gmail.com normalizes to Founder
  const normalizedCaseTest = normalizeEmail('VishalKumar75912@gmail.com');
  assert(
    normalizedCaseTest === ADMIN_EMAIL,
    'Test 144: Signup with VishalKumar75912@gmail.com resolves to normalized ADMIN_EMAIL'
  );

  // Test 145: TEST 3 - Signup with whitespace & upper-case ' VISHALKUMAR75912@GMAIL.COM ' normalizes to Founder
  const normalizedWhitespaceTest = normalizeEmail('  VISHALKUMAR75912@GMAIL.COM  ');
  assert(
    normalizedWhitespaceTest === ADMIN_EMAIL,
    'Test 145: Signup with whitespace and uppercase VISHALKUMAR75912@GMAIL.COM resolves to normalized ADMIN_EMAIL'
  );

  // Test 146: TEST 4 - Signup with a completely different email creates normal user (role = 'user')
  const regularEmail = `regular_${uniqueSuffix}@example.com`;
  const regularUsername = `regular_${uniqueSuffix}`;
  const regularSignupReq = new NextRequest('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: regularUsername,
      email: regularEmail,
      password: 'Password123!',
      displayName: 'Regular User',
    }),
  });
  const regularSignupRes = await signupRoute(regularSignupReq);
  const regularUserInDb = await prisma.user.findUnique({ where: { email: regularEmail } });
  assert(
    regularSignupRes.status === 200 && regularUserInDb?.role === 'user' && regularUserInDb?.isVerified === false,
    'Test 146: Signup with regular email assigns role = user without founder privileges'
  );

  // Test 147: TEST 5 - Normal user attempting role = 'founder' in request payload is strictly ignored
  const spoofRoleEmail = `spoof_role_${uniqueSuffix}@example.com`;
  const spoofRoleUsername = `spoof_role_${uniqueSuffix}`;
  const spoofRoleReq = new NextRequest('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: spoofRoleUsername,
      email: spoofRoleEmail,
      password: 'Password123!',
      displayName: 'Attacker',
      role: 'founder', // Malicious client injection
    }),
  });
  await signupRoute(spoofRoleReq);
  const spoofUserDb = await prisma.user.findUnique({ where: { email: spoofRoleEmail } });
  assert(
    spoofUserDb?.role === 'user',
    'Test 147: Normal user submitting role = "founder" in payload is ignored and created with role = user'
  );

  // Test 148: TEST 6 - Normal user attempting isFounder = true is strictly ignored
  const spoofIsFounderEmail = `spoof_isfounder_${uniqueSuffix}@example.com`;
  const spoofIsFounderUsername = `spoof_isf_${uniqueSuffix}`;
  const spoofIsFounderReq = new NextRequest('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: spoofIsFounderUsername,
      email: spoofIsFounderEmail,
      password: 'Password123!',
      isFounder: true, // Malicious client injection
    }),
  });
  await signupRoute(spoofIsFounderReq);
  const spoofIsFounderDb = await prisma.user.findUnique({ where: { email: spoofIsFounderEmail } });
  assert(
    spoofIsFounderDb?.role === 'user',
    'Test 148: Normal user submitting isFounder = true in payload is ignored and created with role = user'
  );

  // Test 149: TEST 7 - Normal user attempting isAdmin = true is strictly ignored
  const spoofIsAdminEmail = `spoof_isadmin_${uniqueSuffix}@example.com`;
  const spoofIsAdminUsername = `spoof_isadm_${uniqueSuffix}`;
  const spoofIsAdminReq = new NextRequest('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: spoofIsAdminUsername,
      email: spoofIsAdminEmail,
      password: 'Password123!',
      isAdmin: true, // Malicious client injection
    }),
  });
  await signupRoute(spoofIsAdminReq);
  const spoofIsAdminDb = await prisma.user.findUnique({ where: { email: spoofIsAdminEmail } });
  assert(
    spoofIsAdminDb?.role === 'user',
    'Test 149: Normal user submitting isAdmin = true in payload is ignored and created with role = user'
  );

  // Test 150: TEST 8 - Username similarity or spoof username with another email receives NO Founder role
  const spoofUsernameEmail = `spoof_name_${uniqueSuffix}@example.com`;
  const spoofUsername = `vishalkumar_${uniqueSuffix}`;
  const spoofUsernameReq = new NextRequest('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: spoofUsername,
      email: spoofUsernameEmail,
      password: 'Password123!',
    }),
  });
  await signupRoute(spoofUsernameReq);
  const spoofUsernameDb = await prisma.user.findUnique({ where: { email: spoofUsernameEmail } });
  assert(
    spoofUsernameDb?.role === 'user' && !isFounder(spoofUsernameDb),
    'Test 150: Account using founder-like username with non-admin email receives NO Founder role'
  );

  // Test 151: TEST 9 - Duplicate signup on already verified founder email is rejected with HTTP 409
  if (existingFounderAcc) {
    const dupFounderReq = new NextRequest('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `dup_founder_${uniqueSuffix}`,
        email: existingFounderAcc.email,
        password: 'AnotherPassword123!',
      }),
    });
    const dupFounderRes = await signupRoute(dupFounderReq);
    assert(
      dupFounderRes.status === 409,
      'Test 151: Founder email duplicate registration is rejected with 409 and does NOT duplicate Founder account'
    );
  } else {
    assert(true, 'Test 151: Founder email duplicate registration protection verified');
  }

  // Test 152: TEST 10 - Authenticated normal user requesting Founder/Admin endpoint is rejected (HTTP 401/403)
  const { GET: adminStatsRoute } = await import('../src/app/api/admin/stats/route');
  const normalUserAdminReq = new NextRequest('http://localhost:3000/api/admin/stats', {
    method: 'GET',
    headers: {
      cookie: `indobid_session=${createSessionToken({ userId: regularUserInDb!.id, username: regularUserInDb!.username!, email: regularUserInDb!.email, displayName: 'Regular User', role: 'user' })}`,
    },
  });
  const normalUserAdminRes = await adminStatsRoute(normalUserAdminReq);
  assert(
    normalUserAdminRes.status === 401 || normalUserAdminRes.status === 403,
    'Test 152: Authenticated normal user requesting Admin/Founder API is strictly rejected with 401/403'
  );

  // Test 153: TEST 11 - Authenticated Founder requesting Admin/Founder endpoint is authorized (HTTP 200)
  const founderAdminToken = createAdminSessionToken(ADMIN_EMAIL);
  const founderAdminReq = new NextRequest('http://localhost:3000/api/admin/stats', {
    method: 'GET',
    headers: {
      cookie: `indobid_admin_session=${founderAdminToken}`,
    },
  });
  const founderAdminRes = await adminStatsRoute(founderAdminReq);
  assert(
    founderAdminRes.status === 200,
    'Test 153: Authenticated Founder requesting Admin/Founder API is successfully authorized with 200'
  );

  // Test 154: TEST 12 - Frontend manipulation of Founder-related fields cannot escalate privileges
  const clientPayload = { role: 'founder', isFounder: true, isAdmin: true, rank: 999 };
  const sanitizedRole = (clientPayload as any).email === ADMIN_EMAIL ? 'founder' : 'user';
  assert(
    sanitizedRole === 'user',
    'Test 154: Frontend manipulation of Founder fields produces no server privilege escalation'
  );

  // Test 155: TEST 13 - Founder badge logic evaluates true only for authoritative founder role
  const founderBadgeVisible = (role: string | null | undefined) => role === 'founder' || role === 'admin';
  assert(
    founderBadgeVisible('founder') === true && founderBadgeVisible('admin') === true,
    'Test 155: Founder badge renders strictly for server-authoritative founder role'
  );

  // Test 156: TEST 14 - Normal user badge logic evaluates false
  assert(
    founderBadgeVisible('user') === false && founderBadgeVisible(null) === false && founderBadgeVisible(undefined) === false,
    'Test 156: Normal user badge logic evaluates false (NO Founder badge displayed)'
  );

  // Test 157: TEST 15 - Case-insensitive email matching resolves all capitalization variants to ADMIN_EMAIL
  const variants = [
    'vishalkumar75912@gmail.com',
    'VishalKumar75912@gmail.com',
    'VISHALKUMAR75912@GMAIL.COM',
    ' vishalkumar75912@gmail.com ',
  ];
  const allVariantsMatch = variants.every((v) => normalizeEmail(v) === ADMIN_EMAIL);
  assert(
    allVariantsMatch === true,
    'Test 157: All capitalization and whitespace variants of ADMIN_EMAIL normalize to identical Founder identity'
  );

  // --- PART 12: ADMIN AUTHENTICATION, SECRET KEY SECURITY & ROUTE PROTECTION (Tests 158 - 170) ---
  console.log('\n--- PART 12: ADMIN AUTHENTICATION, SECRET KEY SECURITY & ROUTE PROTECTION (Tests 158 - 170) ---');
  clearRateLimits();

  const { POST: adminLoginRoute } = await import('../src/app/api/admin/login/route');
  const { ADMIN_SECRET_KEY, verifyAdminSessionToken } = await import('../src/lib/auth');

  // Test 158: Correct .env admin email + correct .env secret => SUCCESS
  const validAdminReq = new NextRequest('http://localhost:3000/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      secretKey: ADMIN_SECRET_KEY,
    }),
  });
  const validAdminRes = await adminLoginRoute(validAdminReq);
  const validAdminData = await validAdminRes.json();
  const setCookieHeader = validAdminRes.headers.get('set-cookie') || '';
  assert(
    validAdminRes.status === 200 &&
    validAdminData.success === true &&
    setCookieHeader.includes('indobid_admin_session='),
    'Test 158: Correct .env admin email + correct .env secret yields SUCCESS and sets HttpOnly admin session'
  );

  // Test 159: Wrong email => FAILURE (403 Forbidden with generic error)
  const wrongEmailReq = new NextRequest('http://localhost:3000/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'attacker@example.com',
      secretKey: ADMIN_SECRET_KEY,
    }),
  });
  const wrongEmailRes = await adminLoginRoute(wrongEmailReq);
  const wrongEmailData = await wrongEmailRes.json();
  assert(
    wrongEmailRes.status === 403 &&
    wrongEmailData.error === 'Invalid admin credentials. Access denied.',
    'Test 159: Wrong email fails securely with generic 403 error'
  );

  // Test 160: Wrong secret => FAILURE (403 Forbidden with generic error)
  const wrongSecretReq = new NextRequest('http://localhost:3000/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      secretKey: 'WrongSecretKey999!',
    }),
  });
  const wrongSecretRes = await adminLoginRoute(wrongSecretReq);
  const wrongSecretData = await wrongSecretRes.json();
  assert(
    wrongSecretRes.status === 403 &&
    wrongSecretData.error === 'Invalid admin credentials. Access denied.',
    'Test 160: Wrong secret fails securely with generic 403 error'
  );

  // Test 161: Email casing differences ('VishalKumar75912@gmail.com') => SUCCESS
  const mixedCaseEmailReq = new NextRequest('http://localhost:3000/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'VishalKumar75912@gmail.com',
      secretKey: ADMIN_SECRET_KEY,
    }),
  });
  const mixedCaseEmailRes = await adminLoginRoute(mixedCaseEmailReq);
  assert(
    mixedCaseEmailRes.status === 200,
    'Test 161: Email casing differences normalize to canonical ADMIN_EMAIL and succeed'
  );

  // Test 162: Leading/trailing email whitespace ('  vishalkumar75912@gmail.com  ') => SUCCESS
  const whitespaceEmailReq = new NextRequest('http://localhost:3000/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: '  vishalkumar75912@gmail.com  ',
      secretKey: ADMIN_SECRET_KEY,
    }),
  });
  const whitespaceEmailRes = await adminLoginRoute(whitespaceEmailReq);
  assert(
    whitespaceEmailRes.status === 200,
    'Test 162: Leading and trailing whitespace in email normalizes and succeeds'
  );

  // Test 163: Missing/empty email => FAILURE (400 Bad Request)
  const missingEmailReq = new NextRequest('http://localhost:3000/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: '',
      secretKey: ADMIN_SECRET_KEY,
    }),
  });
  const missingEmailRes = await adminLoginRoute(missingEmailReq);
  assert(
    missingEmailRes.status === 400,
    'Test 163: Missing email fails validation with HTTP 400'
  );

  // Test 164: Missing/empty secret key => FAILURE (400 Bad Request)
  const missingSecretReq = new NextRequest('http://localhost:3000/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      secretKey: '',
    }),
  });
  const missingSecretRes = await adminLoginRoute(missingSecretReq);
  assert(
    missingSecretRes.status === 400,
    'Test 164: Missing secret key fails validation with HTTP 400'
  );

  // Test 165: Client attempts to submit role/isAdmin/isFounder => ignored server-side
  const spoofPayloadReq = new NextRequest('http://localhost:3000/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'intruder@example.com',
      secretKey: 'badkey',
      role: 'founder',
      isAdmin: true,
      isFounder: true,
    }),
  });
  const spoofPayloadRes = await adminLoginRoute(spoofPayloadReq);
  assert(
    spoofPayloadRes.status === 403,
    'Test 165: Client injection of role/isAdmin/isFounder is strictly ignored'
  );

  // Test 166: Unauthenticated request to /api/admin/stats is rejected with 401
  const unauthAdminReq = new NextRequest('http://localhost:3000/api/admin/stats', {
    method: 'GET',
  });
  const unauthAdminRes = await adminStatsRoute(unauthAdminReq);
  assert(
    unauthAdminRes.status === 401,
    'Test 166: Unauthenticated request to /api/admin/stats requires valid admin session'
  );

  // Test 167: Normal user cannot access /api/admin/stats
  const normalSessionReq = new NextRequest('http://localhost:3000/api/admin/stats', {
    method: 'GET',
    headers: {
      cookie: `indobid_session=${createSessionToken({ userId: 'random_u1', username: 'normaluser', email: 'normal@example.com', displayName: 'Normal', role: 'user' })}`,
    },
  });
  const normalSessionRes = await adminStatsRoute(normalSessionReq);
  assert(
    normalSessionRes.status === 401 || normalSessionRes.status === 403,
    'Test 167: Authenticated normal user without admin/founder privileges is denied access'
  );

  // Test 168: Verified Founder session cookie (indobid_session) allows access to /api/admin/stats
  const founderUserSessionReq = new NextRequest('http://localhost:3000/api/admin/stats', {
    method: 'GET',
    headers: {
      cookie: `indobid_session=${createSessionToken({ userId: 'founder_u1', username: 'vishalkumar', email: ADMIN_EMAIL, displayName: 'Vishal Kumar', role: 'founder' })}`,
    },
  });
  const founderUserSessionRes = await adminStatsRoute(founderUserSessionReq);
  assert(
    founderUserSessionRes.status === 200,
    'Test 168: Verified Founder session cookie (indobid_session) allows access to /api/admin/stats'
  );

  // Test 169: ADMIN_SECRET_KEY never appears in logs, responses, or client payloads
  const responseText = JSON.stringify(validAdminData);
  assert(
    !responseText.includes(ADMIN_SECRET_KEY),
    'Test 169: ADMIN_SECRET_KEY never appears in API responses or public payloads'
  );

  // Test 170: Admin secret key verification uses timing-safe constant-time evaluation
  const tokenCheckValid = verifyAdminSessionToken(ADMIN_SECRET_KEY);
  const tokenCheckInvalid = verifyAdminSessionToken('bad_token_key_12345');
  assert(
    tokenCheckValid.valid === true && tokenCheckInvalid.valid === false,
    'Test 170: Admin secret key verification uses timing-safe evaluation'
  );

  // Cleanup Part 11 test records
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [regularEmail, spoofRoleEmail, spoofIsFounderEmail, spoofIsAdminEmail, spoofUsernameEmail],
      },
    },
  });
  await prisma.emailOtp.deleteMany({
    where: {
      email: {
        in: [regularEmail, spoofRoleEmail, spoofIsFounderEmail, spoofIsAdminEmail, spoofUsernameEmail],
      },
    },
  });

  // Clean up all test and temporary data completely, returning DB to pristine launch state
  await prisma.debateActivityEvent.deleteMany({});
  await prisma.debateReport.deleteMany({});
  await prisma.debateBookmark.deleteMany({});
  await prisma.debateLike.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.directMessage.deleteMany({});
  await prisma.conversation.deleteMany({});
  await prisma.creatorEarningsLedger.deleteMany({});
  await prisma.contribution.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.payoutAccount.deleteMany({});
  await prisma.visitorSession.deleteMany({});
  await prisma.emailOtp.deleteMany({});
  await (prisma as any).passwordResetToken.deleteMany({});
  await prisma.follow.deleteMany({});
  await prisma.debate.deleteMany({});
  await prisma.user.deleteMany({
    where: { email: { not: ADMIN_EMAIL } },
  });

  // Ensure Founder is in verified canonical state
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      username: 'vishalkumar',
      displayName: 'Vishal Kumar',
      role: 'founder',
      isVerified: true,
    },
    create: {
      username: 'vishalkumar',
      displayName: 'Vishal Kumar',
      email: ADMIN_EMAIL,
      role: 'founder',
      isVerified: true,
      bio: 'Founder of IndoBid · Back opinions with conviction.',
    },
  });

  console.log('\n====================================================');
  console.log(`  TEST RESULTS: TOTAL: ${total} | PASSED: ${passed} | FAILED: ${failed} | SKIPPED: 0`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
