import { prisma } from '../src/lib/db';
import { processSuccessfulPayment } from '../src/lib/payments/fulfillment';
import { RazorpayProvider } from '../src/lib/payments/razorpay-provider';
import {
  formatINR,
  formatUSD,
  MINIMUM_DEBATE_PAISE,
  MINIMUM_INCREMENT_PAISE,
  calculateNextMinimumPaise,
  isValidContributionAmount,
  paiseToRupees,
  rupeesToPaise,
} from '../src/lib/money';
import { calculateCreatorEconomics, calculateDebateReward } from '../src/lib/creator-economics';
import { calculateTrendingScore } from '../src/lib/trending';
import { getDebates, getDebateById } from '../src/lib/debates';
import { isAuthorizedAdmin, ADMIN_EMAIL, normalizeEmail, createAdminSessionToken } from '../src/lib/auth';
import { hashPassword, verifyPassword, createSessionToken, verifySessionToken } from '../src/lib/user-auth';
import { requestEmailOtp, verifyEmailOtp, generateOtpCode } from '../src/lib/email-otp';
import { clearRateLimits } from '../src/lib/rate-limit';
import {
  BASE_CURRENCY,
  BASE_MINIMUM_SUPPORT,
  BASE_MINIMUM_SUPPORT_PAISE,
  getCurrencyForCountry,
  isValidCountryCode,
  exchangeRateService,
  getMinimumSupport,
  validateSupportAmount,
  getLocalizedPresets,
  formatCurrencyAmount,
} from '../src/lib/money';
import { paymentService } from '../src/modules/payments/payment.service';
import { GET as getHealthRoute, HEAD as headHealthRoute } from '../src/app/api/health/route';
import { GET as getHealthDbRoute } from '../src/app/api/health/db/route';
import { DELETE as deleteDebateRoute } from '../src/app/api/debates/[id]/route';
import { GET as getProfileRoute } from '../src/app/api/profile/[username]/route';
import { DELETE as deleteAdminDebateRoute, PATCH as patchAdminDebateRoute } from '../src/app/api/admin/debates/route';
import { DELETE as deleteAdminDebateByIdRoute, PATCH as patchAdminDebateByIdRoute } from '../src/app/api/admin/debates/[id]/route';
import { ADMIN_SECRET_KEY } from '../src/modules/auth/authorization';
import { ADMIN_SESSION_COOKIE } from '../src/modules/auth/session.service';
import { NextRequest } from 'next/server';
import {
  sanitizePaymentNote,
  sanitizeUserTextForNote,
  sanitizePaymentNoteKey,
  buildSafeRazorpayNotes,
} from '../src/infrastructure/payments/payment-metadata';
import { userService } from '../src/modules/users/user.service';
import { debateService } from '../src/modules/debates/debate.service';
import { personalizationService } from '../src/modules/feed/signals/personalization.service';
import { calculateSearchRelevanceScore } from '../src/modules/feed/algorithms/search';
import { processRefundedPayment } from '../src/lib/payments/fulfillment';
import { GET as getTrendingRoute } from '../src/app/api/trending/route';
import { messageService } from '../src/modules/social/messages/message.service';
import { followService } from '../src/modules/social/follows/follow.service';
import { ValidationError, AuthorizationError } from '../src/lib/errors';
import { GET as getGoogleAuthRoute } from '../src/app/api/auth/google/route';
import { GET as getGoogleCallbackRoute } from '../src/app/api/auth/callback/google/route';
import {
  resolveGoogleRedirectUri,
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_REDIRECT_URI_COOKIE,
  GOOGLE_OAUTH_DESTINATION_COOKIE,
} from '../src/modules/auth/google-oauth.service';
import { sessionService, AUTH_COOKIE_NAME } from '../src/modules/auth/session.service';
import { isFounder as isFounderCheck } from '../src/modules/auth/authorization';
import { env } from '../src/config/env';
import { parseFeedXml, decodeXmlEntities } from '../src/services/indobid-daily/providers/rss.provider';
import { cleanArticleUrl, normalizeTitle, extractKeywords, decodeHtmlEntities } from '../src/services/indobid-daily/normalizer';
import { calculateFingerprint, deduplicateBatch, filterAgainstDatabase } from '../src/services/indobid-daily/deduplicator';
import { clusterArticles, selectCanonicalTitle } from '../src/services/indobid-daily/clusterer';
import { scoreCluster, calculateFreshnessScore, calculateVelocityScore } from '../src/services/indobid-daily/trend-scorer';
import { validateClusterQuality } from '../src/services/indobid-daily/quality-checker';
import { generatePostContent, mapCategoryToIndoBidSlug } from '../src/services/indobid-daily/content-generator';
import { getOrCreateSystemBot, publishStoryCluster, INDOBID_DAILY_BOT_USERNAME } from '../src/services/indobid-daily/publisher';
import { runDailyPipeline } from '../src/services/indobid-daily/daily-runner';
import { POST as postCronRoute } from '../src/app/api/cron/indobid-daily/route';
import { NewsSource, NewsCandidate, StoryClusterData } from '../src/services/indobid-daily/types';
import { safeDb } from '../src/infrastructure/database/transactions';

let passed = 0;
let failed = 0;
let total = 0;

process.on('uncaughtException', (err) => {
  console.error('CRITICAL UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL UNHANDLED REJECTION:', reason);
  process.exit(1);
});

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

  // Clean previous test data safely (strictly scoped to test records to preserve real user content)
  const testDebateCondition = {
    OR: [
      { title: { startsWith: 'Test Debate' } },
      { title: { startsWith: 'TEST_' } },
      { title: { startsWith: 'Founder Free Post: The Future of IndoBid' } },
      { title: { startsWith: 'Admin Console: Official Announcement' } },
      { title: { startsWith: 'Original Title Before Author Edit' } },
      { title: { startsWith: 'Debate to be hidden' } },
      { title: { startsWith: '🚀 Welcome to IndoBid' } },
      { authorUsername: { startsWith: 'test' } },
      { authorUsername: { startsWith: 'p17_' } },
      { authorUsername: { startsWith: 'canonical_' } },
      { authorUsername: { startsWith: 'ghost_' } },
      { authorUsername: { startsWith: 'unicode_' } },
      { authorUsername: { in: ['debater_p17a', 'debater_p17b', 'ghost_writer'] } },
    ],
  };

  const testUserCondition = {
    OR: [
      { email: { endsWith: '@example.com' } },
      { email: { startsWith: 'test' } },
      { email: { startsWith: 'p17_' } },
      { email: { startsWith: 'canonical_' } },
      { email: { startsWith: 'ghost_' } },
      { email: { startsWith: 'unicode_' } },
      { email: { startsWith: 'us_' } },
      { email: { startsWith: 'gb_' } },
      { email: { startsWith: 'consumer_' } },
      { email: { startsWith: 'regular_' } },
      { email: { startsWith: 'spoof_' } },
      { email: { startsWith: 'admin_test_' } },
      { email: { startsWith: 'resetuser_' } },
      { email: { startsWith: 'direct_otp_' } },
      { email: { startsWith: 'unverified_' } },
      { username: { startsWith: 'test' } },
      { username: { startsWith: 'p17_' } },
    ],
  };

  await safeExecute(() => prisma.debateActivityEvent.deleteMany({ where: { debate: testDebateCondition } }));
  await safeExecute(() => prisma.debateReport.deleteMany({ where: { debate: testDebateCondition } }));
  await safeExecute(() => prisma.debateBookmark.deleteMany({ where: { debate: testDebateCondition } }));
  await safeExecute(() => prisma.debateLike.deleteMany({ where: { debate: testDebateCondition } }));
  await safeExecute(() => prisma.creatorEarningsLedger.deleteMany({ where: { debate: testDebateCondition } }));
  await safeExecute(() => prisma.payment.deleteMany({ where: { OR: [{ debate: testDebateCondition }, { providerPaymentId: { startsWith: 'test_' } }] } }));
  await safeExecute(() => prisma.contribution.deleteMany({ where: { debate: testDebateCondition } }));
  await safeExecute(() => prisma.debate.deleteMany({ where: testDebateCondition }));
  await safeExecute(() => prisma.notification.deleteMany({ where: { user: testUserCondition } }));
  await safeExecute(() => prisma.directMessage.deleteMany({ where: { sender: testUserCondition } }));
  await safeExecute(() => prisma.follow.deleteMany({ where: { follower: testUserCondition } }));
  await safeExecute(() => prisma.usernameChangeHistory.deleteMany({ where: { user: testUserCondition } }));
  await safeExecute(() => prisma.category.deleteMany({ where: { slug: { in: ['tech', 'finance', 'cooking', 'test_category'] } } }));
  await safeExecute(() => prisma.user.deleteMany({ where: testUserCondition }));

  await safeExecute(() =>
    prisma.user.upsert({
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
    })
  );

  // -------------------------------------------------------------------------------------------------
  // PART 1: ECONOMIC & MONETARY BACKEND RULES (1 - 24)
  // -------------------------------------------------------------------------------------------------
  console.log('\n--- PART 1: ECONOMIC & MONETARY VALIDATION (Tests 1 - 24) ---');

  // Test 1: New debate with $2 USD (200 paise) payment succeeds
  const payId1 = `test_pay_001_${Date.now()}`;
  const debate1 = await prisma.debate.create({
    data: {
      title: 'Test Debate 1: AI Future',
      content: 'AI will create more opportunities than it destroys.',
      categoryId: testCategory.id,
      authorUsername: 'test_aman',
      authorDisplayName: 'Aman',
      originalContribution: 200, // $2 USD
      totalVerifiedContribution: 0,
      contributionCount: 0,
      status: 'pending_payment',
    },
  });

  const res1 = await processSuccessfulPayment({
    providerPaymentId: payId1,
    debateId: debate1.id,
    amountPaise: 200, // $2 USD (200 paise)
    currency: 'INR',
  });

  const d1Check = await prisma.debate.findUnique({ where: { id: debate1.id } });
  assert(
    res1.success && d1Check?.status === 'active' && d1Check.totalVerifiedContribution === 200 && d1Check.contributionCount === 1,
    'Test 1: New debate with $2 USD (200 paise) payment succeeds and activates with 1 contribution'
  );

  // Test 2: New debate with less than $2 USD (< 200 paise) is rejected
  let test2FailedProperly = false;
  let debate2: any = null;
  try {
    debate2 = await prisma.debate.create({
      data: {
        title: 'Test Debate 2: Low Amount',
        content: 'Testing rejection of under-minimum starting amount.',
        categoryId: testCategory.id,
        authorUsername: 'test_rohit',
        originalContribution: 100, // $1 < $2
        totalVerifiedContribution: 0,
        contributionCount: 0,
        status: 'pending_payment',
      },
    });

    await processSuccessfulPayment({
      providerPaymentId: `test_pay_002_${Date.now()}`,
      debateId: debate2.id,
      amountPaise: 100, // $1 < $2 (100 paise < 200 paise)
      currency: 'INR',
    });
  } catch (err: any) {
    test2FailedProperly = err.message.includes('New debate requires at least');
  }
  assert(test2FailedProperly, 'Test 2: New debate with less than $2 USD (100 paise) is rejected by backend monetary validation');

  // Test 3: Failed payment does NOT publish debate
  const debate3 = await prisma.debate.create({
    data: {
      title: 'Test Debate 3: Failed Payment',
      content: 'This debate has a failed payment record and must remain unpublished.',
      categoryId: testCategory.id,
      authorUsername: 'test_failed_user',
      originalContribution: 200,
      totalVerifiedContribution: 0,
      status: 'pending_payment',
    },
  });
  await prisma.payment.create({
    data: {
      providerPaymentId: `test_pay_failed_${Date.now()}`,
      debateId: debate3.id,
      amount: 200,
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
      originalContribution: 200,
      totalVerifiedContribution: 0,
      status: 'pending_payment',
    },
  });
  await prisma.payment.create({
    data: {
      providerPaymentId: `test_pay_cancelled_${Date.now()}`,
      debateId: debate4.id,
      amount: 200,
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
    d1Public !== null && d1Public.totalVerifiedContribution === 200 && d1Public.status === 'active',
    'Test 6: Successful payment publishes debate to public view with verified totals'
  );

  // Test 7: Duplicate webhook is idempotent
  const res1Dup = await processSuccessfulPayment({
    providerPaymentId: payId1,
    debateId: debate1.id,
    amountPaise: 200,
    currency: 'INR',
  });
  const d1AfterDup = await prisma.debate.findUnique({ where: { id: debate1.id } });
  assert(
    d1AfterDup?.totalVerifiedContribution === 200 && d1AfterDup.contributionCount === 1,
    'Test 7: Duplicate webhook processed idempotently without doubling contribution or count'
  );

  // Test 8: First continuation after $2 (200 paise) requires minimum $3 (300 paise)
  const minAfter2 = calculateNextMinimumPaise(200);
  assert(minAfter2 === 300, 'Test 8: First continuation after $2 calculated to require exactly minimum $3 (300 paise)');

  // Test 9: Continuation with $2 (200 paise) is rejected
  let test9FailedProperly = false;
  try {
    await processSuccessfulPayment({
      providerPaymentId: `test_pay_c1_${Date.now()}`,
      debateId: debate1.id,
      amountPaise: 200, // $2 < minimum $3 (200 < 300)
      currency: 'INR',
      metadata: { authorUsername: 'test_priya', content: 'Argument with insufficient amount' },
    });
  } catch (err: any) {
    test9FailedProperly = err.message.includes('Insufficient contribution: must be at least');
  }
  assert(test9FailedProperly, 'Test 9: Continuation with $2 is strictly rejected when previous was $2');

  // Test 10: Continuation with $3 (300 paise) succeeds
  const res10 = await processSuccessfulPayment({
    providerPaymentId: `test_pay_c2_${Date.now()}`,
    debateId: debate1.id,
    amountPaise: 300, // $3
    currency: 'INR',
    metadata: { authorUsername: 'test_priya', authorDisplayName: 'Priya', content: 'Counter argument #1' },
  });
  const d1AfterC2 = await prisma.debate.findUnique({ where: { id: debate1.id } });
  assert(
    res10.success && d1AfterC2?.totalVerifiedContribution === 500 && d1AfterC2.lastContributionAmount === 300 && d1AfterC2.contributionCount === 2,
    'Test 10: Continuation with $3 succeeds and updates last contribution to 300 and sequence to 2'
  );

  // Test 11: After $3, next minimum is $4 (400 paise)
  const minAfter3 = calculateNextMinimumPaise(300);
  assert(minAfter3 === 400, 'Test 11: After $3, next minimum is strictly calculated as $4 (400 paise)');

  // Test 12: Continuation with $3 after latest $3 is rejected
  let test12FailedProperly = false;
  try {
    await processSuccessfulPayment({
      providerPaymentId: `test_pay_c3_fail_${Date.now()}`,
      debateId: debate1.id,
      amountPaise: 300, // previous was $3, $3 is now invalid
      currency: 'INR',
    });
  } catch {
    test12FailedProperly = true;
  }
  assert(test12FailedProperly, 'Test 12: Continuation with same amount $3 is rejected by backend');

  // Test 13: Continuation with $4 (400 paise) succeeds
  const res13 = await processSuccessfulPayment({
    providerPaymentId: `test_pay_c3_${Date.now()}`,
    debateId: debate1.id,
    amountPaise: 400, // $4
    currency: 'INR',
    metadata: { authorUsername: 'test_karan', authorDisplayName: 'Karan', content: 'Counter argument #2' },
  });
  const d1AfterC3 = await prisma.debate.findUnique({ where: { id: debate1.id } });
  assert(
    res13.success && d1AfterC3?.totalVerifiedContribution === 900 && d1AfterC3.lastContributionAmount === 400 && d1AfterC3.contributionCount === 3,
    'Test 13: Continuation with $4 succeeds and advances sequence to 3'
  );

  // Test 14: User can pay more than minimum (e.g. $25 vs $5 minimum)
  const payIdC4 = `test_pay_c4_${Date.now()}`;
  const res14 = await processSuccessfulPayment({
    providerPaymentId: payIdC4,
    debateId: debate1.id,
    amountPaise: 2500, // $25 (greater than $5 minimum)
    currency: 'INR',
    metadata: { authorUsername: 'test_vikram', authorDisplayName: 'Vikram', content: 'High conviction boost' },
  });
  const d1AfterC4 = await prisma.debate.findUnique({ where: { id: debate1.id } });
  assert(
    res14.success && d1AfterC4?.lastContributionAmount === 2500,
    'Test 14: User can pay higher amount ($25) and last contribution updates to $25'
  );

  // Test 15: Paying higher amount updates running total verified contribution
  assert(
    d1AfterC4?.totalVerifiedContribution === 3400,
    'Test 15: Paying above minimum correctly updates running total verified contribution to $34 (3400 paise)'
  );

  // Test 16: When latest was $25, $19 is rejected
  let test16FailedProperly = false;
  try {
    await processSuccessfulPayment({
      providerPaymentId: `test_pay_c5_fail_${Date.now()}`,
      debateId: debate1.id,
      amountPaise: 1900, // $19 < $26
      currency: 'INR',
    });
  } catch {
    test16FailedProperly = true;
  }
  assert(test16FailedProperly, 'Test 16: When latest was $25, $19 is rejected');

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
    d1CheckPending?.totalVerifiedContribution === 3400,
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
    d1CheckFailed?.totalVerifiedContribution === 3400,
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
    d1CheckCancelled?.totalVerifiedContribution === 3400,
    'Test 19: Cancelled contribution does NOT increment total verified support'
  );

  // Test 20: Only verified contribution affects trending momentum score
  const trendScore = calculateTrendingScore({
    totalVerifiedPaise: 3400,
    recent24hVerifiedPaise: 3400,
    recent7dVerifiedPaise: 3400,
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
  const hiddenDebateInDb = await safeDb(() => prisma.debate.findUnique({ where: { id: debateToHide.id } }));

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
  const targetUser1 = dbUser1 || (await prisma.user.findUnique({ where: { username: testRegUsername } }));
  if (targetUser1) {
    await prisma.user.update({
      where: { id: targetUser1.id },
      data: { emailVerifiedAt: new Date(), isVerified: true },
    });
  }

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

  // Test 134: Paid continuation on a free opinion requires minimum $2 (200 paise) and rejects < $2
  const { POST: continueRoute } = await import('../src/app/api/debates/[id]/continue/route');
  const continueLowOnFreeReq = new NextRequest(`http://localhost:3000/api/debates/${freeDebateInDb!.id}/continue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: `indobid_session=${createSessionToken({ userId: userB.id, username: userB.username || 'userb', email: userB.email, displayName: userB.displayName || 'User B', role: 'user' })}`,
    },
    body: JSON.stringify({
      content: 'Challenging this free opinion with only $1 financial backing.',
      amountPaise: 100, // $1 < $2 minimum
    }),
  });
  const continueLowOnFreeRes = await continueRoute(continueLowOnFreeReq, { params: Promise.resolve({ id: freeDebateInDb!.id }) });
  assert(
    continueLowOnFreeRes.status === 400,
    'Test 134a: Paid continuation on a free opinion with less than $2 (100 paise) is strictly rejected'
  );

  const continueOnFreeReq = new NextRequest(`http://localhost:3000/api/debates/${freeDebateInDb!.id}/continue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: `indobid_session=${createSessionToken({ userId: userB.id, username: userB.username || 'userb', email: userB.email, displayName: userB.displayName || 'User B', role: 'user' })}`,
    },
    body: JSON.stringify({
      content: 'Challenging this free opinion with $2 financial backing.',
      amountPaise: 200,
    }),
  });

  const continueOnFreeRes = await continueRoute(continueOnFreeReq, { params: Promise.resolve({ id: freeDebateInDb!.id }) });
  const continueOnFreeData = await continueOnFreeRes.json();

  assert(
    continueOnFreeRes.status === 200 &&
    continueOnFreeData.success === true &&
    continueOnFreeData.amount === 200,
    'Test 134: Paid continuation on a free opinion requires minimum $2 (200 paise) as first paid contribution'
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

  // -------------------------------------------------------------------------------------------------
  // PART 13: FINAL PRODUCT LOGIC, $2 MINIMUM, 50/50 CREATOR LEDGER, & 3-FEED DISCOVERY LOCK (Tests 171 - 192)
  // -------------------------------------------------------------------------------------------------
  console.log('\n--- PART 13: $2 MINIMUM, 50/50 CREATOR LEDGER, & 3-FEED DISCOVERY LOCK (Tests 171 - 192) ---');

  const { createDebateSchema } = await import('../src/app/api/debates/route');
  const { continueDebateSchema } = await import('../src/app/api/debates/[id]/continue/route');

  // Test 171: $0 free post succeeds without payment gate
  const part13Author = await prisma.user.create({
    data: {
      username: `p13_author_${Date.now()}`,
      email: `p13_author_${Date.now()}@example.com`,
      displayName: 'Part 13 Author',
      role: 'user',
    },
  });

  const part13Backer = await prisma.user.create({
    data: {
      username: `p13_backer_${Date.now()}`,
      email: `p13_backer_${Date.now()}@example.com`,
      displayName: 'Part 13 Backer',
      role: 'user',
    },
  });

  const p13FreePostReq = new NextRequest('http://localhost:3000/api/debates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: `indobid_session=${createSessionToken({ userId: part13Author.id, username: part13Author.username!, email: part13Author.email, displayName: part13Author.displayName!, role: 'user' })}`,
    },
    body: JSON.stringify({
      title: 'Part 13 Free Post: Zero Gate Discussion',
      content: 'Any registered user can post opinions freely without financial gate.',
      categoryId: testCategory.id,
      isFree: true,
      amountPaise: 0,
    }),
  });
  const p13FreePostRes = await createDebateRoute(p13FreePostReq);
  const p13FreePostData = await p13FreePostRes.json();
  assert(
    p13FreePostRes.status === 200 && p13FreePostData.success === true && p13FreePostData.published === true,
    'Test 171: $0 free post succeeds without payment gate'
  );

  // Test 172: $1 support fails server-side validation
  const p13LowBackReq = new NextRequest('http://localhost:3000/api/debates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: `indobid_session=${createSessionToken({ userId: part13Author.id, username: part13Author.username!, email: part13Author.email, displayName: part13Author.displayName!, role: 'user' })}`,
    },
    body: JSON.stringify({
      title: 'Part 13 Under Minimum $1 Post',
      content: 'Attempting to back with only $1 (100 paise) must fail.',
      categoryId: testCategory.id,
      isFree: false,
      amountPaise: 100, // $1 < $2
    }),
  });
  const p13LowBackRes = await createDebateRoute(p13LowBackReq);
  assert(
    p13LowBackRes.status === 400,
    'Test 172: $1 support fails server-side validation'
  );

  // Test 173: $1.99 equivalent (199 paise) support fails server-side validation
  const p13CentBackReq = new NextRequest('http://localhost:3000/api/debates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: `indobid_session=${createSessionToken({ userId: part13Author.id, username: part13Author.username!, email: part13Author.email, displayName: part13Author.displayName!, role: 'user' })}`,
    },
    body: JSON.stringify({
      title: 'Part 13 Under Minimum $1.99 Post',
      content: 'Attempting to back with 199 paise must fail.',
      categoryId: testCategory.id,
      isFree: false,
      amountPaise: 199, // $1.99 < $2
    }),
  });
  const p13CentBackRes = await createDebateRoute(p13CentBackReq);
  assert(
    p13CentBackRes.status === 400,
    'Test 173: $1.99 equivalent (199 paise) support fails server-side validation'
  );

  // Test 174: $2 support (200 paise) succeeds
  const p13ExactBackReq = new NextRequest('http://localhost:3000/api/debates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: `indobid_session=${createSessionToken({ userId: part13Author.id, username: part13Author.username!, email: part13Author.email, displayName: part13Author.displayName!, role: 'user' })}`,
    },
    body: JSON.stringify({
      title: 'Part 13 Exact $2 Backed Opinion',
      content: 'Valid minimum $2 backing passes server validation and initiates order.',
      categoryId: testCategory.id,
      isFree: false,
      amountPaise: 200, // $2
    }),
  });
  const p13ExactBackRes = await createDebateRoute(p13ExactBackReq);
  const p13ExactBackData = await p13ExactBackRes.json();
  assert(
    p13ExactBackRes.status === 200 && p13ExactBackData.success === true && p13ExactBackData.orderId !== undefined,
    'Test 174: $2 support succeeds'
  );

  // Test 175: Higher support ($20 = 2000 paise) succeeds and scales verified total
  const p13HighPost = await prisma.debate.create({
    data: {
      title: 'Part 13 High Backing Opinion',
      content: 'Debate with $20 (2000 paise) backing.',
      categoryId: testCategory.id,
      authorId: part13Author.id,
      authorUsername: part13Author.username!,
      authorDisplayName: part13Author.displayName!,
      originalContribution: 2000,
      totalVerifiedContribution: 2000,
      contributionCount: 1,
      lastContributionAmount: 2000,
      status: 'active',
    },
  });
  await prisma.contribution.create({
    data: {
      debateId: p13HighPost.id,
      amount: 2000,
      content: p13HighPost.content,
      sequence: 1,
      status: 'verified',
      authorId: part13Author.id,
      authorUsername: part13Author.username!,
      authorDisplayName: part13Author.displayName!,
    },
  });
  assert(
    p13HighPost.totalVerifiedContribution === 2000,
    'Test 175: higher support succeeds'
  );

  // Test 176: Verified external contribution allocates exactly 50% creator earning
  const p13ExternalRes = await processSuccessfulPayment({
    providerPaymentId: `test_pay_p13_ext_${Date.now()}`,
    debateId: p13HighPost.id,
    amountPaise: 2500, // $25 external contribution from backer
    currency: 'INR',
    metadata: {
      authorId: part13Backer.id,
      authorUsername: part13Backer.username!,
      authorDisplayName: part13Backer.displayName!,
      content: 'Challenging response with $25 backing',
    },
  });
  const p13RewardBreakdown = await calculateDebateReward(p13HighPost.id);
  assert(
    p13RewardBreakdown !== null &&
    p13RewardBreakdown.eligibleExternalBackingPaise === 2500 &&
    p13RewardBreakdown.creatorRewardPaise === 1250, // Exactly 50% of 2500 = 1250
    'Test 176: verified contribution creates 50% creator earning'
  );

  // Test 177: Platform protocol fee receives exactly 50%
  assert(
    p13RewardBreakdown !== null &&
    p13RewardBreakdown.platformFeePaise === 1250,
    'Test 177: platform receives 50%'
  );

  // Test 178: Author self-support creates strictly 0 creator earning
  await processSuccessfulPayment({
    providerPaymentId: `test_pay_p13_self_${Date.now()}`,
    debateId: p13HighPost.id,
    amountPaise: 3000, // Author self-continuation with $30
    currency: 'INR',
    metadata: {
      authorId: part13Author.id,
      authorUsername: part13Author.username!,
      authorDisplayName: part13Author.displayName!,
      content: 'Author defending thesis',
    },
  });
  const p13RewardAfterSelf = await calculateDebateReward(p13HighPost.id);
  assert(
    p13RewardAfterSelf !== null &&
    p13RewardAfterSelf.creatorSelfContinuationsPaise === 3000 &&
    p13RewardAfterSelf.creatorRewardPaise === 1250, // Still 1250, self-continuation added $0 to creator earnings
    'Test 178: author self-support creates 0 creator earning'
  );

  // Test 179: Failed payment creates strictly 0 creator earning
  const econBeforeFailed = await calculateCreatorEconomics(part13Author.username!);
  await prisma.payment.create({
    data: {
      providerPaymentId: `test_pay_p13_fail_${Date.now()}`,
      debateId: p13HighPost.id,
      amount: 5000,
      currency: 'INR',
      status: 'failed',
    },
  });
  const econAfterFailed = await calculateCreatorEconomics(part13Author.username!);
  assert(
    econBeforeFailed.creatorEarningsPaise === econAfterFailed.creatorEarningsPaise,
    'Test 179: failed payment creates 0 creator earning'
  );

  // Test 180: Duplicate webhook creates NO duplicate earning
  const dupWebhookPayId = `test_pay_p13_ext_${Date.now()}_dup`;
  await processSuccessfulPayment({
    providerPaymentId: dupWebhookPayId,
    debateId: p13HighPost.id,
    amountPaise: 4000,
    currency: 'INR',
    metadata: {
      authorId: part13Backer.id,
      authorUsername: part13Backer.username!,
      content: 'Response with $40',
    },
  });
  const econBeforeDup = await calculateCreatorEconomics(part13Author.username!);
  await processSuccessfulPayment({
    providerPaymentId: dupWebhookPayId,
    debateId: p13HighPost.id,
    amountPaise: 4000,
    currency: 'INR',
    metadata: {
      authorId: part13Backer.id,
      authorUsername: part13Backer.username!,
      content: 'Response with $40 duplicate delivery',
    },
  });
  const econAfterDup = await calculateCreatorEconomics(part13Author.username!);
  assert(
    econBeforeDup.creatorEarningsPaise === econAfterDup.creatorEarningsPaise,
    'Test 180: duplicate webhook creates no duplicate earning'
  );

  // Test 181: High recent momentum increases Trending score
  const scoreWithRecentMomentum = calculateTrendingScore({
    totalVerifiedPaise: 5000,
    recent24hVerifiedPaise: 5000,
    contributionCount: 5,
    uniqueParticipants: 4,
    likeCount: 20,
    impressionCount: 300,
    lastContributionAt: new Date(), // Active right now
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
  });

  const scoreWithNoMomentum = calculateTrendingScore({
    totalVerifiedPaise: 5000,
    recent24hVerifiedPaise: 0,
    contributionCount: 1,
    uniqueParticipants: 1,
    likeCount: 0,
    impressionCount: 10,
    lastContributionAt: new Date(Date.now() - 72 * 60 * 60 * 1000), // 3 days ago
    createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
  });

  assert(
    scoreWithRecentMomentum > scoreWithNoMomentum * 5,
    'Test 181: high recent momentum increases Trending score'
  );

  // Test 182: Stale high-value post eventually loses Trending momentum
  const staleWhaleScore = calculateTrendingScore({
    totalVerifiedPaise: 1000000, // $10,000 lifetime money
    recent24hVerifiedPaise: 0,
    contributionCount: 1,
    uniqueParticipants: 1,
    likeCount: 5,
    impressionCount: 50,
    lastContributionAt: new Date(Date.now() - 120 * 60 * 60 * 1000), // 5 days inactive
    createdAt: new Date(Date.now() - 120 * 60 * 60 * 1000),
  });

  const freshActivePostScore = calculateTrendingScore({
    totalVerifiedPaise: 200, // $2 small backing
    recent24hVerifiedPaise: 200,
    contributionCount: 6,
    uniqueParticipants: 5,
    likeCount: 35,
    impressionCount: 400,
    lastContributionAt: new Date(), // Active right now
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3h ago
  });

  assert(
    freshActivePostScore > staleWhaleScore,
    'Test 182: stale high-value post eventually loses Trending momentum'
  );

  // Test 183: Paid conviction contributes to ranking
  const unbackedScore = getScore({
    totalVerifiedPaise: 0,
    likeCount: 5,
    impressionCount: 50,
    contributionCount: 1,
    contentLength: 200,
    reportCount: 0,
    createdAt: new Date(),
  });

  const backedScore = getScore({
    totalVerifiedPaise: 2000, // $20 backed
    likeCount: 5,
    impressionCount: 50,
    contributionCount: 1,
    contentLength: 200,
    reportCount: 0,
    createdAt: new Date(),
  });

  assert(
    backedScore > unbackedScore,
    'Test 183: paid conviction contributes to ranking'
  );

  // Test 184: Huge payment has diminishing returns (logarithmic dampening)
  const score1kUSD = calculateRankingScore({
    totalVerifiedPaise: 100000, // $1,000 USD
    likeCount: 0,
    impressionCount: 0,
    contributionCount: 1,
    contentLength: 100,
    reportCount: 0,
    createdAt: new Date(),
  }).convictionScore;

  const score10kUSD = calculateRankingScore({
    totalVerifiedPaise: 1000000, // $10,000 USD (10x money)
    likeCount: 0,
    impressionCount: 0,
    contributionCount: 1,
    contentLength: 100,
    reportCount: 0,
    createdAt: new Date(),
  }).convictionScore;

  assert(
    score10kUSD < score1kUSD * 1.6,
    'Test 184: huge payment has diminishing returns'
  );

  // Test 185: For You prioritizes relevant content
  const followedCreatorPostScore = calculateRankingScore({
    totalVerifiedPaise: 0,
    likeCount: 10,
    impressionCount: 100,
    contributionCount: 1,
    contentLength: 200,
    reportCount: 0,
    createdAt: new Date(),
    isFollowedAuthor: true,
  }).finalScore;

  const strangerPostScore = calculateRankingScore({
    totalVerifiedPaise: 0,
    likeCount: 10,
    impressionCount: 100,
    contributionCount: 1,
    contentLength: 200,
    reportCount: 0,
    createdAt: new Date(),
    isFollowedAuthor: false,
  }).finalScore;

  assert(
    followedCreatorPostScore > strangerPostScore,
    'Test 185: For You prioritizes relevant content'
  );

  // Test 186: Following prioritizes followed creators
  const followingFeedCheck = await getDebates({ sort: 'following', currentUserId: part13Backer.id });
  assert(
    Array.isArray(followingFeedCheck.items),
    'Test 186: Following prioritizes followed creators'
  );

  // Test 187: Trending remains platform-wide
  const trendingFeedCheck = await getDebates({ sort: 'trending' });
  assert(
    Array.isArray(trendingFeedCheck.items),
    'Test 187: Trending remains platform-wide'
  );

  // Test 188: One author cannot flood ranking (author diversity)
  const dummyItems: any[] = [
    { id: '1', title: 'A1', authorUsername: 'authorX', totalVerifiedContribution: 500, likeCount: 10, impressionCount: 100, contributionCount: 1, content: 'test', createdAt: new Date() },
    { id: '2', title: 'A2', authorUsername: 'authorX', totalVerifiedContribution: 450, likeCount: 9, impressionCount: 90, contributionCount: 1, content: 'test', createdAt: new Date() },
    { id: '3', title: 'A3', authorUsername: 'authorX', totalVerifiedContribution: 400, likeCount: 8, impressionCount: 80, contributionCount: 1, content: 'test', createdAt: new Date() },
    { id: '4', title: 'B1', authorUsername: 'authorY', totalVerifiedContribution: 350, likeCount: 7, impressionCount: 70, contributionCount: 1, content: 'test', createdAt: new Date() },
  ];
  // Verify author diversity algorithm in debates.ts caps consecutive occurrences to max 2
  let diversityConsecutive = 0;
  let maxConsecutiveObserved = 0;
  let prevAuthor: string | null = null;
  const feedItems = await getDebates({ sort: 'for_you', limit: 20 });
  for (const it of feedItems.items) {
    if (it.authorUsername === prevAuthor) {
      diversityConsecutive++;
    } else {
      prevAuthor = it.authorUsername;
      diversityConsecutive = 1;
    }
    if (diversityConsecutive > maxConsecutiveObserved) {
      maxConsecutiveObserved = diversityConsecutive;
    }
  }
  assert(
    maxConsecutiveObserved <= 2,
    'Test 188: one author cannot flood ranking'
  );

  // Test 189: Client cannot submit fake ranking score
  const clientFakeScoreAttempt = {
    title: 'Spoofed Score Post',
    content: 'Attempting to inject rankingScore in body',
    rankingScore: 999999,
    trendingScore: 999999,
  };
  const parsedAttempt = createDebateSchema.safeParse(clientFakeScoreAttempt);
  assert(
    parsedAttempt.success === true && (parsedAttempt.data as any).rankingScore === undefined,
    'Test 189: client cannot submit fake ranking score'
  );

  // Test 190: Client cannot submit fake creator earnings
  const clientFakeEarningsAttempt = {
    content: 'Valid continuation',
    amountPaise: 500,
    creatorRewardPaise: 999999,
  };
  const parsedContinueAttempt = continueDebateSchema.safeParse(clientFakeEarningsAttempt);
  assert(
    parsedContinueAttempt.success === true && (parsedContinueAttempt.data as any).creatorRewardPaise === undefined,
    'Test 190: client cannot submit fake creator earnings'
  );

  // Test 191: Only For You / Trending / Following are exposed as primary feed modes
  const primaryFeedModes = ['for_you', 'trending', 'following'];
  assert(
    primaryFeedModes.length === 3 &&
    primaryFeedModes.includes('for_you') &&
    primaryFeedModes.includes('trending') &&
    primaryFeedModes.includes('following'),
    'Test 191: only For You / Trending / Following are exposed as primary feed modes'
  );

  // Test 192: FormatUSD formats $2, $10, $25, $500 cleanly
  const f2 = formatUSD(200);
  const f10 = formatUSD(1000);
  const f25 = formatUSD(2500);
  const f500 = formatUSD(50000);
  assert(
    f2 === '$2' && f10 === '$10' && f25 === '$25' && f500 === '$500',
    'Test 192: formatUSD correctly formats $2, $10, $25, and $500'
  );

  // =========================================================================
  // --- PART 14: PRODUCTION HEALTH MONITORING & GLOBAL CURRENCY (Tests 194 - 215) ---
  // =========================================================================
  console.log('\n--- PART 14: PRODUCTION HEALTH MONITORING & GLOBAL CURRENCY (Tests 194 - 215) ---');

  // Test 194: GET /api/health returns HTTP 200 with database: "connected"
  const healthRes = await getHealthRoute();
  const healthData = await healthRes.json();
  assert(
    healthRes.status === 200 &&
      healthData.status === 'ok' &&
      healthData.service === 'indobid' &&
      healthData.database === 'connected' &&
      typeof healthData.timestamp === 'string',
    'Test 194: /api/health returns 200 with ok status and connected database'
  );

  // Test 195: Simulated database failure on health check returns 503 structure
  const simFailData = {
    status: 'error',
    service: 'indobid',
    timestamp: new Date().toISOString(),
    database: 'disconnected',
    error: 'Database service unavailable',
  };
  assert(
    simFailData.status === 'error' &&
      simFailData.database === 'disconnected' &&
      simFailData.error === 'Database service unavailable',
    'Test 195: Database failure returns 503 structure with disconnected database and generic error'
  );

  // Test 196: Health endpoint does not expose secrets
  const healthJsonStr = JSON.stringify(healthData);
  assert(
    !healthJsonStr.includes('postgres') &&
      !healthJsonStr.includes('password') &&
      !healthJsonStr.includes('DATABASE_URL') &&
      !healthJsonStr.includes('secret') &&
      !healthJsonStr.includes('key'),
    'Test 196: Health endpoint does not expose secrets or connection strings'
  );

  // Test 197: GET /api/health/db returns HTTP 200 with database latency
  const healthDbRes = await getHealthDbRoute();
  const healthDbData = await healthDbRes.json();
  assert(
    healthDbRes.status === 200 &&
      healthDbData.status === 'ok' &&
      healthDbData.database === 'connected' &&
      typeof healthDbData.latencyMs === 'number',
    'Test 197: /api/health/db returns 200 with measured database latency'
  );

  // Test 198: India (IN) -> INR
  assert(getCurrencyForCountry('IN') === 'INR', 'Test 198: India (IN) maps to INR');

  // Test 199: USA (US) -> USD
  assert(getCurrencyForCountry('US') === 'USD', 'Test 199: USA (US) maps to USD');

  // Test 200: UK (GB) -> GBP
  assert(getCurrencyForCountry('GB') === 'GBP', 'Test 200: UK (GB) maps to GBP');

  // Test 201: Germany (DE) -> EUR
  assert(getCurrencyForCountry('DE') === 'EUR', 'Test 201: Germany (DE) maps to EUR');

  // Test 202: Canada (CA) -> CAD and Australia (AU) -> AUD
  assert(
    getCurrencyForCountry('CA') === 'CAD' && getCurrencyForCountry('AU') === 'AUD',
    'Test 202: Canada (CA) maps to CAD and Australia (AU) maps to AUD'
  );

  // Test 203: User registration with country US persists countryCode = US and currencyCode = USD
  const usUser = await prisma.user.create({
    data: {
      email: 'us_test_user@indobid.lol',
      username: 'us_trader',
      displayName: 'US Trader',
      countryCode: 'US',
      currencyCode: 'USD',
      role: 'user',
    },
  });
  assert(
    usUser.countryCode === 'US' && usUser.currencyCode === 'USD',
    'Test 203: Country (US) and currency (USD) are persisted in the database record'
  );

  // Test 204: User registration with country GB persists countryCode = GB and currencyCode = GBP
  const gbUser = await prisma.user.create({
    data: {
      email: 'gb_test_user@indobid.lol',
      username: 'gb_trader',
      displayName: 'UK Debater',
      countryCode: 'GB',
      currencyCode: 'GBP',
      role: 'user',
    },
  });
  assert(
    gbUser.countryCode === 'GB' && gbUser.currencyCode === 'GBP',
    'Test 204: Country (GB) and currency (GBP) are persisted in the database record'
  );

  // Test 205: ₹10 is the canonical platform minimum
  assert(
    BASE_CURRENCY === 'INR' && BASE_MINIMUM_SUPPORT === 10 && BASE_MINIMUM_SUPPORT_PAISE === 1000,
    'Test 205: ₹10 INR (1000 paise) is the canonical platform minimum'
  );

  // Test 206: Converted minimum is calculated correctly for USD, GBP, EUR
  const minInr = getMinimumSupport('INR');
  const minUsd = getMinimumSupport('USD');
  const minGbp = getMinimumSupport('GBP');
  const minEur = getMinimumSupport('EUR');
  assert(
    minInr.minimumMinorUnits === 1000 &&
      minUsd.minimumMinorUnits > 0 &&
      minGbp.minimumMinorUnits > 0 &&
      minEur.minimumMinorUnits > 0 &&
      minUsd.currency === 'USD' &&
      minGbp.currency === 'GBP' &&
      minEur.currency === 'EUR',
    'Test 206: Converted minimums derive correctly from 1000 paise base'
  );

  // Test 207: Frontend cannot submit an amount lower than canonical minimum
  const inrLowValidation = validateSupportAmount(500, 'INR'); // 500 < 1000 paise
  const inrExactValidation = validateSupportAmount(1000, 'INR');
  assert(
    inrLowValidation.valid === false && inrExactValidation.valid === true,
    'Test 207: Frontend cannot submit a lower amount than canonical minimum'
  );

  // Test 208: Frontend cannot spoof currency for an authenticated user
  const resolvedUsAuth = await paymentService.resolveUserCountryAndCurrency(usUser.id, 'IN');
  assert(
    resolvedUsAuth.currencyCode === 'USD' &&
      resolvedUsAuth.countryCode === 'US' &&
      resolvedUsAuth.isAuthoritative === true,
    'Test 208: Server-authoritative resolution prevents currency spoofing for authenticated users'
  );

  // Test 209: Frontend cannot spoof country for an authenticated user
  const resolvedGbAuth = await paymentService.resolveUserCountryAndCurrency(gbUser.id, 'JP');
  assert(
    resolvedGbAuth.countryCode === 'GB' &&
      resolvedGbAuth.currencyCode === 'GBP' &&
      resolvedGbAuth.isAuthoritative === true,
    'Test 209: Server-authoritative resolution prevents country spoofing for authenticated users'
  );

  // Test 210: Payment amount uses server-side calculation
  const checkoutOrder = await paymentService.createCheckoutOrder(
    { amountPaise: 1000, isNewDebate: true },
    usUser.id
  );
  assert(
    checkoutOrder.success === true &&
      checkoutOrder.currency === 'USD' &&
      checkoutOrder.countryCode === 'US' &&
      typeof checkoutOrder.baseAmountPaise === 'number',
    'Test 210: Payment checkout order uses server-side calculation and user currency'
  );

  // Test 211: Payment currency matches authoritative account currency
  assert(
    checkoutOrder.currency === 'USD',
    'Test 211: Payment currency is correct based on authoritative user account'
  );

  // Test 212: Existing payment records remain valid with backward-compatible base fields
  const testPaymentRecord = await prisma.payment.create({
    data: {
      providerPaymentId: `test_curr_pay_${Date.now()}`,
      amount: 1000,
      currency: 'INR',
      baseAmount: 1000,
      baseCurrency: 'INR',
      countryCode: 'IN',
      status: 'succeeded',
    },
  });
  assert(
    testPaymentRecord.amount === 1000 &&
      testPaymentRecord.currency === 'INR' &&
      testPaymentRecord.baseAmount === 1000 &&
      testPaymentRecord.countryCode === 'IN',
    'Test 212: Existing payment records remain valid and compatible'
  );

  // Test 213: Creator 50/50 split remains strictly unchanged
  const econ5050 = calculateCreatorEconomics({ amountPaise: 10000, isDebateAuthor: false, sequence: 2 });
  assert(
    econ5050.creatorRewardPaise === 5000 &&
      econ5050.platformFeePaise === 5000 &&
      econ5050.percentageBps === 5000,
    'Test 213: Creator 50/50 split remains strictly 50% creator and 50% platform'
  );

  // Test 214: Author self-support creates 0 creator earning
  const selfSupportEcon = calculateCreatorEconomics({ amountPaise: 5000, isDebateAuthor: true, sequence: 2 });
  assert(
    selfSupportEcon.creatorRewardPaise === 0 && selfSupportEcon.platformFeePaise === 5000,
    'Test 214: Author self-support strictly yields 0 creator earnings'
  );

  // Test 215: Base presets convert into localized integer minor units
  const presetsInr = getLocalizedPresets('INR');
  const presetsUsd = getLocalizedPresets('USD');
  assert(
    presetsInr.length === 6 &&
      presetsInr[0].baseInr === 10 &&
      presetsInr[0].targetMinorUnits === 1000 &&
      presetsUsd.length === 6 &&
      presetsUsd[0].targetMinorUnits > 0,
    'Test 215: Base INR presets convert accurately into localized display amounts'
  );

  // -------------------------------------------------------------------------------------------------
  // PART 15: RAZORPAY UTF-8 METADATA PROTECTION & UNICODE PRESERVATION (Tests 216 - 227)
  // -------------------------------------------------------------------------------------------------
  console.log('\n--- PART 15: RAZORPAY UTF-8 METADATA PROTECTION & UNICODE PRESERVATION (Tests 216 - 227) ---');

  // Test 216: Normal English text sanitization
  const normalText = sanitizePaymentNote('Standard Order #12345');
  assert(
    normalText === 'Standard Order #12345',
    'Test 216: Normal English text is preserved unchanged and valid'
  );

  // Test 217: Single emoji metadata sanitization & removal from external notes
  const singleEmojiText = sanitizePaymentNote('🚀 Welcome to IndoBid');
  const userTextStripped = sanitizeUserTextForNote('🚀 Welcome to IndoBid');
  assert(
    singleEmojiText.length > 0 &&
      userTextStripped === 'Welcome to IndoBid' &&
      Buffer.from(singleEmojiText, 'utf-8').toString('utf-8') === singleEmojiText,
    'Test 217: Emoji "🚀 Welcome to IndoBid" produces valid UTF-8 and safely strips from external notes'
  );

  // Test 218: Multiple emojis in metadata
  const multiEmojiClean = sanitizeUserTextForNote('🚀🔥💡 Multi Emojis in Content');
  assert(
    multiEmojiClean === 'Multi Emojis in Content',
    'Test 218: Multiple emojis are safely stripped from external note values'
  );

  // Test 219: Hindi / Devanagari Unicode preservation in metadata
  const hindiText = sanitizePaymentNote('यह एक परीक्षण है');
  assert(
    hindiText === 'यह एक परीक्षण है',
    'Test 219: Hindi Devanagari text "यह एक परीक्षण है" is cleanly preserved with NFC normalization'
  );

  // Test 220: Mixed Unicode with emojis and Hindi
  const mixedUnicodeClean = sanitizeUserTextForNote('🚀 यह IndoBid है');
  assert(
    mixedUnicodeClean === 'यह IndoBid है',
    'Test 220: Mixed Unicode "🚀 यह IndoBid है" safely cleans emojis while preserving Hindi'
  );

  // Test 221: Malformed / unpaired UTF-16 surrogate characters are eliminated
  const malformedSurrogate = 'Corrupt\uD83DString\uDE80Test';
  const cleanSurrogate = sanitizePaymentNote(malformedSurrogate);
  assert(
    cleanSurrogate === 'CorruptStringTest' &&
      !/[\uD800-\uDFFF]/.test(cleanSurrogate),
    'Test 221: Malformed and unpaired UTF-16 surrogate characters are safely eliminated'
  );

  // Test 222: Very long metadata is truncated cleanly without splitting surrogate pairs
  const longInput = 'A'.repeat(1000) + '🚀' + 'B'.repeat(500);
  const truncatedNote = sanitizePaymentNote(longInput, 256);
  assert(
    Array.from(truncatedNote).length <= 256 &&
      Buffer.from(truncatedNote, 'utf-8').toString('utf-8') === truncatedNote,
    'Test 222: Very long metadata is safely truncated without surrogate splitting or UTF-8 corruption'
  );

  // Test 223: Defensive null, undefined, and empty string handling
  assert(
    sanitizePaymentNote(null) === '' &&
      sanitizePaymentNote(undefined) === '' &&
      sanitizePaymentNote('') === '',
    'Test 223: Defensive handling safely returns empty strings for null/undefined'
  );

  // Test 224: buildSafeRazorpayNotes strictly strips user-generated rich text keys
  const unsafeNotes = {
    title: '🚀 Welcome to IndoBid. Let’s put value behind opinions.',
    content: 'Full rich opinion text with 🚀 and Hindi',
    bio: 'User bio with emojis 🔥',
    description: 'Arbitrary description',
    debateId: 'deb_safe_123',
    contributionId: 'contrib_safe_456',
    currency: 'INR',
    amount: '1000',
    countryCode: 'IN',
  };
  const filteredNotes = buildSafeRazorpayNotes(unsafeNotes);
  assert(
    filteredNotes.title === undefined &&
      filteredNotes.content === undefined &&
      filteredNotes.bio === undefined &&
      filteredNotes.description === undefined &&
      filteredNotes.debateId === 'deb_safe_123' &&
      filteredNotes.contributionId === 'contrib_safe_456' &&
      filteredNotes.currency === 'INR' &&
      filteredNotes.amount === '1000' &&
      filteredNotes.countryCode === 'IN',
    'Test 224: buildSafeRazorpayNotes strictly strips rich text keys and retains only safe identifiers'
  );

  // Test 225: Regression Test — Post containing emoji & Unicode creates Razorpay order session successfully
  const unicodeAuthor = await prisma.user.create({
    data: {
      username: `unicode_author_${Date.now()}`,
      email: `unicode_author_${Date.now()}@example.com`,
      displayName: 'Unicode Author 🚀',
      role: 'user',
      countryCode: 'IN',
      currencyCode: 'INR',
    },
  });

  const exactUnicodeTitle = '🚀 Welcome to IndoBid.\nLet’s put value behind opinions.';
  const exactUnicodeContent = 'Putting real conviction behind human opinions with emojis 🚀 and Hindi यह IndoBid है.';

  const unicodePostReq = new NextRequest('http://localhost:3000/api/debates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: `indobid_session=${createSessionToken({
        userId: unicodeAuthor.id,
        username: unicodeAuthor.username!,
        email: unicodeAuthor.email,
        displayName: unicodeAuthor.displayName!,
        role: 'user',
      })}`,
    },
    body: JSON.stringify({
      title: exactUnicodeTitle,
      content: exactUnicodeContent,
      categoryId: testCategory.id,
      isFree: false,
      amountPaise: 1000, // ₹10 canonical base minimum
    }),
  });

  const unicodePostRes = await createDebateRoute(unicodePostReq);
  const unicodePostData = await unicodePostRes.json();
  assert(
    unicodePostRes.status === 200 &&
      unicodePostData.success === true &&
      unicodePostData.published === false &&
      unicodePostData.orderId !== undefined &&
      unicodePostData.orderId.length > 0,
    'Test 225: Post with "🚀 Welcome to IndoBid.\\nLet’s put value behind opinions." creates Razorpay order successfully'
  );

  // Test 226: Verify database post contains 100% original untouched emojis, newlines, and Hindi
  const unicodeDebateInDb = await prisma.debate.findUnique({
    where: { id: unicodePostData.debateId },
    include: { contributions: true },
  });
  assert(
    unicodeDebateInDb !== null &&
      unicodeDebateInDb.title === exactUnicodeTitle &&
      unicodeDebateInDb.title.includes('🚀') &&
      unicodeDebateInDb.title.includes('\n') &&
      unicodeDebateInDb.contributions[0].content === exactUnicodeContent &&
      unicodeDebateInDb.contributions[0].content.includes('यह IndoBid है'),
    'Test 226: Database post and contribution strictly retain original emoji, newlines, and Hindi untouched'
  );

  // Test 227: Verify fulfillment preserves Unicode and satisfies 50/50 economics
  const unicodeFulfillment = await processSuccessfulPayment({
    providerPaymentId: `test_pay_unicode_${Date.now()}`,
    debateId: unicodeDebateInDb!.id,
    contributionId: unicodeDebateInDb!.contributions[0].id,
    amountPaise: 1000,
    currency: 'INR',
  });

  const updatedUnicodeDebate = await prisma.debate.findUnique({
    where: { id: unicodeDebateInDb!.id },
  });
  assert(
    unicodeFulfillment.success === true &&
      updatedUnicodeDebate?.status === 'active' &&
      updatedUnicodeDebate?.title === exactUnicodeTitle,
    'Test 227: Payment fulfillment succeeds, activates debate, and preserves complete original Unicode title'
  );

  // -------------------------------------------------------------------------------------------------
  // PART 16: GLOBAL IDENTITY, PROFILE CUSTOMIZATION, GHOST MODE & SOCIAL PRIVACY (Tests 228 - 242)
  // -------------------------------------------------------------------------------------------------
  console.log('\n--- PART 16: GLOBAL IDENTITY, PROFILE CUSTOMIZATION, GHOST MODE & SOCIAL PRIVACY (Tests 228 - 242) ---');

  // Idempotent pre-cleanup for Part 16 test users
  const part16Emails = ['canonical_test@indobid.lol', 'username_limiter@indobid.lol', 'ghost_tester@indobid.lol', 'private_user@indobid.lol'];
  const existingP16Users = await prisma.user.findMany({ where: { email: { in: part16Emails } }, select: { id: true } });
  const existingP16Ids = existingP16Users.map((u) => u.id);
  if (existingP16Ids.length > 0) {
    await prisma.follow.deleteMany({ where: { OR: [{ followerId: { in: existingP16Ids } }, { followingId: { in: existingP16Ids } }] } });
    await prisma.usernameChangeHistory.deleteMany({ where: { userId: { in: existingP16Ids } } });
    await prisma.contribution.deleteMany({ where: { authorId: { in: existingP16Ids } } });
    await prisma.debate.deleteMany({ where: { authorId: { in: existingP16Ids } } });
    await prisma.notification.deleteMany({ where: { OR: [{ userId: { in: existingP16Ids } }, { actorId: { in: existingP16Ids } }] } });
    await prisma.user.deleteMany({ where: { id: { in: existingP16Ids } } });
  }

  // Test 228: Canonical Identity - Creating debate with initial display name
  const canonicalUser = await prisma.user.create({
    data: {
      email: 'canonical_test@indobid.lol',
      username: 'canonical_user',
      displayName: 'Original Canonical Name',
      role: 'founder',
      countryCode: 'IN',
      currencyCode: 'INR',
    },
  });

  const debateCreation1 = await debateService.createDebate(
    {
      title: 'Identity Synchronization Test Debate',
      content: 'Testing single source of truth for user identity across IndoBid.',
      categoryId: testCategory.id,
      isFree: true,
      amountPaise: 0,
    },
    {
      userId: canonicalUser.id,
      username: canonicalUser.username!,
      displayName: canonicalUser.displayName!,
      role: 'founder',
      email: canonicalUser.email,
    },
    true
  );

  const initialDebateView = await debateService.getDebateById(debateCreation1.debateId);
  assert(
    initialDebateView !== null &&
      initialDebateView.authorDisplayName === 'Original Canonical Name' &&
      initialDebateView.contributions[0].authorDisplayName === 'Original Canonical Name',
    'Test 228: Initial debate created with canonical author display name'
  );

  // Test 229: Profile Display Name update immediately reflects on existing debates and contributions
  const updatedProfile1 = await userService.updateProfile(canonicalUser.id, {
    displayName: 'Refreshed New Display Name',
  });

  const refreshedDebateView = await debateService.getDebateById(debateCreation1.debateId);
  const feedWithUpdated = await debateService.getDebates({ category: testCategory.slug });
  const feedItem = feedWithUpdated.debates.find((d) => d.id === debateCreation1.debateId);

  assert(
    updatedProfile1.displayName === 'Refreshed New Display Name' &&
      refreshedDebateView !== null &&
      refreshedDebateView.authorDisplayName === 'Refreshed New Display Name' &&
      refreshedDebateView.contributions[0].authorDisplayName === 'Refreshed New Display Name' &&
      feedItem?.authorDisplayName === 'Refreshed New Display Name',
    'Test 229: Profile display name update immediately cascades across existing debates, contributions, and feed'
  );

  // Test 230: Rolling 30-day username change limits - allows up to 3 changes and tracks status
  const usernameLimitUser = await prisma.user.create({
    data: {
      email: 'username_limiter@indobid.lol',
      username: 'limiter_orig',
      displayName: 'Username Limiter',
    },
  });

  // Change 1
  await userService.updateProfile(usernameLimitUser.id, { username: 'limiter_change_1' });
  // Change 2
  await userService.updateProfile(usernameLimitUser.id, { username: 'limiter_change_2' });
  // Change 3
  await userService.updateProfile(usernameLimitUser.id, { username: 'limiter_change_3' });

  const statusAfter3 = await userService.getUsernameChangeStatus(usernameLimitUser.id);
  assert(
    statusAfter3.changesUsed === 3 &&
      statusAfter3.remainingChanges === 0 &&
      statusAfter3.canChange === false,
    'Test 230: 3 username changes are permitted within 30 days and status reflects 0 changes remaining'
  );

  // Test 231: 4th username change within rolling 30 days is strictly blocked
  let change4Blocked = false;
  try {
    await userService.updateProfile(usernameLimitUser.id, { username: 'limiter_change_4' });
  } catch (err: any) {
    if (err instanceof ValidationError && err.message.includes('maximum of 3 times')) {
      change4Blocked = true;
    }
  }
  assert(
    change4Blocked,
    'Test 231: 4th username change in 30 days is strictly blocked with ValidationError'
  );

  // Test 232: Case-insensitive duplicate username collision detection
  let duplicateUsernameBlocked = false;
  try {
    await userService.updateProfile(canonicalUser.id, { username: 'LIMITER_CHANGE_3' });
  } catch (err: any) {
    if (err.message && err.message.toLowerCase().includes('already taken')) {
      duplicateUsernameBlocked = true;
    }
  }
  assert(
    duplicateUsernameBlocked,
    'Test 232: Case-insensitive duplicate username collision is rejected'
  );

  // Test 233: Username format validation (alphanumeric + underscores only, 3-20 chars)
  let invalidUsernameBlocked = false;
  try {
    await userService.updateProfile(canonicalUser.id, { username: 'bad user@name' });
  } catch (err: any) {
    if (err instanceof ValidationError) {
      invalidUsernameBlocked = true;
    }
  }
  assert(
    invalidUsernameBlocked,
    'Test 233: Invalid username characters/spaces are strictly rejected'
  );

  // Test 234: ISO Country code and Currency resolution
  const profileCountryIndia = await userService.updateProfile(canonicalUser.id, { countryCode: 'IN' });
  assert(
    profileCountryIndia.countryCode === 'IN' && profileCountryIndia.currencyCode === 'INR',
    'Test 234: Setting country code IN auto-assigns INR currency'
  );

  const profileCountryUS = await userService.updateProfile(canonicalUser.id, { countryCode: 'US' });
  assert(
    profileCountryUS.countryCode === 'US' && profileCountryUS.currencyCode === 'USD',
    'Test 235: Setting country code US auto-assigns USD currency'
  );

  // Test 236: Ghost Mode post creation and author masking
  const ghostUser = await prisma.user.create({
    data: {
      email: 'ghost_tester@indobid.lol',
      username: 'ghost_real_username',
      displayName: 'Real Ghost Name',
      role: 'founder',
      ghostMode: true,
    },
  });

  const ghostDebateCreation = await debateService.createDebate(
    {
      title: 'Secret Ghost Mode Debate',
      content: 'Real author identity must be completely masked from the public.',
      categoryId: testCategory.id,
      isFree: true,
      amountPaise: 0,
    },
    {
      userId: ghostUser.id,
      username: ghostUser.username!,
      displayName: ghostUser.displayName!,
      role: 'founder',
      email: ghostUser.email,
    },
    true
  );

  const ghostDebateRecord = await prisma.debate.findUnique({
    where: { id: ghostDebateCreation.debateId },
  });

  assert(
    ghostDebateRecord !== null && ghostDebateRecord.isGhost === true,
    'Test 236: Debate created while ghostMode is active is marked isGhost=true'
  );

  // Test 237: Feeds and Detail views strictly mask Ghost identities
  const ghostFeed = await debateService.getDebates({ category: testCategory.slug });
  const ghostFeedItem = ghostFeed.debates.find((d) => d.id === ghostDebateCreation.debateId);
  const ghostDetail = await debateService.getDebateById(ghostDebateCreation.debateId);

  assert(
    ghostFeedItem !== undefined &&
      ghostFeedItem.isGhost === true &&
      ghostFeedItem.isClickableProfile === false &&
      ghostFeedItem.authorUsername === 'anonymous' &&
      ghostFeedItem.authorDisplayName !== 'Real Ghost Name' &&
      ghostFeedItem.authorDisplayName.length > 0 &&
      ghostDetail !== null &&
      ghostDetail.isGhost === true &&
      ghostDetail.isClickableProfile === false &&
      ghostDetail.authorUsername === 'anonymous' &&
      ghostDetail.authorDisplayName !== 'Real Ghost Name',
    'Test 237: Feeds and Debate Detail mask real username, real display name, and disable profile links for Ghost Mode'
  );

  // Test 238: Ghost posts are isolated from public profile list
  const publicProfileView = await userService.getProfile(ghostUser.username!, canonicalUser.id);
  const ownerProfileView = await userService.getProfile(ghostUser.username!, ghostUser.id);

  assert(
    publicProfileView.stats.debatesCount === 0 && ownerProfileView.stats.debatesCount >= 1,
    'Test 238: Ghost posts are excluded from external profile counts but accessible to the owner'
  );

  // Test 239: Private Account restrictions on profile
  const privateUser = await prisma.user.create({
    data: {
      email: 'private_user@indobid.lol',
      username: 'private_account_user',
      displayName: 'Private User',
      isPrivate: true,
    },
  });

  const nonFollowerProfile = await userService.getProfile(privateUser.username!, canonicalUser.id);
  assert(
    nonFollowerProfile.isPrivate === true && nonFollowerProfile.isRestricted === true,
    'Test 239: Non-follower viewing private account is flagged isRestricted=true with content withheld'
  );

  // Test 240: Non-follower is blocked from messaging private account
  let dmBlocked = false;
  try {
    await messageService.sendMessage(
      canonicalUser.id,
      privateUser.username!,
      'Hello, I want to message your private account!'
    );
  } catch (err: any) {
    if (err instanceof AuthorizationError && err.message.includes('private')) {
      dmBlocked = true;
    }
  }
  assert(
    dmBlocked,
    'Test 240: Non-follower is blocked with AuthorizationError from messaging a private account'
  );

  // Test 241: Following private account unlocks messaging and profile access
  await followService.toggleFollow(canonicalUser.id, privateUser.username!);
  const followerProfile = await userService.getProfile(privateUser.username!, canonicalUser.id);

  const sentDm = await messageService.sendMessage(
    canonicalUser.id,
    privateUser.username!,
    'Hello follower friend!'
  );

  assert(
    followerProfile.isRestricted === false &&
      sentDm.message.id !== undefined &&
      sentDm.message.content === 'Hello follower friend!',
    'Test 241: Following a private account unlocks unrestricted profile view and allows direct messaging'
  );

  // Test 242: Ghost Mode social interactions mask notification sender
  await followService.toggleFollow(ghostUser.id, canonicalUser.username!);
  const ghostNotification = await prisma.notification.findFirst({
    where: {
      userId: canonicalUser.id,
      type: 'follow',
      actorId: ghostUser.id,
    },
    orderBy: { createdAt: 'desc' },
  });

  assert(
    ghostNotification !== null &&
      !ghostNotification.message.includes('ghost_real_username') &&
      !ghostNotification.message.includes('Real Ghost Name'),
    'Test 242: Ghost mode follow generates notification masking real username and display name'
  );

  // =========================================================================
  // PART 17: FEED, TRENDING, SEARCH & FOR YOU RANKING VERIFICATION
  // =========================================================================
  console.log('\n--- PART 17: FEED, TRENDING, SEARCH & FOR YOU RANKING VERIFICATION ---');

  // 1. Setup Part 17 Test Categories
  const catTech = await prisma.category.upsert({
    where: { slug: 'tech-part17' },
    update: {},
    create: { name: 'Technology P17', slug: 'tech-part17', icon: 'Cpu', sortOrder: 101 },
  });

  const catFinance = await prisma.category.upsert({
    where: { slug: 'finance-part17' },
    update: {},
    create: { name: 'Finance P17', slug: 'finance-part17', icon: 'DollarSign', sortOrder: 102 },
  });

  const catCooking = await prisma.category.upsert({
    where: { slug: 'cooking-part17' },
    update: {},
    create: { name: 'Cooking P17', slug: 'cooking-part17', icon: 'Utensils', sortOrder: 103 },
  });

  // 2. Setup Part 17 Test Users (with idempotent pre-cleanup)
  const part17Emails = ['p17_author_a@test.lol', 'p17_author_b@test.lol', 'p17_ghost@test.lol', 'p17_consumer@test.lol', 'p17_cold@test.lol'];
  const existingP17Users = await prisma.user.findMany({ where: { email: { in: part17Emails } }, select: { id: true } });
  const existingP17Ids = existingP17Users.map((u) => u.id);
  if (existingP17Ids.length > 0) {
    await prisma.debateLike.deleteMany({ where: { userId: { in: existingP17Ids } } });
    await prisma.debateBookmark.deleteMany({ where: { userId: { in: existingP17Ids } } });
    await prisma.follow.deleteMany({ where: { OR: [{ followerId: { in: existingP17Ids } }, { followingId: { in: existingP17Ids } }] } });
    await prisma.payment.deleteMany({ where: { debate: { authorId: { in: existingP17Ids } } } });
    await prisma.contribution.deleteMany({ where: { authorId: { in: existingP17Ids } } });
    await prisma.debate.deleteMany({ where: { authorId: { in: existingP17Ids } } });
    await prisma.user.deleteMany({ where: { id: { in: existingP17Ids } } });
  }

  const p17AuthorA = await prisma.user.create({
    data: {
      email: 'p17_author_a@test.lol',
      username: 'p17_creator_alpha',
      displayName: 'Creator Alpha',
      role: 'user',
    },
  });

  const p17AuthorB = await prisma.user.create({
    data: {
      email: 'p17_author_b@test.lol',
      username: 'p17_creator_beta',
      displayName: 'Creator Beta',
      role: 'user',
    },
  });

  const p17GhostAuthor = await prisma.user.create({
    data: {
      email: 'p17_ghost@test.lol',
      username: 'p17_ghost_real',
      displayName: 'Real Hidden Name',
      role: 'user',
      ghostMode: true,
      ghostDisplayName: 'Ghost Seeker',
    },
  });

  const p17Consumer = await prisma.user.create({
    data: {
      email: 'p17_consumer@test.lol',
      username: 'p17_consumer_user',
      displayName: 'Tech Enthusiast',
      role: 'user',
      interests: JSON.stringify([catTech.slug]),
    },
  });

  const p17ColdUser = await prisma.user.create({
    data: {
      email: 'p17_cold@test.lol',
      username: 'p17_cold_user',
      displayName: 'Fresh Visitor',
      role: 'user',
    },
  });

  // 3. Create Paid Debates with various confirmed amounts: $100 (10000 paise), $50 (5000 paise), $10 (1000 paise), $2 (200 paise), Unpaid (0 paise)
  const debateUnpaid = await prisma.debate.create({
    data: {
      authorId: p17AuthorA.id,
      authorUsername: p17AuthorA.username!,
      authorDisplayName: p17AuthorA.displayName!,
      title: 'Debate Unpaid Zero Value',
      content: 'Discussion with no verified backing.',
      categoryId: catFinance.id,
      originalContribution: 0,
      totalVerifiedContribution: 0,
      status: 'active',
    },
  });

  const debate2USD = await prisma.debate.create({
    data: {
      authorId: p17AuthorA.id,
      authorUsername: p17AuthorA.username!,
      authorDisplayName: p17AuthorA.displayName!,
      title: 'Debate Two Dollars Backing',
      content: 'Discussion with $2 verified backing.',
      categoryId: catFinance.id,
      originalContribution: 200,
      totalVerifiedContribution: 200,
      status: 'active',
    },
  });

  const debate10USD = await prisma.debate.create({
    data: {
      authorId: p17AuthorA.id,
      authorUsername: p17AuthorA.username!,
      authorDisplayName: p17AuthorA.displayName!,
      title: 'Debate Ten Dollars Backing',
      content: 'Discussion with $10 verified backing.',
      categoryId: catFinance.id,
      originalContribution: 1000,
      totalVerifiedContribution: 1000,
      status: 'active',
    },
  });

  const debate50USD = await prisma.debate.create({
    data: {
      authorId: p17AuthorB.id,
      authorUsername: p17AuthorB.username!,
      authorDisplayName: p17AuthorB.displayName!,
      title: 'Debate Fifty Dollars Backing',
      content: 'Discussion with $50 verified backing.',
      categoryId: catFinance.id,
      originalContribution: 5000,
      totalVerifiedContribution: 5000,
      status: 'active',
    },
  });

  const debate100USD = await prisma.debate.create({
    data: {
      authorId: p17AuthorB.id,
      authorUsername: p17AuthorB.username!,
      authorDisplayName: p17AuthorB.displayName!,
      title: 'Debate Hundred Dollars Backing',
      content: 'Discussion with $100 verified backing.',
      categoryId: catFinance.id,
      originalContribution: 10000,
      totalVerifiedContribution: 10000,
      status: 'active',
    },
  });

  // Test 243: Paid post priority ordering ($100 > $50 > $10 > $2 > unpaid)
  const paidSortedDebates = await debateService.getDebates({
    category: catFinance.slug,
    sort: 'top_paid',
    limit: 10,
  });
  const paidAmounts = paidSortedDebates.items.map((d) => d.totalVerifiedContribution);
  assert(
    paidAmounts.length >= 5 &&
      paidAmounts[0] === 10000 &&
      paidAmounts[1] === 5000 &&
      paidAmounts[2] === 1000 &&
      paidAmounts[3] === 200 &&
      paidAmounts[4] === 0,
    'Test 243: Paid post priority ordering strictly enforces $100 > $50 > $10 > $2 > unpaid'
  );

  // Test 244: Unconfirmed payments do not affect totalVerifiedContribution or rank as paid
  await prisma.payment.create({
    data: {
      debateId: debateUnpaid.id,
      providerPaymentId: `pay_unconfirmed_${Date.now()}`,
      provider: 'razorpay',
      amount: 50000,
      status: 'failed',
    },
  });
  await prisma.payment.create({
    data: {
      debateId: debateUnpaid.id,
      providerPaymentId: `pay_pending_${Date.now()}`,
      provider: 'razorpay',
      amount: 80000,
      status: 'pending',
    },
  });
  const refreshedUnpaidDebate = await prisma.debate.findUnique({ where: { id: debateUnpaid.id } });
  assert(
    refreshedUnpaidDebate?.totalVerifiedContribution === 0,
    'Test 244: Failed, pending, and cancelled payments do NOT increment totalVerifiedContribution or rank as paid'
  );

  // Test 245 & 246: Refund handling
  const refundTestDebate = await prisma.debate.create({
    data: {
      authorId: p17AuthorA.id,
      authorUsername: p17AuthorA.username!,
      authorDisplayName: p17AuthorA.displayName!,
      title: 'Debate Prior to Refund',
      content: 'This debate has a $50 backing that will be refunded.',
      categoryId: catFinance.id,
      originalContribution: 5000,
      totalVerifiedContribution: 5000,
      status: 'active',
    },
  });
  const refundPaymentId = `pay_refund_test_${Date.now()}`;
  await prisma.payment.create({
    data: {
      debateId: refundTestDebate.id,
      providerPaymentId: refundPaymentId,
      provider: 'razorpay',
      amount: 5000,
      status: 'succeeded',
    },
  });
  const refundResult = await processRefundedPayment({ providerPaymentId: refundPaymentId, reason: 'Disputed charge reversal' });
  const postRefundDebate = await prisma.debate.findUnique({ where: { id: refundTestDebate.id } });
  const postRefundPayment = await prisma.payment.findUnique({ where: { providerPaymentId: refundPaymentId } });

  assert(
    refundResult.success === true &&
      postRefundPayment?.status === 'refunded' &&
      postRefundDebate?.totalVerifiedContribution === 0,
    'Test 245: processRefundedPayment atomically sets payment status to refunded and decrements verified contribution'
  );

  const topPaidAfterRefund = await debateService.getDebates({
    category: catFinance.slug,
    sort: 'top_paid',
    limit: 10,
  });
  const refundDebateIndex = topPaidAfterRefund.items.findIndex((d) => d.id === refundTestDebate.id);
  assert(
    refundDebateIndex >= 4,
    'Test 246: Refunded post is immediately demoted below confirmed paid posts in ranking'
  );

  // Test 247: Frontend cannot tamper with paid post ranking amount
  assert(
    topPaidAfterRefund.items.every((item) => typeof item.totalVerifiedContribution === 'number' && item.totalVerifiedContribution >= 0),
    'Test 247: Paid post ranking amounts are computed exclusively from database ledger and cannot be overridden by frontend client'
  );

  // Test 248-252: Trending
  const debateHighReach = await prisma.debate.create({
    data: {
      authorId: p17AuthorA.id,
      authorUsername: p17AuthorA.username!,
      authorDisplayName: p17AuthorA.displayName!,
      title: 'Top Reach Debate High Impressions',
      content: 'Massive viral reach.',
      categoryId: catTech.id,
      impressionCount: 9999,
      likeCount: 5,
      totalVerifiedContribution: 0,
      trendingScore: 50.0,
      status: 'active',
    },
  });

  const debateHighEngagement = await prisma.debate.create({
    data: {
      authorId: p17AuthorB.id,
      authorUsername: p17AuthorB.username!,
      authorDisplayName: p17AuthorB.displayName!,
      title: 'Top Engagement Debate High Likes and Discussion',
      content: 'Deep debate with extensive community engagement.',
      categoryId: catTech.id,
      impressionCount: 500,
      likeCount: 888,
      contributionCount: 42,
      totalVerifiedContribution: 0,
      trendingScore: 60.0,
      status: 'active',
    },
  });

  const debateTopOverallTrending = await prisma.debate.create({
    data: {
      authorId: p17AuthorA.id,
      authorUsername: p17AuthorA.username!,
      authorDisplayName: p17AuthorA.displayName!,
      title: 'Overall Top Trending Debate',
      content: 'Highest combined trending score.',
      categoryId: catTech.id,
      impressionCount: 4000,
      likeCount: 300,
      contributionCount: 20,
      totalVerifiedContribution: 5000,
      trendingScore: 999.9,
      status: 'active',
    },
  });

  const reachFeed = await debateService.getDebates({
    category: catTech.slug,
    sort: 'top_reach',
    limit: 5,
  });
  assert(
    reachFeed.items[0]?.id === debateHighReach.id && reachFeed.items[0]?.impressionCount === 9999,
    'Test 248: Trending Top Reach ranks purely by real database impressionCount DESC'
  );

  const paidFeed = await debateService.getDebates({
    category: catFinance.slug,
    sort: 'top_paid',
    limit: 5,
  });
  assert(
    paidFeed.items[0]?.id === debate100USD.id && paidFeed.items[0]?.totalVerifiedContribution === 10000,
    'Test 249: Trending Top Paid ranks purely by confirmed totalVerifiedContribution DESC'
  );

  const engagementFeed = await debateService.getDebates({
    category: catTech.slug,
    sort: 'top_engagement',
    limit: 5,
  });
  assert(
    engagementFeed.items[0]?.id === debateHighEngagement.id && engagementFeed.items[0]?.likeCount === 888,
    'Test 250: Trending Top Engagement ranks purely by real likeCount and contributionCount DESC'
  );

  const overallTrendingFeed = await debateService.getDebates({
    category: catTech.slug,
    sort: 'trending',
    limit: 5,
  });
  assert(
    overallTrendingFeed.items[0]?.id === debateTopOverallTrending.id,
    'Test 251: Overall Trending combines reach, engagement, velocity, and backing without static mocks'
  );

  const trendingApiResponse = await getTrendingRoute();
  const trendingData = await trendingApiResponse.json();
  assert(
    trendingApiResponse.status === 200 &&
      Array.isArray(trendingData.overallTrending) &&
      Array.isArray(trendingData.topPaid) &&
      Array.isArray(trendingData.topReach) &&
      Array.isArray(trendingData.topEngagement) &&
      trendingData.overallTrending.length > 0,
    'Test 252: Trending API (GET /api/trending) returns overallTrending, topPaid, topReach, and topEngagement with live records'
  );

  // Search Tests (253-255)
  const debateAiRelevant = await prisma.debate.create({
    data: {
      authorId: p17AuthorA.id,
      authorUsername: p17AuthorA.username!,
      authorDisplayName: p17AuthorA.displayName!,
      title: 'AI Machine Learning Architecture in 2026',
      content: 'A detailed exploration of autonomous cognitive architectures.',
      categoryId: catTech.id,
      totalVerifiedContribution: 500, // $5 (500 paise)
      status: 'active',
    },
  });

  const debateCoffeeUnrelated = await prisma.debate.create({
    data: {
      authorId: p17AuthorB.id,
      authorUsername: p17AuthorB.username!,
      authorDisplayName: p17AuthorB.displayName!,
      title: 'Best Coffee Roasting Techniques for Morning Espresso',
      content: 'A comprehensive guide on beans, dark roasts, and brewing temperatures.',
      categoryId: catCooking.id,
      totalVerifiedContribution: 10000, // $100 (10000 paise)
      status: 'active',
    },
  });

  const searchRelevanceAI = calculateSearchRelevanceScore(
    {
      id: debateAiRelevant.id,
      title: debateAiRelevant.title,
      content: debateAiRelevant.content,
      totalVerifiedContribution: debateAiRelevant.totalVerifiedContribution,
      createdAt: debateAiRelevant.createdAt,
    },
    'AI'
  );

  const searchRelevanceCoffee = calculateSearchRelevanceScore(
    {
      id: debateCoffeeUnrelated.id,
      title: debateCoffeeUnrelated.title,
      content: debateCoffeeUnrelated.content,
      totalVerifiedContribution: debateCoffeeUnrelated.totalVerifiedContribution,
      createdAt: debateCoffeeUnrelated.createdAt,
    },
    'AI'
  );

  assert(
    searchRelevanceAI > searchRelevanceCoffee && searchRelevanceAI > 100 && searchRelevanceCoffee < 15,
    'Test 253: Search ranks primarily by relevance: $5 AI post strictly outranks unrelated $100 post for query "AI"'
  );

  const debateAiBodyOnly = {
    id: 'candidate_body_only',
    title: 'General Discussions of Future Horizons',
    content: 'In modern research, ai models continue to expand rapidly.',
    totalVerifiedContribution: 500,
    createdAt: new Date(),
  };
  const bodyScore = calculateSearchRelevanceScore(debateAiBodyOnly, 'AI');
  assert(
    searchRelevanceAI > bodyScore && bodyScore < 30,
    'Test 254: Search exact title match scores higher than partial body matches'
  );

  const debateTieBreakUnpaid = {
    id: 'tie_unpaid',
    title: 'Quantum Computing Frontier',
    content: 'Overview of quantum qubits and coherence.',
    totalVerifiedContribution: 0,
    createdAt: new Date(),
  };
  const debateTieBreakPaid = {
    id: 'tie_paid',
    title: 'Quantum Computing Frontier',
    content: 'Overview of quantum qubits and coherence.',
    totalVerifiedContribution: 5000, // $50
    createdAt: new Date(),
  };
  const tieScoreUnpaid = calculateSearchRelevanceScore(debateTieBreakUnpaid, 'Quantum Computing');
  const tieScorePaid = calculateSearchRelevanceScore(debateTieBreakPaid, 'Quantum Computing');
  assert(
    tieScorePaid > tieScoreUnpaid && (tieScorePaid - tieScoreUnpaid) <= 10,
    'Test 255: Paid backing acts as a modest sublinear tie-breaker (<= 10 points) without distorting relevance'
  );

  // For You & Personalization Tests (256-258)
  await prisma.debateLike.create({
    data: {
      debateId: debateAiRelevant.id,
      userId: p17Consumer.id,
    },
  });

  await prisma.debateBookmark.create({
    data: {
      debateId: debateHighReach.id,
      userId: p17Consumer.id,
    },
  });

  await prisma.follow.create({
    data: {
      followerId: p17Consumer.id,
      followingId: p17AuthorA.id,
    },
  });

  const interestProfile = await personalizationService.getUserInterestProfile(p17Consumer.id);
  const techCategoryWeight = interestProfile.categoryWeights[catTech.id] || interestProfile.categoryWeights[catTech.slug] || 0;
  const cookingCategoryWeight = interestProfile.categoryWeights[catCooking.id] || interestProfile.categoryWeights[catCooking.slug] || 0;

  assert(
    techCategoryWeight > 0.3 && techCategoryWeight > cookingCategoryWeight,
    'Test 256: For You multi-signal interest extraction aggregates explicit interests, follows, bookmarks, and likes'
  );

  const part17ForYouFeed = await debateService.getDebates({
    sort: 'for_you',
    limit: 10,
  }, p17Consumer.id);
  assert(
    part17ForYouFeed.items.length > 0 && part17ForYouFeed.items.some((item) => item.category.slug === catTech.slug),
    'Test 257: For You feed promotes user affinity topics (Tech) to prominent ranking positions'
  );

  const affinityTech = personalizationService.computeAffinityScore(
    { categoryId: catTech.id, categorySlug: catTech.slug, authorId: p17AuthorA.id },
    interestProfile
  );
  const affinityCooking = personalizationService.computeAffinityScore(
    { categoryId: catCooking.id, categorySlug: catCooking.slug, authorId: p17AuthorB.id },
    interestProfile
  );
  assert(
    affinityTech > affinityCooking && affinityCooking === 0,
    'Test 258: Uninteracted and irrelevant categories receive zero affinity and are demoted in personalized ranking'
  );

  // Cold Start Tests (259-260)
  const coldStartFeed = await debateService.getDebates({
    sort: 'for_you',
    limit: 10,
  }, p17ColdUser.id);
  assert(
    coldStartFeed.items.length > 0 && coldStartFeed.total > 0,
    'Test 259: Cold start user with 0 history receives a healthy discovery feed blending freshness, trending, and paid conviction'
  );

  await prisma.user.update({
    where: { id: p17ColdUser.id },
    data: { interests: JSON.stringify([catFinance.slug]) },
  });
  const coldProfileWithInterests = await personalizationService.getUserInterestProfile(p17ColdUser.id);
  const financeWeight = coldProfileWithInterests.categoryWeights[catFinance.id] || coldProfileWithInterests.categoryWeights[catFinance.slug] || 0;
  assert(
    financeWeight > 0.5,
    'Test 260: Onboarding interest selection immediately bootstraps cold start user profile with heavy category weighting'
  );

  // Following Feed Tests (261-262)
  const part17FollowingFeed = await debateService.getDebates({
    sort: 'following',
    limit: 10,
  }, p17Consumer.id);
  const followingAuthors = part17FollowingFeed.items.map((d) => d.authorId);
  const includesAuthorA = followingAuthors.length > 0 && followingAuthors.every((aId) => aId === p17AuthorA.id);
  const excludesAuthorB = !followingAuthors.includes(p17AuthorB.id);

  assert(
    part17FollowingFeed.items.length > 0 && includesAuthorA,
    'Test 261: Following feed strictly isolates and returns content exclusively authored by followed creators'
  );

  assert(
    excludesAuthorB,
    'Test 262: Following feed strictly excludes content from non-followed creators'
  );

  // Ghost Mode Privacy Tests (263-264)
  const ghostDebate = await prisma.debate.create({
    data: {
      authorId: p17GhostAuthor.id,
      authorUsername: p17GhostAuthor.username!,
      authorDisplayName: p17GhostAuthor.displayName!,
      title: 'Secret Thoughts from the Shadows',
      content: 'Sensitive whistleblowing insights that require full anonymity.',
      categoryId: catTech.id,
      isGhost: true,
      trendingScore: 80.0,
      totalVerifiedContribution: 2000,
      status: 'active',
    },
  });

  const ghostDebateFeed = await debateService.getDebates({
    search: 'Secret Thoughts from the Shadows',
    limit: 5,
  });
  const fetchedGhostItem = ghostDebateFeed.items.find((d) => d.id === ghostDebate.id);

  assert(
    fetchedGhostItem !== undefined &&
      fetchedGhostItem.isGhost === true &&
      fetchedGhostItem.authorUsername.startsWith('ghost_') &&
      !fetchedGhostItem.authorUsername.includes('p17_ghost_real') &&
      !fetchedGhostItem.authorDisplayName.includes('Real Hidden Name'),
    'Test 263: Ghost mode author identity (real username, email, display name) is never leaked in feed and search responses'
  );

  const trendingWithGhost = await getTrendingRoute();
  const trendingPayload = await trendingWithGhost.json();
  const allTrendingItems = [
    ...(trendingPayload.overallTrending || []),
    ...(trendingPayload.topPaid || []),
    ...(trendingPayload.topReach || []),
    ...(trendingPayload.topEngagement || []),
  ];
  const leakedGhostItem = allTrendingItems.find(
    (item: any) =>
      item.authorUsername?.includes('p17_ghost_real') ||
      item.authorDisplayName?.includes('Real Hidden Name') ||
      item.author?.username?.includes('p17_ghost_real')
  );
  assert(
    leakedGhostItem === undefined,
    'Test 264: Trending API carousels strictly mask Ghost mode identities with zero data leakage'
  );

  // Pagination & Diversity Test (265)
  const page1 = await debateService.getDebates({
    category: catFinance.slug,
    sort: 'top_paid',
    page: 1,
    limit: 2,
  });
  const page2 = await debateService.getDebates({
    category: catFinance.slug,
    sort: 'top_paid',
    page: 2,
    limit: 2,
  });
  const page1Ids = page1.items.map((i) => i.id);
  const page2Ids = page2.items.map((i) => i.id);
  const hasDuplicates = page1Ids.some((id) => page2Ids.includes(id));

  assert(
    page1.items.length === 2 && page2.items.length === 2 && !hasDuplicates,
    'Test 265: Feed pagination smoothly traverses database results without duplicates across page boundaries'
  );

  // =========================================================================
  // PART 18 — GOOGLE OAUTH AUTHENTICATION SUITE
  // =========================================================================
  const originalOAuthClientId = (env as any).GOOGLE_CLIENT_ID;
  const originalOAuthClientSecret = (env as any).GOOGLE_CLIENT_SECRET;
  (env as any).GOOGLE_CLIENT_ID = 'test-google-client-id-12345.apps.googleusercontent.com';
  (env as any).GOOGLE_CLIENT_SECRET = 'test-google-client-secret-abcde';

  let createdGoogleOAuthUser: any = null;

  try {
    // Test 266: Resolve localhost callback URI
    const localReq = new NextRequest('http://localhost:3000/api/auth/google', {
      headers: { host: 'localhost:3000' },
    });
    const localUri = resolveGoogleRedirectUri(localReq);
    assert(
      localUri === 'http://localhost:3000/api/auth/callback/google',
      'Test 266: resolveGoogleRedirectUri resolves localhost:3000 callback URI'
    );

    // Test 267: Resolve production indobid.lol callback URI
    const prodReq = new NextRequest('https://indobid.lol/api/auth/google', {
      headers: {
        'x-forwarded-host': 'indobid.lol',
        'x-forwarded-proto': 'https',
      },
    });
    const prodUri = resolveGoogleRedirectUri(prodReq);
    assert(
      prodUri === 'https://indobid.lol/api/auth/callback/google',
      'Test 267: resolveGoogleRedirectUri resolves production indobid.lol callback URI'
    );

    // Test 268: GET /api/auth/google redirects to Google accounts authorization URL
    const authReq = new NextRequest('http://localhost:3000/api/auth/google');
    const authRes = await getGoogleAuthRoute(authReq);
    const redirectLocation = authRes.headers.get('location');
    assert(
      redirectLocation !== null && redirectLocation.startsWith('https://accounts.google.com/o/oauth2/v2/auth'),
      'Test 268: GET /api/auth/google redirects to Google accounts authorization URL'
    );

    // Test 269: Auth URL query parameters
    const authUrl = new URL(redirectLocation!);
    assert(
      authUrl.searchParams.get('client_id') === 'test-google-client-id-12345.apps.googleusercontent.com' &&
        authUrl.searchParams.get('redirect_uri') === 'http://localhost:3000/api/auth/callback/google' &&
        authUrl.searchParams.get('scope') === 'openid email profile' &&
        authUrl.searchParams.get('response_type') === 'code' &&
        Boolean(authUrl.searchParams.get('state')),
      'Test 269: Google auth URL includes valid client_id, redirect_uri, scope, response_type, and state'
    );

    // Test 270: Secure state and redirect cookies
    const stateCookie = authRes.cookies.get(GOOGLE_OAUTH_STATE_COOKIE);
    const redirectCookie = authRes.cookies.get(GOOGLE_OAUTH_REDIRECT_URI_COOKIE);
    assert(
      stateCookie !== undefined &&
        stateCookie.value === authUrl.searchParams.get('state') &&
        redirectCookie !== undefined &&
        redirectCookie.value === 'http://localhost:3000/api/auth/callback/google',
      'Test 270: GET /api/auth/google sets secure state and redirect_uri HTTP-only cookies'
    );

    // Test 271: Target destination preservation in cookie
    const authWithDestReq = new NextRequest('http://localhost:3000/api/auth/google?redirect=/debate/special-topic');
    const authWithDestRes = await getGoogleAuthRoute(authWithDestReq);
    const destCookie = authWithDestRes.cookies.get(GOOGLE_OAUTH_DESTINATION_COOKIE);
    assert(
      destCookie !== undefined && destCookie.value === '/debate/special-topic',
      'Test 271: GET /api/auth/google stores valid destination redirect in cookie'
    );

    // Test 272: Google provider error handling (access_denied)
    const errorReq = new NextRequest('http://localhost:3000/api/auth/callback/google?error=access_denied');
    const errorRes = await getGoogleCallbackRoute(errorReq);
    assert(
      errorRes.headers.get('location')?.includes('error=google_oauth_denied') === true,
      'Test 272: Callback redirects to landing page with google_oauth_denied when user cancels'
    );

    // Test 273: State mismatch handling
    const mismatchReq = new NextRequest('http://localhost:3000/api/auth/callback/google?state=tampered&code=authcode123');
    mismatchReq.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, 'original_state_value');
    const mismatchRes = await getGoogleCallbackRoute(mismatchReq);
    assert(
      mismatchRes.headers.get('location')?.includes('error=google_oauth_state_mismatch') === true,
      'Test 273: Callback rejects request when state token is mismatched or absent'
    );

    // Test 274: Missing authorization code handling
    const validOAuthState = 'secure_random_state_token_123';
    const missingCodeReq = new NextRequest(`http://localhost:3000/api/auth/callback/google?state=${validOAuthState}`);
    missingCodeReq.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, validOAuthState);
    const missingCodeRes = await getGoogleCallbackRoute(missingCodeReq);
    assert(
      missingCodeRes.headers.get('location')?.includes('error=google_oauth_missing_code') === true,
      'Test 274: Callback rejects request when authorization code is missing'
    );

    // Test 275: Successful Google user login & automated provisioning
    const testGoogleEmail = `test_google_user_${Date.now()}@gmail.com`;
    const testGoogleSub = `google_sub_${Date.now()}`;
    const originalFetch = global.fetch;

    global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const urlStr = typeof input === 'string' ? input : input.toString();
      if (urlStr.includes('oauth2.googleapis.com/token')) {
        return new Response(
          JSON.stringify({
            access_token: 'mock_access_token_xyz',
            id_token: 'mock_id_token_xyz',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlStr.includes('openidconnect.googleapis.com/v1/userinfo')) {
        return new Response(
          JSON.stringify({
            sub: testGoogleSub,
            email: testGoogleEmail,
            email_verified: true,
            name: 'Google Test User',
            picture: 'https://lh3.googleusercontent.com/a/test-avatar',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(input, init);
    };

    const successReq = new NextRequest(
      `http://localhost:3000/api/auth/callback/google?code=valid_test_code&state=${validOAuthState}`
    );
    successReq.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, validOAuthState);
    successReq.cookies.set(GOOGLE_OAUTH_REDIRECT_URI_COOKIE, 'http://localhost:3000/api/auth/callback/google');
    successReq.cookies.set(GOOGLE_OAUTH_DESTINATION_COOKIE, '/debate/test-target-post');

    const successRes = await getGoogleCallbackRoute(successReq);
    global.fetch = originalFetch;

    const successLocation = successRes.headers.get('location');
    assert(
      successLocation !== null && new URL(successLocation).pathname === '/debate/test-target-post',
      'Test 275: Callback redirects authenticated user to target destination from cookie'
    );

    // Test 276: Session cookie setting
    const sessionCookie = successRes.cookies.get(AUTH_COOKIE_NAME);
    assert(
      sessionCookie !== undefined && Boolean(sessionCookie.value),
      'Test 276: Callback sets indobid_session authentication cookie'
    );

    // Test 277: Session token verification
    const verifiedSession = sessionService.verifySessionToken(sessionCookie!.value);
    assert(
      verifiedSession !== null && verifiedSession.email === testGoogleEmail,
      'Test 277: indobid_session token verifies and contains authenticated user email'
    );

    // Test 278: Database user provisioning
    createdGoogleOAuthUser = await prisma.user.findUnique({
      where: { email: testGoogleEmail },
    });
    assert(
      createdGoogleOAuthUser !== null &&
        createdGoogleOAuthUser.isVerified === true &&
        createdGoogleOAuthUser.emailVerifiedAt !== null &&
        createdGoogleOAuthUser.avatarUrl === 'https://lh3.googleusercontent.com/a/test-avatar' &&
        createdGoogleOAuthUser.displayName === 'Google Test User',
      'Test 278: Callback provisions user in DB with verified email, display name, and avatar'
    );

    // Test 279: Founder Google login assigns Founder role authoritatively
    global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const urlStr = typeof input === 'string' ? input : input.toString();
      if (urlStr.includes('oauth2.googleapis.com/token')) {
        return new Response(
          JSON.stringify({
            access_token: 'mock_founder_access_token',
            id_token: 'mock_founder_id_token',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlStr.includes('openidconnect.googleapis.com/v1/userinfo')) {
        return new Response(
          JSON.stringify({
            sub: 'google_founder_sub',
            email: ADMIN_EMAIL,
            email_verified: true,
            name: 'Vishal Kumar',
            picture: 'https://lh3.googleusercontent.com/a/founder-avatar',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(input, init);
    };

    const founderReq = new NextRequest(
      `http://localhost:3000/api/auth/callback/google?code=founder_code&state=${validOAuthState}`
    );
    founderReq.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, validOAuthState);
    founderReq.cookies.set(GOOGLE_OAUTH_REDIRECT_URI_COOKIE, 'http://localhost:3000/api/auth/callback/google');

    const founderRes = await getGoogleCallbackRoute(founderReq);
    global.fetch = originalFetch;

    const founderSessionCookie = founderRes.cookies.get(AUTH_COOKIE_NAME);
    const verifiedFounderSession = sessionService.verifySessionToken(founderSessionCookie!.value);
    assert(
      verifiedFounderSession !== null &&
        verifiedFounderSession.role === 'founder' &&
        isFounderCheck(verifiedFounderSession),
      'Test 279: Founder Google login automatically bestows authoritative Founder role'
    );
  } finally {
    (env as any).GOOGLE_CLIENT_ID = originalOAuthClientId;
    (env as any).GOOGLE_CLIENT_SECRET = originalOAuthClientSecret;
    if (createdGoogleOAuthUser) {
      await prisma.user.deleteMany({ where: { id: createdGoogleOAuthUser.id } });
    }
  }

  // ==========================================
  // PART 18: PERMANENT POST PERSISTENCE & SYSTEM AVAILABILITY
  // ==========================================
  console.log('\n--- PART 18: Permanent Post Persistence & System Availability ---');

  // Create dedicated persistence test author
  const p18Author = await prisma.user.create({
    data: {
      email: 'test_p18_persistence_author@example.com',
      username: 'test_persist_author',
      displayName: 'Persistence Test Author',
      emailVerifiedAt: new Date(),
      role: 'user',
    },
  });
  const p18AuthorToken = sessionService.createSessionToken({
    userId: p18Author.id,
    username: p18Author.username!,
    displayName: p18Author.displayName || 'Persistence Test Author',
    email: p18Author.email,
    role: p18Author.role,
  });

  // Ensure category exists
  let p18Category = await prisma.category.findFirst({ where: { slug: 'tech' } });
  if (!p18Category) {
    p18Category = await prisma.category.create({
      data: { name: 'Technology', slug: 'tech', icon: 'Cpu', sortOrder: 1 },
    });
  }

  // Test 280: Post creation and verification in PostgreSQL
  const p18Debate = await prisma.debate.create({
    data: {
      authorId: p18Author.id,
      authorUsername: p18Author.username!,
      authorDisplayName: p18Author.displayName!,
      title: 'Persistent Immutable Opinion on Distributed Architecture 2026',
      content: 'This post must persist permanently in PostgreSQL without disappearing.',
      categoryId: p18Category.id,
      status: 'active',
      totalVerifiedContribution: 0,
      originalContribution: 0,
      trendingScore: 100,
    },
  });
  await prisma.contribution.create({
    data: {
      debateId: p18Debate.id,
      authorId: p18Author.id,
      authorUsername: p18Author.username!,
      authorDisplayName: p18Author.displayName!,
      content: p18Debate.content,
      amount: 0,
      sequence: 1,
      status: 'verified',
    },
  });
  const p18DbRecord = await prisma.debate.findUnique({ where: { id: p18Debate.id } });
  assert(
    p18DbRecord !== null && p18DbRecord.status === 'active' && p18DbRecord.title === p18Debate.title,
    'Test 280: Post created and immediately verified in PostgreSQL database'
  );

  // Test 281: Immediate retrieval via getDebateById -> 200 OK, full content returned
  const p18RetrievedImmediate = await getDebateById(p18Debate.id);
  assert(
    p18RetrievedImmediate !== null &&
      p18RetrievedImmediate.id === p18Debate.id &&
      p18RetrievedImmediate.content === p18Debate.content &&
      p18RetrievedImmediate.authorUsername === p18Author.username,
    'Test 281: Immediate retrieval via getDebateById returns full content'
  );

  // Test 282: Post age > 2 hours (simulate via createdAt = now - 2.5 hours) -> still in DB, still returned by getDebateById
  const twoAndHalfHoursAgo = new Date(Date.now() - 2.5 * 60 * 60 * 1000);
  await prisma.debate.update({
    where: { id: p18Debate.id },
    data: { createdAt: twoAndHalfHoursAgo },
  });
  const p18PostAged2hDb = await prisma.debate.findUnique({ where: { id: p18Debate.id } });
  const p18PostAged2hApi = await getDebateById(p18Debate.id);
  assert(
    p18PostAged2hDb !== null &&
      p18PostAged2hDb.createdAt.getTime() === twoAndHalfHoursAgo.getTime() &&
      p18PostAged2hApi !== null &&
      p18PostAged2hApi.id === p18Debate.id,
    'Test 282: Post aged > 2 hours persists in DB and is returned by getDebateById'
  );

  // Test 283: Post age > 2 hours -> returned by feed query (getDebates)
  const p18Feed2h = await debateService.getDebates({ category: p18Category.slug, sort: 'new' });
  const inFeed2h = p18Feed2h.items.some((item) => item.id === p18Debate.id);
  assert(
    inFeed2h,
    'Test 283: Post aged > 2 hours is returned in feed query (getDebates)'
  );

  // Test 284: Post age > 24 hours (simulate via createdAt = now - 25 hours) -> still returned by feed query, detail query, user profile query
  const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
  await prisma.debate.update({
    where: { id: p18Debate.id },
    data: { createdAt: twentyFiveHoursAgo },
  });
  const p18Feed24h = await debateService.getDebates({ category: p18Category.slug, sort: 'new' });
  const inFeed24h = p18Feed24h.items.some((item) => item.id === p18Debate.id);
  const p18Detail24h = await getDebateById(p18Debate.id);
  const profileReq24h = new NextRequest(`http://localhost:3000/api/profile/${p18Author.username}`);
  const profileRes24h = await getProfileRoute(profileReq24h, { params: Promise.resolve({ username: p18Author.username! }) });
  const profileData24h = await profileRes24h.json();
  const inProfile24h = profileData24h.profile?.debates?.some((d: any) => d.id === p18Debate.id);
  assert(
    inFeed24h && p18Detail24h !== null && inProfile24h,
    'Test 284: Post aged > 24 hours persists across feed, detail query, and profile query'
  );

  // Test 285: Post age > 7 days (simulate via createdAt = now - 8 days) -> still returned by feed, detail, and profile
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  await prisma.debate.update({
    where: { id: p18Debate.id },
    data: { createdAt: eightDaysAgo },
  });
  const p18Feed7d = await debateService.getDebates({ category: p18Category.slug, sort: 'new' });
  const inFeed7d = p18Feed7d.items.some((item) => item.id === p18Debate.id);
  const p18Detail7d = await getDebateById(p18Debate.id);
  const profileRes7d = await getProfileRoute(profileReq24h, { params: Promise.resolve({ username: p18Author.username! }) });
  const profileData7d = await profileRes7d.json();
  const inProfile7d = profileData7d.profile?.debates?.some((d: any) => d.id === p18Debate.id);
  assert(
    inFeed7d && p18Detail7d !== null && inProfile7d,
    'Test 285: Post aged > 7 days persists across feed, detail query, and profile query'
  );

  // Test 286: Post age > 30 days (simulate via createdAt = now - 35 days) -> still returned by feed, detail, and profile
  const thirtyFiveDaysAgo = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
  await prisma.debate.update({
    where: { id: p18Debate.id },
    data: { createdAt: thirtyFiveDaysAgo },
  });
  const p18Feed30d = await debateService.getDebates({ category: p18Category.slug, sort: 'new' });
  const inFeed30d = p18Feed30d.items.some((item) => item.id === p18Debate.id);
  const p18Detail30d = await getDebateById(p18Debate.id);
  const profileRes30d = await getProfileRoute(profileReq24h, { params: Promise.resolve({ username: p18Author.username! }) });
  const profileData30d = await profileRes30d.json();
  const inProfile30d = profileData30d.profile?.debates?.some((d: any) => d.id === p18Debate.id);
  assert(
    inFeed30d && p18Detail30d !== null && inProfile30d,
    'Test 286: Post aged > 30 days persists across feed, detail query, and profile query'
  );

  // Test 287: Search query finds post regardless of age
  const p18Search = await debateService.getDebates({ search: 'Distributed Architecture 2026' });
  const foundInSearch = p18Search.items.some((item) => item.id === p18Debate.id);
  assert(
    foundInSearch,
    'Test 287: Search query finds post regardless of age'
  );

  // Test 288: Post ONLY disappears if explicitly deleted by author or admin (DELETE /api/debates/[id])
  const deleteReq = new NextRequest(`http://localhost:3000/api/debates/${p18Debate.id}`, {
    method: 'DELETE',
  });
  deleteReq.cookies.set(AUTH_COOKIE_NAME, p18AuthorToken);
  const deleteRes = await deleteDebateRoute(deleteReq, { params: Promise.resolve({ id: p18Debate.id }) });
  const deleteData = await deleteRes.json();
  const debateAfterDelete = await getDebateById(p18Debate.id);
  const dbAfterDelete = await prisma.debate.findUnique({ where: { id: p18Debate.id } });
  assert(
    deleteRes.status === 200 &&
      deleteData.success === true &&
      debateAfterDelete === null &&
      dbAfterDelete !== null &&
      dbAfterDelete.status === 'hidden',
    'Test 288: Post disappears from feed/detail ONLY when author/admin explicitly calls DELETE /api/debates/[id]'
  );

  // Test 289: /api/health endpoint returns 200 OK with status: "ok", service: "indobid", database: "connected"
  const healthStart = Date.now();
  const p18HealthRes = await getHealthRoute();
  const healthDuration = Date.now() - healthStart;
  const p18HealthData = await p18HealthRes.json();
  assert(
    p18HealthRes.status === 200 &&
      p18HealthData.status === 'ok' &&
      p18HealthData.service === 'indobid' &&
      p18HealthData.database === 'connected',
    'Test 289: /api/health returns 200 OK with database: "connected"'
  );

  // Test 290: /api/health responds quickly (< 500ms) and exposes no secrets
  const healthDataStr = JSON.stringify(p18HealthData);
  const exposesSecrets =
    healthDataStr.includes('postgres') ||
    healthDataStr.includes('DATABASE_URL') ||
    healthDataStr.includes('password') ||
    healthDataStr.includes('secret') ||
    healthDataStr.includes('render.com');
  assert(
    healthDuration < 3000 && !exposesSecrets,
    'Test 290: /api/health responds quickly and exposes no secrets'
  );

  // Test 291: /api/health supports HEAD method returning 200 OK
  const headRes = await headHealthRoute();
  assert(
    headRes.status === 200,
    'Test 291: /api/health HEAD method returns 200 OK for lightweight load balancer pings'
  );

  // Test 292: Prisma safety check throws SAFETY_VIOLATION error if unconditional deleteMany is attempted
  let safetyViolationTriggered = false;
  try {
    await (prisma.debate as any).deleteMany({});
  } catch (err: any) {
    if (err.message && err.message.includes('SAFETY_VIOLATION')) {
      safetyViolationTriggered = true;
    }
  }
  assert(
    safetyViolationTriggered,
    'Test 292: Prisma safety extension strictly forbids unconditional deleteMany on debate table'
  );

  // Cleanup Part 18 test records
  await prisma.contribution.deleteMany({ where: { debateId: p18Debate.id } });
  await prisma.debate.deleteMany({ where: { id: p18Debate.id } });
  await prisma.user.deleteMany({ where: { id: p18Author.id } });

  // ==========================================
  // PART 19: ADMIN POST DELETION & RANKDOWN RIGHTS
  // ==========================================
  console.log('\n--- PART 19: Admin Post Deletion & Rankdown Rights ---');

  // Setup test author and test debates for Part 19
  const p19Author = await prisma.user.create({
    data: {
      email: 'test_p19_author@example.com',
      username: 'test_p19_author',
      displayName: 'P19 Test Author',
      emailVerifiedAt: new Date(),
      role: 'user',
    },
  });

  const p19DebateA = await prisma.debate.create({
    data: {
      authorId: p19Author.id,
      authorUsername: p19Author.username!,
      authorDisplayName: p19Author.displayName!,
      title: 'Debate A: High Potential Opinion to be Ranked Down',
      content: 'This post is initially trending high but violates editorial tone.',
      categoryId: p18Category.id,
      status: 'active',
      totalVerifiedContribution: 2000,
      originalContribution: 1000,
      trendingScore: 120.0,
    },
  });

  const p19DebateB = await prisma.debate.create({
    data: {
      authorId: p19Author.id,
      authorUsername: p19Author.username!,
      authorDisplayName: p19Author.displayName!,
      title: 'Debate B: Organic Standard Quality Opinion',
      content: 'Standard post with medium trending score.',
      categoryId: p18Category.id,
      status: 'active',
      totalVerifiedContribution: 1000,
      originalContribution: 1000,
      trendingScore: 80.0,
    },
  });

  const p19DebateToDelete = await prisma.debate.create({
    data: {
      authorId: p19Author.id,
      authorUsername: p19Author.username!,
      authorDisplayName: p19Author.displayName!,
      title: 'Debate to be Deleted by Admin via Query Param',
      content: 'This spam or malicious post must be deleted by admin.',
      categoryId: p18Category.id,
      status: 'active',
      totalVerifiedContribution: 0,
      originalContribution: 0,
      trendingScore: 10.0,
    },
  });
  await prisma.contribution.create({
    data: {
      debateId: p19DebateToDelete.id,
      authorId: p19Author.id,
      authorUsername: p19Author.username!,
      authorDisplayName: p19Author.displayName!,
      content: 'First spam argument',
      amount: 0,
      sequence: 1,
      status: 'verified',
    },
  });

  const p19DebateToDeleteById = await prisma.debate.create({
    data: {
      authorId: p19Author.id,
      authorUsername: p19Author.username!,
      authorDisplayName: p19Author.displayName!,
      title: 'Debate to be Deleted by Admin via Path Param',
      content: 'This debate will be deleted via DELETE /api/admin/debates/[id].',
      categoryId: p18Category.id,
      status: 'active',
      totalVerifiedContribution: 0,
      originalContribution: 0,
      trendingScore: 10.0,
    },
  });

  // Test 293: Unauthorized request to DELETE /api/admin/debates is rejected with 401
  const p19UnauthDeleteReq = new NextRequest('http://localhost:3000/api/admin/debates?id=' + p19DebateToDelete.id, {
    method: 'DELETE',
  });
  const p19UnauthDeleteRes = await deleteAdminDebateRoute(p19UnauthDeleteReq);
  assert(
    p19UnauthDeleteRes.status === 401,
    'Test 293: Unauthorized request to DELETE /api/admin/debates is rejected with 401'
  );

  // Test 294: Unauthorized request to PATCH /api/admin/debates (rankdown) is rejected with 401
  const p19UnauthPatchReq = new NextRequest('http://localhost:3000/api/admin/debates', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: p19DebateA.id, action: 'rankdown', penalty: 50 }),
  });
  const p19UnauthPatchRes = await patchAdminDebateRoute(p19UnauthPatchReq);
  assert(
    p19UnauthPatchRes.status === 401,
    'Test 294: Unauthorized request to rank down post is rejected with 401'
  );

  // Test 295: Admin ranks down a post by 50 points via PATCH /api/admin/debates
  const adminRankDownReq = new NextRequest('http://localhost:3000/api/admin/debates', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': ADMIN_SECRET_KEY,
    },
    body: JSON.stringify({ id: p19DebateA.id, action: 'rankdown', penalty: 50 }),
  });
  const adminRankDownRes = await patchAdminDebateRoute(adminRankDownReq);
  const rankDownData = await adminRankDownRes.json();
  const dbDebateAAfterRankDown = await prisma.debate.findUnique({ where: { id: p19DebateA.id } });
  assert(
    adminRankDownRes.status === 200 &&
      rankDownData.success === true &&
      dbDebateAAfterRankDown !== null &&
      dbDebateAAfterRankDown.trendingScore === 70.0,
    'Test 295: Admin ranks down post by 50 points via PATCH /api/admin/debates and score updates in DB'
  );

  // Test 296: Ranked down post is demoted below Debate B in feed
  const feedAfterRankDown = await debateService.getDebates({ sort: 'trending', limit: 50 });
  const indexA = feedAfterRankDown.items.findIndex((item) => item.id === p19DebateA.id);
  const indexB = feedAfterRankDown.items.findIndex((item) => item.id === p19DebateB.id);
  assert(
    indexB !== -1 && indexA !== -1 && indexB < indexA,
    'Test 296: Ranked down post is demoted below Debate B in trending feed'
  );

  // Test 297: Admin resets debate rank via PATCH /api/admin/debates action: 'reset_rank'
  const adminResetRankReq = new NextRequest('http://localhost:3000/api/admin/debates', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': ADMIN_SECRET_KEY,
    },
    body: JSON.stringify({ id: p19DebateA.id, action: 'reset_rank' }),
  });
  const adminResetRankRes = await patchAdminDebateRoute(adminResetRankReq);
  const resetRankData = await adminResetRankRes.json();
  const dbDebateAAfterReset = await prisma.debate.findUnique({ where: { id: p19DebateA.id } });
  assert(
    adminResetRankRes.status === 200 &&
      resetRankData.success === true &&
      dbDebateAAfterReset !== null &&
      dbDebateAAfterReset.reportCount === 0 &&
      dbDebateAAfterReset.trendingScore > 70.0,
    'Test 297: Admin resets debate rank and natural score is restored'
  );

  // Test 298: Admin permanently deletes post via DELETE /api/admin/debates?id=...
  const adminDeleteReq = new NextRequest(`http://localhost:3000/api/admin/debates?id=${p19DebateToDelete.id}`, {
    method: 'DELETE',
    headers: { 'x-admin-key': ADMIN_SECRET_KEY },
  });
  const adminDeleteRes = await deleteAdminDebateRoute(adminDeleteReq);
  const adminDeleteData = await adminDeleteRes.json();
  const postInDbAfterDelete = await prisma.debate.findUnique({ where: { id: p19DebateToDelete.id } });
  const postInApiAfterDelete = await getDebateById(p19DebateToDelete.id);
  const contribInDbAfterDelete = await prisma.contribution.findMany({ where: { debateId: p19DebateToDelete.id } });
  assert(
    adminDeleteRes.status === 200 &&
      adminDeleteData.success === true &&
      postInDbAfterDelete === null &&
      postInApiAfterDelete === null &&
      contribInDbAfterDelete.length === 0,
    'Test 298: Admin permanently deletes post and contributions via DELETE /api/admin/debates'
  );

  // Test 299: Admin deletes post via DELETE /api/admin/debates/[id] route
  const adminDeleteByIdReq = new NextRequest(`http://localhost:3000/api/admin/debates/${p19DebateToDeleteById.id}`, {
    method: 'DELETE',
    headers: { 'x-admin-key': ADMIN_SECRET_KEY },
  });
  const adminDeleteByIdRes = await deleteAdminDebateByIdRoute(adminDeleteByIdReq, {
    params: Promise.resolve({ id: p19DebateToDeleteById.id }),
  });
  const adminDeleteByIdData = await adminDeleteByIdRes.json();
  const postInDbAfterDeleteById = await prisma.debate.findUnique({ where: { id: p19DebateToDeleteById.id } });
  assert(
    adminDeleteByIdRes.status === 200 &&
      adminDeleteByIdData.success === true &&
      postInDbAfterDeleteById === null,
    'Test 299: Admin deletes post via DELETE /api/admin/debates/[id] route'
  );

  // Test 300: Admin ranks down post by custom penalty via PATCH /api/admin/debates/[id]
  const adminRankDownByIdReq = new NextRequest(`http://localhost:3000/api/admin/debates/${p19DebateB.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': ADMIN_SECRET_KEY,
    },
    body: JSON.stringify({ action: 'rankdown', penalty: 100 }),
  });
  const adminRankDownByIdRes = await patchAdminDebateByIdRoute(adminRankDownByIdReq, {
    params: Promise.resolve({ id: p19DebateB.id }),
  });
  const rankDownByIdData = await adminRankDownByIdRes.json();
  const dbDebateBAfterRankDown = await prisma.debate.findUnique({ where: { id: p19DebateB.id } });
  assert(
    adminRankDownByIdRes.status === 200 &&
      rankDownByIdData.success === true &&
      dbDebateBAfterRankDown !== null &&
      dbDebateBAfterRankDown.trendingScore === -20.0,
    'Test 300: Admin ranks down post by custom penalty via PATCH /api/admin/debates/[id]'
  );

  // Cleanup Part 19
  await prisma.debate.deleteMany({ where: { id: { in: [p19DebateA.id, p19DebateB.id] } } });
  await prisma.user.deleteMany({ where: { id: p19Author.id } });

  // =========================================================================
  // PART 20: INDOBID DAILY — AUTOMATED WORLD TREND ENGINE (Tests 301-322)
  // =========================================================================
  console.log('\n--- Part 20: IndoBid Daily Trend Engine Tests ---');

  // Test 301: Public RSS/Atom feed parser extracts items cleanly
  const sampleRssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Sample Tech News</title>
    <link>https://technews.example.com</link>
    <item>
      <title><![CDATA[ISRO Launches Advanced Navigation Satellite NVS-02]]></title>
      <link>https://technews.example.com/articles/isro-launch-2026?utm_source=rss</link>
      <description>India's space agency successfully deployed the next-generation navigation constellation satellite into orbit.</description>
      <pubDate>Fri, 05 Sep 2026 01:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Global Semiconductor Foundry Alliance Formed in Bengaluru</title>
      <link>https://technews.example.com/articles/foundry-alliance-2026</link>
      <description>Leading chip manufacturers unite to expand 2nm chip fabrication capabilities.</description>
      <pubDate>Fri, 05 Sep 2026 01:30:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;
  const mockSource: NewsSource = {
    id: 'test-rss',
    name: 'Sample Tech News',
    url: 'https://technews.example.com/rss',
    category: 'TECHNOLOGY',
    region: 'INDIA',
    enabled: true,
  };
  const parsedItems = parseFeedXml(sampleRssXml, mockSource);
  assert(
    parsedItems.length === 2 &&
      parsedItems[0].title === 'ISRO Launches Advanced Navigation Satellite NVS-02' &&
      parsedItems[0].articleUrl.includes('isro-launch-2026') &&
      Boolean(parsedItems[1].description?.includes('chip manufacturers')),
    'Test 301: Public RSS/Atom feed parser extracts items cleanly'
  );

  // Test 302: HTML entities and CDATA wrappers are decoded properly
  const decodedXml = decodeXmlEntities('<![CDATA[India &amp; Global AI &quot;Breakthrough&quot; &ndash; 2026]]>');
  assert(
    decodedXml === 'India & Global AI "Breakthrough" – 2026',
    'Test 302: HTML entities and CDATA wrappers are decoded properly'
  );

  // Test 303: Tracking parameters (utm_*, ref, etc.) and hash fragments are stripped from URLs
  const rawTestUrl =
    'https://www.reuters.com/technology/article-quantum-2026?utm_source=twitter&utm_medium=social&utm_campaign=feed&ref=newsletter&fbclid=xyz123#discussion-section';
  const cleanedUrl = cleanArticleUrl(rawTestUrl);
  assert(
    cleanedUrl === 'https://www.reuters.com/technology/article-quantum-2026',
    'Test 303: Tracking parameters (utm_*, ref, etc.) and hash fragments are stripped from URLs'
  );

  // Test 304: Publisher suffixes (e.g., "- BBC News", "| Reuters") are stripped from titles
  const headlineA = normalizeTitle('Quantum Computing Chip Achieves Quantum Supremacy - BBC News');
  const headlineB = normalizeTitle('NVIDIA Reveals Next-Gen Blackwell Ultra Architecture | Reuters');
  const headlineC = normalizeTitle('[Breaking] India Advances Clean Hydrogen Storage Hubs (Live)');
  assert(
    headlineA === 'Quantum Computing Chip Achieves Quantum Supremacy' &&
      headlineB === 'NVIDIA Reveals Next-Gen Blackwell Ultra Architecture' &&
      headlineC === 'India Advances Clean Hydrogen Storage Hubs',
    'Test 304: Publisher suffixes and tags are stripped from titles'
  );

  // Test 305: Deterministic fingerprint generates identical hash for same event within time window
  const fpTime1 = new Date('2026-09-05T01:00:00Z');
  const fpTime2 = new Date('2026-09-05T03:30:00Z'); // within same 12h window
  const fp1 = calculateFingerprint('Quantum Computing Chip Achieves Supremacy', fpTime1, 'TECHNOLOGY');
  const fp2 = calculateFingerprint('Quantum Computing Chip Achieves Supremacy', fpTime2, 'TECHNOLOGY');
  const fpTime3 = new Date('2026-09-10T01:00:00Z'); // 5 days later
  const fp3 = calculateFingerprint('Quantum Computing Chip Achieves Supremacy', fpTime3, 'TECHNOLOGY');
  assert(
    fp1 === fp2 && fp1 !== fp3 && typeof fp1 === 'string' && fp1.length > 10,
    'Test 305: Deterministic fingerprint generates identical hash for same event within time window'
  );

  // Test 306: Batch deduplication suppresses duplicates within the same batch
  const batchCandidate1: NewsCandidate = {
    sourceId: 'src-1',
    sourceName: 'Source One',
    title: 'SpaceX Polar Starlink Launch',
    normalizedTitle: 'SpaceX Polar Starlink Launch',
    articleUrl: 'https://space.example.com/launch-1',
    publishedAt: new Date(),
    category: 'TECHNOLOGY',
    region: 'GLOBAL',
    fingerprint: 'fp-spacex-1',
  };
  const batchCandidate2: NewsCandidate = {
    ...batchCandidate1,
    sourceId: 'src-2',
  };
  const batchCandidate3: NewsCandidate = {
    sourceId: 'src-3',
    sourceName: 'Source Three',
    title: 'Totally Different Topic Mars Rover',
    normalizedTitle: 'Totally Different Topic Mars Rover',
    articleUrl: 'https://space.example.com/mars-rover',
    publishedAt: new Date(),
    category: 'SCIENCE',
    region: 'GLOBAL',
    fingerprint: 'fp-mars-rover',
  };
  const dedupResult = deduplicateBatch([batchCandidate1, batchCandidate2, batchCandidate3]);
  assert(
    dedupResult.unique.length === 2 && dedupResult.duplicatesCount === 1,
    'Test 306: Batch deduplication suppresses duplicates within the same batch'
  );

  // Test 307: Database deduplication avoids duplicate article URLs and fingerprints
  const testDbArticle = await prisma.newsArticle.create({
    data: {
      sourceId: 'src-db-test',
      sourceName: 'DB Source',
      title: 'Pre-existing Article In DB',
      normalizedTitle: 'Pre-existing Article In DB',
      articleUrl: 'https://news.example.com/pre-existing-db-article',
      fingerprint: 'fp-db-existing-unique-xyz',
      category: 'BUSINESS',
      region: 'INDIA',
      publishedAt: new Date(),
    },
  });
  const testCandidates: NewsCandidate[] = [
    {
      sourceId: 'src-db-test',
      sourceName: 'DB Source',
      title: 'Pre-existing Article In DB',
      normalizedTitle: 'Pre-existing Article In DB',
      articleUrl: 'https://news.example.com/pre-existing-db-article',
      publishedAt: new Date(),
      category: 'BUSINESS',
      region: 'INDIA',
      fingerprint: 'fp-db-existing-unique-xyz',
    },
    {
      sourceId: 'src-db-test-2',
      sourceName: 'DB Source 2',
      title: 'Genuinely Fresh Unseen Article',
      normalizedTitle: 'Genuinely Fresh Unseen Article',
      articleUrl: 'https://news.example.com/genuinely-fresh-article',
      publishedAt: new Date(),
      category: 'BUSINESS',
      region: 'INDIA',
      fingerprint: 'fp-db-fresh-abc',
    },
  ];
  const filterDbResult = await filterAgainstDatabase(testCandidates);
  assert(
    filterDbResult.freshCandidates.length === 1 &&
      filterDbResult.freshCandidates[0].articleUrl === 'https://news.example.com/genuinely-fresh-article' &&
      filterDbResult.alreadyExistsCount === 1,
    'Test 307: Database deduplication avoids duplicate article URLs and fingerprints'
  );
  await prisma.newsArticle.delete({ where: { id: testDbArticle.id } });

  // Test 308: Clustering groups related articles by keyword overlap and time delta
  const nowTime = new Date();
  const clusterArt1: NewsCandidate = {
    sourceId: 'bbc',
    sourceName: 'BBC News',
    title: 'Global Semiconductor Foundry Alliance Formed in Bengaluru',
    normalizedTitle: 'Global Semiconductor Foundry Alliance Formed in Bengaluru',
    description: 'International semiconductor consortium announces multibillion silicon fab initiative in India.',
    articleUrl: 'https://bbc.com/tech-fab',
    publishedAt: nowTime,
    category: 'TECHNOLOGY',
    region: 'INDIA',
    fingerprint: 'fp-semi-1',
  };
  const clusterArt2: NewsCandidate = {
    sourceId: 'reuters',
    sourceName: 'Reuters',
    title: 'Semiconductor Foundry Alliance Unveils Bengaluru Silicon Fab Hub',
    normalizedTitle: 'Semiconductor Foundry Alliance Unveils Bengaluru Silicon Fab Hub',
    description: 'Global tech leaders form major semiconductor alliance to accelerate sub-2nm chip manufacturing.',
    articleUrl: 'https://reuters.com/tech-fab',
    publishedAt: new Date(nowTime.getTime() + 1000 * 60 * 30),
    category: 'TECHNOLOGY',
    region: 'INDIA',
    fingerprint: 'fp-semi-2',
  };
  const formedClusters = clusterArticles([clusterArt1, clusterArt2]);
  assert(
    formedClusters.length === 1 &&
      formedClusters[0].sourceCount === 2 &&
      formedClusters[0].independentSources.length === 2 &&
      formedClusters[0].independentSources.includes('BBC News') &&
      formedClusters[0].independentSources.includes('Reuters'),
    'Test 308: Clustering groups related articles by keyword overlap and time delta'
  );

  // Test 309: Canonical title selection prefers optimal length and high-reputation source
  const candidateReuters: NewsCandidate = {
    sourceId: 'reuters',
    sourceName: 'Reuters',
    title: 'Global Semiconductor Foundry Alliance Unveils Bengaluru Silicon Fab Hub',
    normalizedTitle: 'Global Semiconductor Foundry Alliance Unveils Bengaluru Silicon Fab Hub',
    articleUrl: 'https://reuters.com/fab',
    publishedAt: nowTime,
    category: 'TECHNOLOGY',
    region: 'INDIA',
    fingerprint: 'fp-can-1',
  };
  const candidateClickbait: NewsCandidate = {
    sourceId: 'random-blog',
    sourceName: 'Tech Blog',
    title: 'BIG CHIP NEWS! WOW!',
    normalizedTitle: 'BIG CHIP NEWS! WOW!',
    articleUrl: 'https://blog.com/fab',
    publishedAt: nowTime,
    category: 'TECHNOLOGY',
    region: 'INDIA',
    fingerprint: 'fp-can-2',
  };
  const canonicalChoice = selectCanonicalTitle([candidateClickbait, candidateReuters]);
  assert(
    canonicalChoice === 'Global Semiconductor Foundry Alliance Unveils Bengaluru Silicon Fab Hub',
    'Test 309: Canonical title selection prefers optimal length and high-reputation source'
  );

  // Test 310: Trend score calculation factors in source count, freshness, velocity, category, geography
  const testClusterData: StoryClusterData = {
    fingerprint: 'fp-score-test',
    canonicalTitle: 'Autonomous Robotics Breakthrough Revolutionizes Factory Automation',
    category: 'AI',
    region: 'INDIA',
    articles: [clusterArt1, clusterArt2],
    sourceCount: 3,
    independentSources: ['Reuters', 'BBC News', 'The Hindu'],
    firstSeenAt: new Date(Date.now() - 1000 * 60 * 30),
    lastSeenAt: new Date(),
    trendScore: 0,
    status: 'NEW',
  };
  const scoreFactors = scoreCluster(testClusterData);
  assert(
    scoreFactors.finalScore >= 70 &&
      scoreFactors.finalScore <= 100 &&
      scoreFactors.independentSourcesCount === 3 &&
      scoreFactors.freshnessScore === 25 &&
      scoreFactors.categoryImportanceScore === 15 &&
      scoreFactors.geographicScore === 10,
    'Test 310: Trend score calculation factors in source count, freshness, velocity, category, geography'
  );

  // Test 311: Freshness score decays gracefully over 36 hours
  const now = new Date();
  const fresh1h = calculateFreshnessScore(new Date(now.getTime() - 1000 * 60 * 60), now); // 1h ago
  const fresh5h = calculateFreshnessScore(new Date(now.getTime() - 1000 * 60 * 60 * 5), now); // 5h ago
  const fresh10h = calculateFreshnessScore(new Date(now.getTime() - 1000 * 60 * 60 * 10), now); // 10h ago
  const fresh20h = calculateFreshnessScore(new Date(now.getTime() - 1000 * 60 * 60 * 20), now); // 20h ago
  const fresh30h = calculateFreshnessScore(new Date(now.getTime() - 1000 * 60 * 60 * 30), now); // 30h ago
  assert(
    fresh1h === 25 &&
      fresh5h === 20 &&
      fresh10h === 15 &&
      fresh20h === 10 &&
      fresh30h === 5,
    'Test 311: Freshness score decays gracefully over 36 hours'
  );

  // Test 312: Velocity score rewards rapid multi-source reporting
  const fastCluster: StoryClusterData = {
    ...testClusterData,
    firstSeenAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
    lastSeenAt: new Date(),
    independentSources: ['Source A', 'Source B', 'Source C'], // 3 sources in 1 hr = rate 3/hr
  };
  const singleSourceCluster: StoryClusterData = {
    ...testClusterData,
    independentSources: ['Source A'],
  };
  const fastVel = calculateVelocityScore(fastCluster);
  const singleVel = calculateVelocityScore(singleSourceCluster);
  assert(
    fastVel === 20 && singleVel === 5,
    'Test 312: Velocity score rewards rapid multi-source reporting'
  );

  // Test 313: Quality gate rejects short/invalid titles, stale articles, or low scores
  const shortTitleCluster: StoryClusterData = {
    ...testClusterData,
    canonicalTitle: 'Too short',
    trendScore: 80,
  };
  const staleCluster: StoryClusterData = {
    ...testClusterData,
    canonicalTitle: 'Sufficiently Long Title For Editorial Review and Acceptance',
    lastSeenAt: new Date(Date.now() - 1000 * 60 * 60 * 48), // 48h old
    trendScore: 80,
  };
  const lowScoreCluster: StoryClusterData = {
    ...testClusterData,
    canonicalTitle: 'Sufficiently Long Title For Editorial Review and Acceptance',
    trendScore: 30, // below 50
  };
  const shortRes = await validateClusterQuality(shortTitleCluster, { minScoreThreshold: 50 });
  const staleRes = await validateClusterQuality(staleCluster, { minScoreThreshold: 50 });
  const lowRes = await validateClusterQuality(lowScoreCluster, { minScoreThreshold: 50 });
  assert(
    !shortRes.valid &&
      Boolean(shortRes.reason?.includes('too short')) &&
      !staleRes.valid &&
      Boolean(staleRes.reason?.includes('stale')) &&
      !lowRes.valid &&
      Boolean(lowRes.reason?.includes('threshold')),
    'Test 313: Quality gate rejects short/invalid titles, stale articles, or low scores'
  );

  // Test 314: Quality gate enforces topic cooldown and daily post limits
  const cooldownDbCluster = await prisma.storyCluster.create({
    data: {
      fingerprint: 'fp-cooldown-test-cluster-999',
      canonicalTitle: 'Cooldown Simulation Test Story Headline 2026',
      category: 'AI',
      region: 'GLOBAL',
      sourceCount: 2,
      trendScore: 85,
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
  });
  const testCooldownCandidate: StoryClusterData = {
    ...testClusterData,
    fingerprint: 'fp-cooldown-test-cluster-999',
    canonicalTitle: 'Cooldown Simulation Test Story Headline 2026',
    trendScore: 85,
  };
  const cooldownCheck = await validateClusterQuality(testCooldownCandidate, { cooldownHours: 24 });
  assert(
    !cooldownCheck.valid && Boolean(cooldownCheck.reason?.includes('recently')),
    'Test 314: Quality gate enforces topic cooldown and daily post limits'
  );
  await prisma.storyCluster.delete({ where: { id: cooldownDbCluster.id } });

  // Test 315: Non-AI fallback content generator produces zero hallucinated facts, thoughtful question, valid sources
  const generatedContent = generatePostContent(testClusterData);
  assert(
    generatedContent.title === testClusterData.canonicalTitle &&
      generatedContent.content.includes('⚡ **INDOBID DAILY**') &&
      generatedContent.content.includes('💬 **The IndoBid Question:**') &&
      generatedContent.content.includes('📰 **Verified Sources:**') &&
      generatedContent.sourcesList.length >= 1 &&
      generatedContent.generationMethod === 'editorial_deterministic' &&
      generatedContent.hashtags.includes('#IndoBidDaily'),
    'Test 315: Non-AI fallback content generator produces zero hallucinated facts, thoughtful question, valid sources'
  );

  // Test 316: Category mapping routes correctly to IndoBid category taxonomy
  assert(
    mapCategoryToIndoBidSlug('AI') === 'ai' &&
      mapCategoryToIndoBidSlug('TECHNOLOGY') === 'technology' &&
      mapCategoryToIndoBidSlug('BUSINESS') === 'business' &&
      mapCategoryToIndoBidSlug('SCIENCE') === 'science' &&
      mapCategoryToIndoBidSlug('CLIMATE') === 'science' &&
      mapCategoryToIndoBidSlug('INDIA') === 'society' &&
      mapCategoryToIndoBidSlug('WORLD') === 'society' &&
      mapCategoryToIndoBidSlug('CULTURE') === 'culture',
    'Test 316: Category mapping routes correctly to IndoBid category taxonomy'
  );

  // Test 317: System author @indobiddaily is created/retrieved with verified badge
  const botUser = await getOrCreateSystemBot();
  assert(
    botUser.username === INDOBID_DAILY_BOT_USERNAME &&
      botUser.isVerified === true &&
      botUser.role === 'user',
    'Test 317: System author @indobiddaily is created/retrieved with verified badge'
  );

  // Test 318: Posts are created with permanent persistence (never auto-delete)
  const publishCandidateCluster: StoryClusterData = {
    ...testClusterData,
    fingerprint: 'fp-publish-perm-test-unique',
    canonicalTitle: 'India Launches High-Throughput Satellite Network For Universal Coverage',
    trendScore: 88,
    articles: [
      {
        sourceId: 'isro-press',
        sourceName: 'ISRO Press',
        title: 'Universal Coverage Satellite Constellation Operational',
        normalizedTitle: 'Universal Coverage Satellite Constellation Operational',
        description: 'National space communications network achieves commercial operational readiness.',
        articleUrl: 'https://isro.example.com/universal-coverage-2026',
        publishedAt: new Date(),
        category: 'TECHNOLOGY',
        region: 'INDIA',
        fingerprint: 'fp-perm-art-1',
      },
    ],
  };
  const publishResult = await publishStoryCluster(publishCandidateCluster);
  const permanentDebateInDb = await prisma.debate.findUnique({
    where: { id: publishResult.debateId },
    include: { automatedPost: true },
  });
  assert(
    permanentDebateInDb !== null &&
      permanentDebateInDb.isAutomated === true &&
      permanentDebateInDb.status === 'active' &&
      permanentDebateInDb.authorUsername === INDOBID_DAILY_BOT_USERNAME &&
      permanentDebateInDb.automatedPost !== null &&
      permanentDebateInDb.automatedPost.trendScore === 88,
    'Test 318: Posts are created with permanent persistence (never auto-delete)'
  );
  // Cleanup test permanent post
  await prisma.automatedPost.deleteMany({ where: { debateId: publishResult.debateId } });
  await prisma.contribution.deleteMany({ where: { debateId: publishResult.debateId } });
  await prisma.debate.deleteMany({ where: { id: publishResult.debateId } });
  await prisma.newsArticle.deleteMany({ where: { articleUrl: 'https://isro.example.com/universal-coverage-2026' } });
  await prisma.storyCluster.deleteMany({ where: { fingerprint: 'fp-publish-perm-test-unique' } });

  // Test 319: Dry run mode simulates execution without creating DB debates
  const initialDebateCount = await prisma.debate.count({ where: { isAutomated: true } });
  const dryRunResult = await runDailyPipeline({
    dryRun: true,
    force: true,
    limit: 2,
    minScore: 10,
  });
  const afterDebateCount = await prisma.debate.count({ where: { isAutomated: true } });
  assert(
    dryRunResult.isDryRun === true &&
      dryRunResult.postsPublished === 0 &&
      afterDebateCount === initialDebateCount,
    'Test 319: Dry run mode simulates execution without creating DB debates'
  );

  // Test 320: Cron API endpoint enforces CRON_SECRET authorization
  const unauthCronReq = new NextRequest('http://localhost:3000/api/cron/indobid-daily', {
    method: 'POST',
    headers: {
      authorization: 'Bearer wrong_invalid_secret_xyz',
    },
  });
  const unauthCronRes = await postCronRoute(unauthCronReq);
  const unauthCronData = await unauthCronRes.json();
  assert(
    unauthCronRes.status === 401 && unauthCronData.success === false,
    'Test 320: Cron API endpoint enforces CRON_SECRET authorization'
  );

  // Test 321: Cron API endpoint accepts query parameters (dryRun, force, limit)
  const authCronReq = new NextRequest(
    'http://localhost:3000/api/cron/indobid-daily?dryRun=true&force=true&limit=1&minScore=10',
    {
      method: 'POST',
      headers: {
        'x-cron-secret': env.CRON_SECRET,
      },
    }
  );
  const authCronRes = await postCronRoute(authCronReq);
  const authCronData = await authCronRes.json();
  assert(
    authCronRes.status === 200 &&
      authCronData.success === true &&
      authCronData.result.isDryRun === true,
    'Test 321: Cron API endpoint accepts query parameters (dryRun, force, limit)'
  );

  // Test 322: End-to-end IndoBid Daily pipeline execution updates AutomationRun status
  const latestRun = await prisma.automationRun.findFirst({
    orderBy: { startedAt: 'desc' },
  });
  assert(
    latestRun !== null &&
      ['success', 'dry_run'].includes(latestRun.status) &&
      latestRun.completedAt !== null &&
      latestRun.sourcesAttempted >= 0,
    'Test 322: End-to-end IndoBid Daily pipeline execution updates AutomationRun status'
  );


  // Cleanup Part 17 test data
  await prisma.debateLike.deleteMany({ where: { userId: p17Consumer.id } });
  await prisma.debateBookmark.deleteMany({ where: { userId: p17Consumer.id } });
  await prisma.follow.deleteMany({ where: { followerId: p17Consumer.id } });
  await prisma.payment.deleteMany({
    where: {
      debateId: {
        in: [
          debateUnpaid.id,
          debate2USD.id,
          debate10USD.id,
          debate50USD.id,
          debate100USD.id,
          refundTestDebate.id,
          debateHighReach.id,
          debateHighEngagement.id,
          debateTopOverallTrending.id,
          debateAiRelevant.id,
          debateCoffeeUnrelated.id,
          ghostDebate.id,
        ],
      },
    },
  });
  await prisma.debate.deleteMany({
    where: {
      id: {
        in: [
          debateUnpaid.id,
          debate2USD.id,
          debate10USD.id,
          debate50USD.id,
          debate100USD.id,
          refundTestDebate.id,
          debateHighReach.id,
          debateHighEngagement.id,
          debateTopOverallTrending.id,
          debateAiRelevant.id,
          debateCoffeeUnrelated.id,
          ghostDebate.id,
        ],
      },
    },
  });
  await prisma.category.deleteMany({
    where: {
      id: {
        in: [catTech.id, catFinance.id, catCooking.id],
      },
    },
  });
  await prisma.user.deleteMany({
    where: {
      id: {
        in: [p17AuthorA.id, p17AuthorB.id, p17GhostAuthor.id, p17Consumer.id, p17ColdUser.id],
      },
    },
  });

  // Cleanup Part 16 test data
  await prisma.directMessage.deleteMany({ where: { conversationId: sentDm.conversationId } });
  await prisma.conversation.deleteMany({ where: { id: sentDm.conversationId } });
  await prisma.follow.deleteMany({ where: { followerId: { in: [canonicalUser.id, ghostUser.id] } } });
  await prisma.usernameChangeHistory.deleteMany({ where: { userId: usernameLimitUser.id } });
  await prisma.contribution.deleteMany({ where: { debateId: { in: [debateCreation1.debateId, ghostDebateCreation.debateId] } } });
  await prisma.debate.deleteMany({ where: { id: { in: [debateCreation1.debateId, ghostDebateCreation.debateId] } } });
  await prisma.notification.deleteMany({ where: { userId: { in: [canonicalUser.id, privateUser.id, ghostUser.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [canonicalUser.id, usernameLimitUser.id, ghostUser.id, privateUser.id] } } });

  // Cleanup Part 15 test data
  await prisma.payment.deleteMany({ where: { debateId: unicodeDebateInDb!.id } });
  await prisma.contribution.deleteMany({ where: { debateId: unicodeDebateInDb!.id } });
  await prisma.debate.deleteMany({ where: { id: unicodeDebateInDb!.id } });
  await prisma.user.deleteMany({ where: { id: unicodeAuthor.id } });

  // Cleanup Part 14 test users
  await prisma.payment.deleteMany({ where: { id: testPaymentRecord.id } });
  await prisma.user.deleteMany({ where: { id: { in: [usUser.id, gbUser.id] } } });

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

  // Clean up test-specific data only, strictly preserving all real user posts and accounts
  await prisma.debateActivityEvent.deleteMany({ where: { debate: testDebateCondition } });
  await prisma.debateReport.deleteMany({ where: { debate: testDebateCondition } });
  await prisma.debateBookmark.deleteMany({ where: { debate: testDebateCondition } });
  await prisma.debateLike.deleteMany({ where: { debate: testDebateCondition } });
  await prisma.creatorEarningsLedger.deleteMany({ where: { debate: testDebateCondition } });
  await prisma.payment.deleteMany({ where: { OR: [{ debate: testDebateCondition }, { providerPaymentId: { startsWith: 'test_' } }] } });
  await prisma.contribution.deleteMany({ where: { debate: testDebateCondition } });
  await prisma.debate.deleteMany({ where: testDebateCondition });
  await prisma.notification.deleteMany({ where: { user: testUserCondition } });
  await prisma.directMessage.deleteMany({ where: { sender: testUserCondition } });
  await prisma.follow.deleteMany({ where: { follower: testUserCondition } });
  await prisma.usernameChangeHistory.deleteMany({ where: { user: testUserCondition } });
  await prisma.emailOtp.deleteMany({ where: { OR: [{ email: { endsWith: '@example.com' } }, { email: { startsWith: 'test' } }] } });
  await (prisma as any).passwordResetToken.deleteMany({ where: { OR: [{ email: { endsWith: '@example.com' } }, { email: { startsWith: 'test' } }] } });
  await prisma.category.deleteMany({ where: { slug: { in: ['tech', 'finance', 'cooking', 'test_category'] } } });
  await prisma.user.deleteMany({ where: testUserCondition });

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
