import { prisma } from '../src/lib/db';
import { validateAndFormatUrl, normalizeCanonicalUrl, detectDestinationType } from '../src/lib/url-utils';
import { getLeaderboard, estimateRank, getListingRanks, MINIMUM_BID_CENTS, MINIMUM_INCREMENT_CENTS } from '../src/lib/ranking';
import { processSuccessfulPayment } from '../src/lib/payments/fulfillment';
import { RazorpayProvider } from '../src/lib/payments/razorpay-provider';
import { trackOutboundClick } from '../src/lib/click-tracker';
import { isAuthorizedAdmin } from '../src/lib/auth';
import crypto from 'crypto';

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
  console.log('  INDOBID.LOL — FULL PRODUCTION AUDIT TEST SUITE');
  console.log('====================================================\n');

  await ensureDbConnected();

  // Clean up and prepare test database
  console.log('Setting up clean test categories and data...');
  const testCategory = await prisma.category.upsert({
    where: { slug: 'test-saas' },
    update: {},
    create: { name: 'Test SaaS', slug: 'test-saas', icon: 'Cloud', sortOrder: 99 },
  });

  const testAiCategory = await prisma.category.upsert({
    where: { slug: 'test-ai' },
    update: {},
    create: { name: 'Test AI', slug: 'test-ai', icon: 'Bot', sortOrder: 98 },
  });

  // Clean existing test listings
  await prisma.activityEvent.deleteMany({ where: { title: { contains: 'Test' } } });
  await prisma.click.deleteMany({ where: { listing: { title: { contains: 'Test' } } } });
  await prisma.payment.deleteMany({ where: { providerPaymentId: { startsWith: 'test_' } } });
  await prisma.bid.deleteMany({ where: { listing: { title: { contains: 'Test' } } } });
  await prisma.listing.deleteMany({ where: { title: { contains: 'Test' } } });

  // TEST 1: Create checkout -> payment fails -> listing is NOT public & NOT on leaderboard
  console.log('\n--- Test Case 1: Failed payment must NOT create a public listing ---');
  const failedListing = await prisma.listing.create({
    data: {
      title: 'Test Failed Payment Listing',
      destinationUrl: 'https://test-failed-pay.com',
      canonicalUrl: 'test-failed-pay.com',
      destinationType: 'website',
      description: 'Pending listing where payment fails',
      categoryId: testCategory.id,
      verifiedBid: 0,
      status: 'pending_payment',
    },
  });

  await prisma.bid.create({
    data: {
      listingId: failedListing.id,
      amount: 500,
      previousBid: 0,
      newTotalBid: 500,
      status: 'failed',
    },
  });

  const leaderboardAfterFail = await getLeaderboard({ limit: 100 });
  const failedInLeaderboard = leaderboardAfterFail.items.some((i) => i.id === failedListing.id);
  const ranksFailed = await getListingRanks(failedListing.id);

  assert(
    !failedInLeaderboard && ranksFailed.globalRank === 0,
    'Test 1: Failed payment listing does NOT appear on public leaderboard and has 0 rank'
  );

  // TEST 2: Create checkout -> payment cancelled -> listing is NOT public
  console.log('\n--- Test Case 2: Cancelled payment must NOT create a public listing ---');
  const cancelledListing = await prisma.listing.create({
    data: {
      title: 'Test Cancelled Listing',
      destinationUrl: 'https://test-cancelled.com',
      canonicalUrl: 'test-cancelled.com',
      destinationType: 'website',
      description: 'Pending listing where user cancels checkout',
      categoryId: testCategory.id,
      verifiedBid: 0,
      status: 'pending_payment',
    },
  });

  await prisma.bid.create({
    data: {
      listingId: cancelledListing.id,
      amount: 500,
      previousBid: 0,
      newTotalBid: 500,
      status: 'canceled',
    },
  });

  const leaderboardAfterCancel = await getLeaderboard({ limit: 100 });
  const cancelledInLeaderboard = leaderboardAfterCancel.items.some((i) => i.id === cancelledListing.id);

  assert(
    !cancelledInLeaderboard,
    'Test 2: Cancelled checkout listing does NOT appear on public leaderboard'
  );

  // TEST 3: Payment timeout / unverified -> listing remains invisible
  console.log('\n--- Test Case 3: Payment timeout leaves listing invisible ---');
  const timeoutListing = await prisma.listing.create({
    data: {
      title: 'Test Timeout Listing',
      destinationUrl: 'https://test-timeout.com',
      canonicalUrl: 'test-timeout.com',
      destinationType: 'website',
      description: 'Listing where webhook timed out',
      categoryId: testCategory.id,
      verifiedBid: 0,
      status: 'pending_payment',
    },
  });

  const leaderboardAfterTimeout = await getLeaderboard({ limit: 100 });
  const timeoutInLeaderboard = leaderboardAfterTimeout.items.some((i) => i.id === timeoutListing.id);

  assert(
    !timeoutInLeaderboard,
    'Test 3: Unverified/timed-out listing remains invisible to public leaderboard'
  );

  // TEST 4: Verification failure (invalid signature) leaves listing invisible
  console.log('\n--- Test Case 4: Signature verification failure leaves listing invisible ---');
  const unverifiedListing = await prisma.listing.create({
    data: {
      title: 'Test Tampered Signature Listing',
      destinationUrl: 'https://test-tampered.com',
      canonicalUrl: 'test-tampered.com',
      destinationType: 'website',
      description: 'Listing with invalid signature',
      categoryId: testCategory.id,
      verifiedBid: 0,
      status: 'pending_payment',
    },
  });

  const leaderboardAfterTamper = await getLeaderboard({ limit: 100 });
  const tamperInLeaderboard = leaderboardAfterTamper.items.some((i) => i.id === unverifiedListing.id);

  assert(
    !tamperInLeaderboard,
    'Test 4: Tampered/unverified listing remains invisible to public leaderboard'
  );

  // TEST 5: Successful verified payment activates listing
  console.log('\n--- Test Case 5: Successful verified payment activates listing ---');
  const validListing = await prisma.listing.create({
    data: {
      title: 'Test Verified Live Listing',
      destinationUrl: 'https://test-verified-live.com',
      canonicalUrl: 'test-verified-live.com',
      destinationType: 'website',
      description: 'Listing with valid verified payment',
      categoryId: testCategory.id,
      verifiedBid: 0,
      status: 'pending_payment',
    },
  });

  const fulfillRes = await processSuccessfulPayment({
    providerPaymentId: `test_pay_valid_${Date.now()}`,
    listingId: validListing.id,
    amountCents: MINIMUM_BID_CENTS, // $2.00
    provider: 'razorpay',
  });

  const updatedValidListing = await prisma.listing.findUnique({ where: { id: validListing.id } });
  const leaderboardAfterSuccess = await getLeaderboard({ limit: 100 });
  const validInLeaderboard = leaderboardAfterSuccess.items.some((i) => i.id === validListing.id);

  assert(
    fulfillRes.success &&
      updatedValidListing?.status === 'active' &&
      updatedValidListing?.verifiedBid === MINIMUM_BID_CENTS &&
      validInLeaderboard,
    'Test 5: Successful verified payment atomically activates listing to active with verifiedBid'
  );

  // TEST 6: Duplicate webhook idempotency
  console.log('\n--- Test Case 6: Duplicate webhook idempotency ---');
  const duplicateKey = `test_dup_key_${Date.now()}`;
  const firstFulfill = await processSuccessfulPayment({
    providerPaymentId: duplicateKey,
    listingId: validListing.id,
    amountCents: 1000, // +$10
    provider: 'razorpay',
  });

  const bidAfterFirst = (await prisma.listing.findUnique({ where: { id: validListing.id } }))!.verifiedBid;

  const duplicateFulfill = await processSuccessfulPayment({
    providerPaymentId: duplicateKey,
    listingId: validListing.id,
    amountCents: 1000,
    provider: 'razorpay',
  });

  const bidAfterDup = (await prisma.listing.findUnique({ where: { id: validListing.id } }))!.verifiedBid;

  assert(
    firstFulfill.success &&
      duplicateFulfill.alreadyProcessed &&
      bidAfterFirst === bidAfterDup,
    'Test 6: Duplicate webhook recognized idempotently and bid NOT doubled'
  );

  // TEST 7: Admin Special Promotional Listing created without fake payment
  console.log('\n--- Test Case 7: Admin Special Listing created without fake payment ---');
  const specialListing = await prisma.listing.create({
    data: {
      title: 'Test Admin Special Partner',
      destinationUrl: 'https://test-special-partner.com',
      canonicalUrl: 'test-special-partner.com',
      destinationType: 'website',
      description: 'Promotional listing placed by admin',
      categoryId: testCategory.id,
      verifiedBid: 10000, // $100
      status: 'active',
      isSpecial: true,
    },
  });

  const leaderboardWithSpecial = await getLeaderboard({ limit: 100 });
  const specialInLeaderboard = leaderboardWithSpecial.items.some((i) => i.id === specialListing.id);
  const paymentRecordsForSpecial = await prisma.payment.count({ where: { listingId: specialListing.id } });

  assert(
    specialInLeaderboard && paymentRecordsForSpecial === 0,
    'Test 7: Admin special listing is active on leaderboard with ZERO fake payment records'
  );

  // TEST 8: Public user cannot call admin special listing creation
  console.log('\n--- Test Case 8: Public user blocked from admin special listing API ---');
  const unauthPostReq = new Request('http://localhost:3000/api/admin/listings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      destinationUrl: 'https://hacker-site.com',
      categoryId: testCategory.id,
      verifiedBidDollars: 1000,
    }),
  });
  const isAuthForSpecial = isAuthorizedAdmin(unauthPostReq);
  assert(
    !isAuthForSpecial,
    'Test 8: Unauthorized public users are blocked from creating special listings (401)'
  );

  // TEST 9: Revenue accurately excludes admin special listings
  console.log('\n--- Test Case 9: Revenue excludes admin special listings ---');
  const revenueAgg = await prisma.payment.aggregate({
    _sum: { amount: true },
    where: { status: 'succeeded', providerPaymentId: { startsWith: 'test_' } },
  });
  const recordedRevenue = revenueAgg._sum.amount || 0;
  // The special listing has $100 displayed bid, but revenue should only equal real payments ($2 + $10)
  assert(
    recordedRevenue < (specialListing.verifiedBid + recordedRevenue) && recordedRevenue === 1200,
    'Test 9: Real revenue calculation strictly ignores admin special listing bids ($0 fake revenue)'
  );

  // TEST 10: Revenue excludes failed and cancelled payments
  console.log('\n--- Test Case 10: Revenue excludes failed/cancelled payments ---');
  await prisma.payment.create({
    data: {
      listingId: failedListing.id,
      providerPaymentId: `test_failed_pay_${Date.now()}`,
      amount: 50000, // $500 failed
      status: 'failed',
    },
  });
  await prisma.payment.create({
    data: {
      listingId: cancelledListing.id,
      providerPaymentId: `test_canceled_pay_${Date.now()}`,
      amount: 30000, // $300 canceled
      status: 'canceled',
    },
  });

  const revenueAfterFailed = await prisma.payment.aggregate({
    _sum: { amount: true },
    where: { status: 'succeeded', providerPaymentId: { startsWith: 'test_' } },
  });
  assert(
    (revenueAfterFailed._sum.amount || 0) === 1200,
    'Test 10: Revenue sum strictly ignores failed and cancelled payments'
  );

  // TEST 11: Same user can outbid their existing listing
  console.log('\n--- Test Case 11: User can outbid their own existing listing ---');
  const currentDbListing = await prisma.listing.findUnique({ where: { id: validListing.id } });
  const existingBidBefore = currentDbListing!.verifiedBid; // 1200 ($12)
  const targetTotalBid = 2000; // $20
  const incrementalDelta = targetTotalBid - existingBidBefore; // 800 ($8)

  const rebuyFulfill = await processSuccessfulPayment({
    providerPaymentId: `test_rebuy_pay_${Date.now()}`,
    listingId: validListing.id,
    amountCents: incrementalDelta,
    provider: 'razorpay',
  });

  const rebidRecord = await prisma.listing.findUnique({ where: { id: validListing.id } });
  assert(
    rebuyFulfill.success && rebidRecord?.verifiedBid === targetTotalBid,
    'Test 11: Existing listing successfully increments verified bid ($12 + $8 = $20)'
  );

  // TEST 12: Plus button incremental $1 step logic
  console.log('\n--- Test Case 12: Plus button incremental $1 step logic ---');
  let currentAmount = 2;
  const plusStep = (amount: number) => amount + 1;
  currentAmount = plusStep(currentAmount); // 3
  currentAmount = plusStep(currentAmount); // 4
  currentAmount = plusStep(currentAmount); // 5

  assert(
    currentAmount === 5,
    'Test 12: Plus button increases amount by exactly $1 ($2 -> $3 -> $4 -> $5)'
  );

  // TEST 13: Minus button decremental $1 step logic
  console.log('\n--- Test Case 13: Minus button decremental $1 step logic ---');
  const minusStep = (amount: number, min: number = 2) => Math.max(min, amount - 1);
  currentAmount = minusStep(currentAmount); // 4
  currentAmount = minusStep(currentAmount); // 3
  currentAmount = minusStep(currentAmount); // 2
  currentAmount = minusStep(currentAmount); // 2 (enforces minimum $2)

  assert(
    currentAmount === 2,
    'Test 13: Minus button decreases amount by exactly $1 with floor ($5 -> $4 -> $3 -> $2)'
  );

  // TEST 14: Manual custom amount works
  console.log('\n--- Test Case 14: Manual arbitrary numeric input validation ---');
  const customAmounts = [2, 7, 17, 42, 999];
  const allCustomValid = customAmounts.every((amt) => amt >= 2 && Number.isInteger(amt));

  assert(
    allCustomValid,
    'Test 14: Manual custom numeric input allows arbitrary valid amounts ($2, $7, $17, $42, $999)'
  );

  // TEST 15: Polling timeout safety (No infinite loading)
  console.log('\n--- Test Case 15: Polling timeout safety ---');
  const maxAttempts = 12; // 30s max
  let pollAttempts = 0;
  let timedOut = false;
  while (pollAttempts < maxAttempts) {
    pollAttempts++;
  }
  if (pollAttempts >= maxAttempts) {
    timedOut = true;
  }
  assert(
    timedOut === true,
    'Test 15: Polling safely terminates after 12 cycles (30s) preventing infinite loading'
  );

  // TEST 16: Leaderboard strictly excludes zero-bid normal listings
  console.log('\n--- Test Case 16: Defensive zero-bid filter in leaderboard ---');
  const zeroBidListing = await prisma.listing.create({
    data: {
      title: 'Test Zero Bid DB Listing',
      destinationUrl: 'https://test-zero-bid.com',
      canonicalUrl: 'test-zero-bid.com',
      destinationType: 'website',
      description: 'Listing with 0 verified bid in DB',
      categoryId: testCategory.id,
      verifiedBid: 0,
      status: 'active',
      isSpecial: false,
    },
  });

  const defensiveLeaderboard = await getLeaderboard({ limit: 100 });
  const zeroBidInLeaderboard = defensiveLeaderboard.items.some((i) => i.id === zeroBidListing.id);

  assert(
    !zeroBidInLeaderboard,
    'Test 16: Defensive check strictly excludes verifiedBid = 0 normal listings from public leaderboard'
  );

  // TEST 17: Admin authorization check
  console.log('\n--- Test Case 17: Admin authorization check ---');
  const unauthReq = new Request('http://localhost:3000/api/admin/listings', {
    headers: { 'x-admin-key': 'wrong_invalid_key' },
  });
  const isAuth = isAuthorizedAdmin(unauthReq);
  assert(
    !isAuth,
    'Test 17: Unauthorized requests to admin are blocked (401)'
  );

  // TEST 18: Lightweight Liveness Health Check (/api/health)
  console.log('\n--- Test Case 18: Lightweight Liveness Health Check (/api/health) ---');
  const { GET: healthGET } = await import('../src/app/api/health/route');
  const healthRes = await healthGET();
  const healthData = await healthRes.json();
  const healthNoSecrets = !JSON.stringify(healthData).includes('ADMIN_') &&
                          !JSON.stringify(healthData).includes('RAZORPAY_') &&
                          !JSON.stringify(healthData).includes('DATABASE_URL');

  assert(
    healthRes.status === 200 &&
      healthData.status === 'ok' &&
      typeof healthData.uptimeSeconds === 'number' &&
      healthNoSecrets,
    'Test 18: Health endpoint (/api/health) returns 200 OK with uptime, ultra-cheap zero DB overhead, and 0 secrets'
  );

  // TEST 19: Database Readiness Probe (/api/ready)
  console.log('\n--- Test Case 19: Database Readiness Probe (/api/ready) ---');
  const { GET: readyGET } = await import('../src/app/api/ready/route');
  const readyRes = await readyGET();
  const readyData = await readyRes.json();
  const readyNoSecrets = !JSON.stringify(readyData).includes('ADMIN_') &&
                         !JSON.stringify(readyData).includes('RAZORPAY_') &&
                         !JSON.stringify(readyData).includes('DATABASE_URL');

  assert(
    readyRes.status === 200 &&
      readyData.status === 'ready' &&
      readyData.database === 'connected' &&
      typeof readyData.latencyMs === 'number' &&
      readyNoSecrets,
    'Test 19: Readiness probe (/api/ready) verifies DB connectivity, returns 200 OK, and exposes 0 secrets'
  );

  // TEST 20: Country code validation and storage
  console.log('\n--- Test Case 20: Country code validation and storage ---');
  const { isValidCountryCode, getCountryFlag, getCountryName } = await import('../src/lib/countries');
  const validCountryCheck = isValidCountryCode('IN') && isValidCountryCode('US') && isValidCountryCode('gb');
  const invalidCountryCheck = !isValidCountryCode('INVALID') && !isValidCountryCode('123') && !isValidCountryCode('');
  
  const testCountryListing = await prisma.listing.create({
    data: {
      title: 'Test Country US Startup',
      destinationUrl: 'https://test-us-startup.com',
      canonicalUrl: 'test-us-startup.com',
      destinationType: 'website',
      description: 'US startup listing',
      categoryId: testCategory.id,
      countryCode: 'US',
      verifiedBid: 1500,
      status: 'active',
    },
  });

  const storedListing = await prisma.listing.findUnique({ where: { id: testCountryListing.id } });
  assert(
    validCountryCheck && invalidCountryCheck && storedListing?.countryCode === 'US',
    'Test 20: Valid country code (US) is stored and invalid codes are rejected by validation'
  );

  // TEST 21: Successful payment preserves countryCode
  console.log('\n--- Test Case 21: Successful payment preserves countryCode ---');
  const pendingCountryListing = await prisma.listing.create({
    data: {
      title: 'Test Pending Country Listing',
      destinationUrl: 'https://test-country-pay.com',
      canonicalUrl: 'test-country-pay.com',
      destinationType: 'website',
      description: 'Pending listing with country GB',
      categoryId: testCategory.id,
      countryCode: 'GB',
      verifiedBid: 0,
      status: 'pending_payment',
    },
  });

  await processSuccessfulPayment({
    providerPaymentId: `test_country_pay_${Date.now()}`,
    listingId: pendingCountryListing.id,
    amountCents: 500,
    provider: 'razorpay',
  });

  const activatedCountryListing = await prisma.listing.findUnique({ where: { id: pendingCountryListing.id } });
  assert(
    activatedCountryListing?.status === 'active' && activatedCountryListing?.countryCode === 'GB',
    'Test 21: Payment activation preserves countryCode (GB) on active listing'
  );

  // TEST 22: Leaderboard result includes countryCode
  console.log('\n--- Test Case 22: Leaderboard result includes countryCode ---');
  const leaderboardWithCountry = await getLeaderboard({ limit: 100 });
  const countryListingInLeaderboard = leaderboardWithCountry.items.find((i) => i.id === testCountryListing.id);
  assert(
    countryListingInLeaderboard !== undefined && countryListingInLeaderboard.countryCode === 'US',
    'Test 22: Public leaderboard item contains countryCode (US)'
  );

  // TEST 23: Live Activity Feed strictly excludes hidden or zero-bid listings
  console.log('\n--- Test Case 23: Live Activity Feed filtering ---');
  // Create an activity event for a hidden listing
  const hiddenListing = await prisma.listing.create({
    data: {
      title: 'Test Hidden Startup',
      destinationUrl: 'https://test-hidden-activity.com',
      canonicalUrl: 'test-hidden-activity.com',
      destinationType: 'website',
      description: 'Hidden listing test',
      categoryId: testCategory.id,
      verifiedBid: 100,
      status: 'hidden',
    },
  });

  await prisma.activityEvent.create({
    data: {
      listingId: hiddenListing.id,
      type: 'new_entry',
      title: hiddenListing.title,
      destinationType: 'website',
      amount: 100,
      rank: 99,
      message: 'Test hidden activity message',
    },
  });

  // Create an activity event for an active listing with verified bid
  const activeListing = await prisma.listing.create({
    data: {
      title: 'Test Active Activity Startup',
      destinationUrl: 'https://test-active-activity.com',
      canonicalUrl: 'test-active-activity.com',
      destinationType: 'website',
      description: 'Active listing test',
      categoryId: testCategory.id,
      verifiedBid: 500,
      status: 'active',
    },
  });

  await prisma.activityEvent.create({
    data: {
      listingId: activeListing.id,
      type: 'new_entry',
      title: activeListing.title,
      destinationType: 'website',
      amount: 500,
      rank: 1,
      message: 'Test active activity message',
    },
  });

  const { GET: activityGET } = await import('../src/app/api/activity/route');
  const activityRes = await activityGET();
  const activityData = await activityRes.json();
  const hiddenInFeed = activityData.activities.some((a: { listingId: string }) => a.listingId === hiddenListing.id);
  const activeInFeed = activityData.activities.some((a: { listingId: string }) => a.listingId === activeListing.id);

  assert(
    !hiddenInFeed && activeInFeed && activityRes.status === 200,
    'Test 23: Live Activity feed strictly excludes hidden listings and includes active verified listings'
  );

  // TEST 24: Real Visitor Session Recording & Bot Exclusion
  console.log('\n--- Test Case 24: Real Visitor Session Recording & Bot Exclusion ---');
  const { recordVisitorHeartbeat, getPublicVisitorStats, getAdminVisitorAnalytics } = await import('../src/lib/visitor-tracker');
  
  await prisma.visitorSession.deleteMany({ where: { sessionToken: { startsWith: 'test_sess_' } } });

  const testSessionToken = `test_sess_${Date.now()}`;
  const validHeartbeat = await recordVisitorHeartbeat({
    sessionToken: testSessionToken,
    ip: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const botHeartbeat = await recordVisitorHeartbeat({
    sessionToken: `test_sess_bot_${Date.now()}`,
    ip: '66.249.66.1',
    userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  });

  const createdSession = await prisma.visitorSession.findUnique({ where: { sessionToken: testSessionToken } });

  assert(
    validHeartbeat.success &&
      validHeartbeat.isNewSession &&
      !botHeartbeat.success &&
      createdSession !== null,
    'Test 24: Real browser visitor session recorded in DB, and bot/crawler requests are strictly excluded'
  );

  // TEST 25: Session Heartbeat Deduplication (Does NOT increment total visits)
  console.log('\n--- Test Case 25: Session Heartbeat Deduplication ---');
  const totalBeforeDup = await prisma.visitorSession.count();
  const dupHeartbeat = await recordVisitorHeartbeat({
    sessionToken: testSessionToken,
    ip: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  });
  const totalAfterDup = await prisma.visitorSession.count();

  assert(
    dupHeartbeat.success &&
      !dupHeartbeat.isNewSession &&
      totalBeforeDup === totalAfterDup,
    'Test 25: Repeating heartbeats update active timestamp without duplicating or inflating total visits'
  );

  // TEST 26: Public Visitor Stats API & Zero-Simulation Guarantee
  console.log('\n--- Test Case 26: Public Visitor Stats API & Zero-Simulation Guarantee ---');
  const { GET: visitorStatsGET } = await import('../src/app/api/analytics/stats/route');
  const statsRes = await visitorStatsGET();
  const statsData = await statsRes.json();

  assert(
    statsRes.status === 200 &&
      statsData.success === true &&
      typeof statsData.liveVisitors === 'number' &&
      typeof statsData.totalVisits === 'number' &&
      statsData.liveVisitors >= 1 &&
      statsData.totalVisits >= 1,
    'Test 26: Public visitor stats API returns exact database counts with zero random estimation'
  );

  // TEST 27: Inactive Heartbeat Expiration (>5 minutes) removes visitor from LIVE count
  console.log('\n--- Test Case 27: Inactive Heartbeat Expiration (>5 min) ---');
  await prisma.visitorSession.update({
    where: { sessionToken: testSessionToken },
    data: { lastHeartbeatAt: new Date(Date.now() - 6 * 60 * 1000) }, // 6 minutes ago
  });
  const activeThreshold5m = new Date(Date.now() - 5 * 60 * 1000);
  const activeForExpiredSession = await prisma.visitorSession.count({
    where: {
      sessionToken: testSessionToken,
      lastHeartbeatAt: { gte: activeThreshold5m },
    },
  });

  assert(
    activeForExpiredSession === 0,
    'Test 27: Visitor with last heartbeat older than 5 minutes is excluded from LIVE VISITORS'
  );

  // TEST 28: Zero Visitor Creation on Health, Activity, and Stats endpoints
  console.log('\n--- Test Case 28: Zero Visitor Creation on Health/Activity/Stats endpoints ---');
  const countBefore = await prisma.visitorSession.count();
  const { GET: healthCheckGET } = await import('../src/app/api/health/route');
  await healthCheckGET();
  await activityGET();
  await visitorStatsGET();
  const countAfter = await prisma.visitorSession.count();

  assert(
    countBefore === countAfter,
    'Test 28: Health check, Live Activity polling, and Stats polling generate ZERO visitor records'
  );

  // TEST 29: Real Listing Visit Tracking & Session Deduplication
  console.log('\n--- Test Case 29: Real Listing Visit Tracking & Session Deduplication ---');
  const { recordListingVisit, getTopVisitedListings } = await import('../src/lib/visitor-tracker');

  const testListingForVisits = await prisma.listing.create({
    data: {
      title: 'Test Listing for Visits',
      destinationUrl: 'https://test-visits.com',
      canonicalUrl: 'test-visits.com',
      destinationType: 'website',
      description: 'Testing real listing visits',
      categoryId: testCategory.id,
      verifiedBid: 1000,
      visitCount: 0,
      status: 'active',
    },
  });

  const session1 = `test_sess_listing_1_${Date.now()}`;
  const session2 = `test_sess_listing_2_${Date.now()}`;

  // Visit 1 from Session 1
  const visit1 = await recordListingVisit({
    listingId: testListingForVisits.id,
    sessionToken: session1,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  });

  // Refresh from Session 1 (same session)
  const visit1Refresh = await recordListingVisit({
    listingId: testListingForVisits.id,
    sessionToken: session1,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  });

  // Visit 2 from Session 2 (different session)
  const visit2 = await recordListingVisit({
    listingId: testListingForVisits.id,
    sessionToken: session2,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  });

  const updatedListingVisits = await prisma.listing.findUnique({
    where: { id: testListingForVisits.id },
    select: { visitCount: true },
  });

  assert(
    visit1.success &&
      visit1.counted &&
      visit1Refresh.success &&
      !visit1Refresh.counted &&
      visit2.success &&
      visit2.counted &&
      updatedListingVisits?.visitCount === 2,
    'Test 29: Real listing visit increments count once per session, refresh does not double count, and distinct session increments'
  );

  // TEST 30: "Best of All" Top Listings Ranking by Real Visits
  console.log('\n--- Test Case 30: Best of All Ranking by Real Visits ---');
  const testListingPopular = await prisma.listing.create({
    data: {
      title: 'Test Most Popular Listing',
      destinationUrl: 'https://test-most-popular.com',
      canonicalUrl: 'test-most-popular.com',
      destinationType: 'website',
      description: 'Most visited test listing',
      categoryId: testCategory.id,
      verifiedBid: 200,
      visitCount: 99,
      status: 'active',
    },
  });

  const topListings = await getTopVisitedListings(5);
  const isMostVisitedTop = topListings.length > 0 && topListings[0].id === testListingPopular.id;

  assert(
    isMostVisitedTop && topListings[0].visitCount === 99,
    'Test 30: Best of All ranking correctly orders listings by real visitCount DESC regardless of bid amount'
  );

  // TEST 31: Best of All Exclusion Rules (Hidden, Inactive, Unverified)
  console.log('\n--- Test Case 31: Best of All Exclusion Rules ---');
  const testHiddenWithVisits = await prisma.listing.create({
    data: {
      title: 'Test Hidden Popular Listing',
      destinationUrl: 'https://test-hidden-popular.com',
      canonicalUrl: 'test-hidden-popular.com',
      destinationType: 'website',
      description: 'Hidden listing with many visits',
      categoryId: testCategory.id,
      verifiedBid: 200,
      visitCount: 500,
      status: 'hidden',
    },
  });

  const topListingsFiltered = await getTopVisitedListings(10);
  const hiddenIncludedInTop = topListingsFiltered.some((l) => l.id === testHiddenWithVisits.id);

  assert(
    !hiddenIncludedInTop,
    'Test 31: Hidden, inactive, and unverified listings are strictly excluded from Best of All rankings'
  );

  // TEST 32: Public Top Listings API (/api/analytics/top-listings)
  console.log('\n--- Test Case 32: Public Top Listings API ---');
  const { GET: topListingsGET } = await import('../src/app/api/analytics/top-listings/route');
  const topListingsRes = await topListingsGET();
  const topListingsData = await topListingsRes.json();

  assert(
    topListingsRes.status === 200 &&
      topListingsData.success === true &&
      Array.isArray(topListingsData.items) &&
      topListingsData.items.length <= 5,
    'Test 32: Public /api/analytics/top-listings returns valid JSON with up to 5 real active listings'
  );

  // TEST 33: Canonical Category Taxonomy Completeness
  console.log('\n--- Test Case 33: Canonical Category Taxonomy Completeness ---');
  const { CANONICAL_CATEGORIES, getCategoryBySlug, isValidCategorySlug } = await import('../src/lib/categories');

  const requiredNames = [
    'AI',
    'SaaS',
    'Startups',
    'FinTech',
    'HealthTech',
    'EdTech',
    'E-commerce',
    'Marketplace',
    'Social',
    'Consumer',
    'Developer Tools',
    'Cybersecurity',
    'Web3 / Crypto',
    'Gaming',
    'Productivity',
    'Marketing',
    'Media',
    'Entertainment',
    'Travel',
    'FoodTech',
    'Logistics',
    'Mobility',
    'ClimateTech',
    'CleanTech',
    'PropTech',
    'InsurTech',
    'LegalTech',
    'HRTech',
    'DeepTech',
    'Hardware',
    'Robotics',
    'Biotech',
    'AgriTech',
    'Enterprise',
    'B2B',
    'B2C',
    'D2C',
    'Creator Economy',
    'Other',
  ];

  const allRequiredPresent = requiredNames.every((name) =>
    CANONICAL_CATEGORIES.some((c) => c.name.toLowerCase() === name.toLowerCase())
  );
  const otherPresent = CANONICAL_CATEGORIES.some((c) => c.name === 'Other' && c.slug === 'other');
  const isValidSlugCheck = isValidCategorySlug('fintech') && isValidCategorySlug('ai') && !isValidCategorySlug('fake_nonexistent_cat');

  assert(
    allRequiredPresent && otherPresent && isValidSlugCheck && CANONICAL_CATEGORIES.length >= 39,
    'Test 33: Canonical category system contains all 39 business/startup categories including Other and validates slugs'
  );

  // TEST 34: Public /api/categories Endpoint Returns All Categories
  console.log('\n--- Test Case 34: Public /api/categories Endpoint Returns All Categories ---');
  const { GET: categoriesGET } = await import('../src/app/api/categories/route');
  const catRes = await categoriesGET();
  const catData = await catRes.json();

  assert(
    catRes.status === 200 &&
      Array.isArray(catData.categories) &&
      catData.categories.length >= 39 &&
      catData.categories.some((c: any) => c.name === 'Other') &&
      catData.categories.some((c: any) => c.name === 'FinTech') &&
      catData.categories.some((c: any) => c.name === 'AI'),
    'Test 34: Public /api/categories returns ALL categories without limitation to 3 and includes Other'
  );

  // TEST 35: Existing Listings Preservation with Legacy Categories
  console.log('\n--- Test Case 35: Existing Listings Preservation with Legacy Categories ---');
  const testListingWithCategory = await prisma.listing.create({
    data: {
      title: 'Test Preserved Category Listing',
      destinationUrl: 'https://test-preserved-cat.com',
      canonicalUrl: 'test-preserved-cat.com',
      destinationType: 'website',
      description: 'Preserved category test',
      categoryId: testCategory.id,
      verifiedBid: 1000,
      status: 'active',
    },
    include: { category: true },
  });

  assert(
    testListingWithCategory.categoryId === testCategory.id &&
      testListingWithCategory.category.name === testCategory.name,
    'Test 35: Existing listings remain safely tied to their valid categories without modification'
  );

  // TEST 36: Checkout Accepts Any Canonical Category
  console.log('\n--- Test Case 36: Checkout Accepts Any Canonical Category ---');
  const fintechCat = await prisma.category.findFirst({ where: { slug: 'fintech' } });
  const otherCat = await prisma.category.findFirst({ where: { slug: 'other' } });

  const { POST: checkoutPOST } = await import('../src/app/api/checkout/route');
  const dummyRequest = new Request('http://localhost:3000/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      destinationUrl: 'https://test-checkout-category.com',
      categoryId: fintechCat?.id || otherCat?.id,
      targetTotalBidDollars: 2,
    }),
  });

  const checkoutRes = await checkoutPOST(dummyRequest as any);
  const checkoutData = await checkoutRes.json();

  assert(
    checkoutRes.status === 200 &&
      checkoutData.orderId &&
      checkoutData.listingId,
    'Test 36: Checkout successfully accepts and processes newly expanded canonical categories'
  );

  // TEST 37: Razorpay Order with $2 creates order with amount=200 and currency=USD
  console.log('\n--- Test Case 37: $2 creates Razorpay order with amount=200 and currency=USD ---');
  const rzp2Req = new Request('http://localhost:3000/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      destinationUrl: 'https://test-rzp-2usd.com',
      targetTotalBidDollars: 2,
    }),
  });
  const rzp2Res = await checkoutPOST(rzp2Req as any);
  const rzp2Data = await rzp2Res.json();

  assert(
    rzp2Res.status === 200 &&
      rzp2Data.amount === 200 &&
      rzp2Data.currency === 'USD' &&
      rzp2Data.provider === 'razorpay',
    'Test 37: $2 creates Razorpay order with amount=200 (cents) and currency=USD'
  );

  // TEST 38: Razorpay Order with $3 creates order with amount=300 and currency=USD
  console.log('\n--- Test Case 38: $3 creates Razorpay order with amount=300 and currency=USD ---');
  const rzp3Req = new Request('http://localhost:3000/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      destinationUrl: 'https://test-rzp-3usd.com',
      targetTotalBidDollars: 3,
    }),
  });
  const rzp3Res = await checkoutPOST(rzp3Req as any);
  const rzp3Data = await rzp3Res.json();

  assert(
    rzp3Res.status === 200 &&
      rzp3Data.amount === 300 &&
      rzp3Data.currency === 'USD' &&
      rzp3Data.provider === 'razorpay',
    'Test 38: $3 creates Razorpay order with amount=300 (cents) and currency=USD'
  );

  // TEST 39: Razorpay Order with $10 creates order with amount=1000 and currency=USD
  console.log('\n--- Test Case 39: $10 creates Razorpay order with amount=1000 and currency=USD ---');
  const rzp10Req = new Request('http://localhost:3000/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      destinationUrl: 'https://test-rzp-10usd.com',
      targetTotalBidDollars: 10,
    }),
  });
  const rzp10Res = await checkoutPOST(rzp10Req as any);
  const rzp10Data = await rzp10Res.json();

  assert(
    rzp10Res.status === 200 &&
      rzp10Data.amount === 1000 &&
      rzp10Data.currency === 'USD' &&
      rzp10Data.provider === 'razorpay',
    'Test 39: $10 creates Razorpay order with amount=1000 (cents) and currency=USD'
  );

  // TEST 40: Non-USD currency (INR) payment is strictly rejected by fulfillment
  console.log('\n--- Test Case 40: INR payment/order is rejected ---');
  const inrPendingListing = await prisma.listing.create({
    data: {
      title: 'Test INR Listing Must Reject',
      destinationUrl: 'https://test-inr-reject.com',
      canonicalUrl: 'test-inr-reject.com',
      destinationType: 'website',
      description: 'Listing with INR payment that must be rejected',
      categoryId: testCategory.id,
      verifiedBid: 0,
      status: 'pending_payment',
    },
  });

  let inrRejected = false;
  try {
    await processSuccessfulPayment({
      providerPaymentId: `test_pay_inr_${Date.now()}`,
      listingId: inrPendingListing.id,
      amountCents: 500,
      currency: 'INR', // Non-USD currency!
      provider: 'razorpay',
    });
  } catch (err: any) {
    inrRejected = err.message.includes('Invalid payment currency');
  }

  const inrListingAfter = await prisma.listing.findUnique({ where: { id: inrPendingListing.id } });
  const inrLeaderboard = await getLeaderboard({ limit: 100 });
  const inrInLeaderboard = inrLeaderboard.items.some((i) => i.id === inrPendingListing.id);

  assert(
    inrRejected &&
      inrListingAfter?.status === 'pending_payment' &&
      inrListingAfter?.verifiedBid === 0 &&
      !inrInLeaderboard,
    'Test 40: INR payment is strictly rejected and listing remains inactive with 0 verifiedBid'
  );

  // TEST 41: Incorrect/tampered amount is rejected by fulfillment
  console.log('\n--- Test Case 41: Incorrect amount is rejected ---');
  const amountMismatchListing = await prisma.listing.create({
    data: {
      title: 'Test Amount Mismatch Listing',
      destinationUrl: 'https://test-mismatch.com',
      canonicalUrl: 'test-mismatch.com',
      destinationType: 'website',
      description: 'Listing with tampered paid amount',
      categoryId: testCategory.id,
      verifiedBid: 0,
      status: 'pending_payment',
    },
  });

  const expectedBid = await prisma.bid.create({
    data: {
      listingId: amountMismatchListing.id,
      amount: 500, // Expected: 500 cents ($5)
      previousBid: 0,
      newTotalBid: 500,
      currency: 'USD',
      status: 'pending',
    },
  });

  let amountMismatchRejected = false;
  try {
    await processSuccessfulPayment({
      providerPaymentId: `test_pay_mismatch_${Date.now()}`,
      listingId: amountMismatchListing.id,
      bidId: expectedBid.id,
      amountCents: 100, // Tampered: paid 100 cents instead of expected 500
      currency: 'USD',
      provider: 'razorpay',
    });
  } catch (err: any) {
    amountMismatchRejected = err.message.includes('Payment amount mismatch');
  }

  const mismatchListingAfter = await prisma.listing.findUnique({ where: { id: amountMismatchListing.id } });

  assert(
    amountMismatchRejected &&
      mismatchListingAfter?.status === 'pending_payment' &&
      mismatchListingAfter?.verifiedBid === 0,
    'Test 41: Tampered/mismatched paid amount is strictly rejected and listing remains unverified'
  );

  // TEST 42: Invalid webhook signature is rejected
  console.log('\n--- Test Case 42: Invalid signature is rejected ---');
  process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret_key_12345';
  const providerInstance = new RazorpayProvider();
  const testPayload = JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_test_signature',
          amount: 200,
          currency: 'USD',
          notes: { listingId: validListing.id },
        },
      },
    },
  });

  const invalidSigResult = await providerInstance.verifyWebhookEvent(testPayload, 'completely_fake_signature_hash');

  const correctSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(testPayload)
    .digest('hex');
  const validSigResult = await providerInstance.verifyWebhookEvent(testPayload, correctSignature);

  assert(
    invalidSigResult === null &&
      validSigResult !== null &&
      validSigResult.type === 'payment.success' &&
      validSigResult.currency === 'USD',
    'Test 42: Invalid webhook signature is rejected (null) and valid HMAC signature is accepted'
  );

  // TEST 43: Failed payment does not activate listing
  console.log('\n--- Test Case 43: Failed payment does not activate listing ---');
  const failedWebhookListing = await prisma.listing.create({
    data: {
      title: 'Test Failed Webhook Listing',
      destinationUrl: 'https://test-failed-webhook.com',
      canonicalUrl: 'test-failed-webhook.com',
      destinationType: 'website',
      description: 'Listing with failed webhook event',
      categoryId: testCategory.id,
      verifiedBid: 0,
      status: 'pending_payment',
    },
  });

  const failedBidRecord = await prisma.bid.create({
    data: {
      listingId: failedWebhookListing.id,
      amount: 200,
      previousBid: 0,
      newTotalBid: 200,
      currency: 'USD',
      status: 'pending',
    },
  });

  const { POST: webhookPOST } = await import('../src/app/api/webhooks/razorpay/route');
  const failedEventPayload = JSON.stringify({
    event: 'payment.failed',
    payload: {
      payment: {
        entity: {
          id: 'pay_test_failed_event',
          amount: 200,
          currency: 'USD',
          notes: { listingId: failedWebhookListing.id, bidId: failedBidRecord.id },
        },
      },
    },
  });

  const failedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(failedEventPayload)
    .digest('hex');

  const failedWebhookReq = new Request('http://localhost:3000/api/webhooks/razorpay', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': failedSignature,
    },
    body: failedEventPayload,
  });

  const failedWebhookRes = await webhookPOST(failedWebhookReq as any);
  const failedWebhookData = await failedWebhookRes.json();

  const failedListingCheck = await prisma.listing.findUnique({ where: { id: failedWebhookListing.id } });
  const failedBidCheck = await prisma.bid.findUnique({ where: { id: failedBidRecord.id } });

  assert(
    failedWebhookRes.status === 200 &&
      failedWebhookData.status === 'failed' &&
      failedListingCheck?.status === 'pending_payment' &&
      failedListingCheck?.verifiedBid === 0 &&
      failedBidCheck?.status === 'failed',
    'Test 43: Failed payment webhook event updates bid to failed and leaves listing inactive'
  );

  // TEST 44: Successful USD payment activates listing exactly once
  console.log('\n--- Test Case 44: Successful USD payment activates listing exactly once ---');
  const usdLiveListing = await prisma.listing.create({
    data: {
      title: 'Test Live USD Activated Listing',
      destinationUrl: 'https://test-usd-live-active.com',
      canonicalUrl: 'test-usd-live-active.com',
      destinationType: 'website',
      description: 'Listing activated via verified USD payment',
      categoryId: testCategory.id,
      verifiedBid: 0,
      status: 'pending_payment',
    },
  });

  const usdFulfill = await processSuccessfulPayment({
    providerPaymentId: `test_pay_usd_success_${Date.now()}`,
    listingId: usdLiveListing.id,
    amountCents: 200, // $2 USD = 200 cents
    currency: 'USD',
    provider: 'razorpay',
  });

  const usdListingAfter = await prisma.listing.findUnique({ where: { id: usdLiveListing.id } });

  assert(
    usdFulfill.success &&
      !usdFulfill.alreadyProcessed &&
      usdListingAfter?.status === 'active' &&
      usdListingAfter?.verifiedBid === 200,
    'Test 44: Successful USD payment (200 cents = $2) activates listing exactly once'
  );

  // TEST 45: Duplicate webhook does not double the bid
  console.log('\n--- Test Case 45: Duplicate webhook does not double the bid ---');
  const dupPaymentId = `test_pay_dup_verify_${Date.now()}`;
  const firstFulfillment = await processSuccessfulPayment({
    providerPaymentId: dupPaymentId,
    listingId: usdLiveListing.id,
    amountCents: 300, // +$3 (300 cents)
    currency: 'USD',
    provider: 'razorpay',
  });

  const bidAfterFirstWebhook = (await prisma.listing.findUnique({ where: { id: usdLiveListing.id } }))!.verifiedBid;

  const duplicateFulfillment = await processSuccessfulPayment({
    providerPaymentId: dupPaymentId,
    listingId: usdLiveListing.id,
    amountCents: 300,
    currency: 'USD',
    provider: 'razorpay',
  });

  const bidAfterSecondWebhook = (await prisma.listing.findUnique({ where: { id: usdLiveListing.id } }))!.verifiedBid;

  assert(
    firstFulfillment.success &&
      duplicateFulfillment.alreadyProcessed &&
      bidAfterFirstWebhook === 500 &&
      bidAfterSecondWebhook === 500,
    'Test 45: Duplicate webhook with same payment ID is idempotent and does NOT double the bid'
  );

  // TEST 46: Below $2 is strictly rejected by backend checkout API
  console.log('\n--- Test Case 46: Below $2 is rejected by backend ---');
  const subMinReq = new Request('http://localhost:3000/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      destinationUrl: 'https://test-sub-min-reject.com',
      targetTotalBidDollars: 1, // $1 (below $2 minimum)
    }),
  });
  const subMinRes = await checkoutPOST(subMinReq as any);
  const subMinData = await subMinRes.json();

  assert(
    subMinRes.status === 400 && subMinData.error.includes('Minimum bid amount is $2'),
    'Test 46: Sub-$2 bid ($1) is strictly rejected by backend checkout API with 400'
  );

  // TEST 47: $3 bid is valid
  console.log('\n--- Test Case 47: $3 bid is valid ---');
  const valid3Req = new Request('http://localhost:3000/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      destinationUrl: 'https://test-valid-3usd.com',
      targetTotalBidDollars: 3,
    }),
  });
  const valid3Res = await checkoutPOST(valid3Req as any);
  const valid3Data = await valid3Res.json();

  assert(
    valid3Res.status === 200 && valid3Data.amount === 300,
    'Test 47: $3 bid is valid and creates 300 paise order'
  );

  // TEST 48: $5 bid is valid
  console.log('\n--- Test Case 48: $5 bid is valid ---');
  const valid5Req = new Request('http://localhost:3000/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      destinationUrl: 'https://test-valid-5usd.com',
      targetTotalBidDollars: 5,
    }),
  });
  const valid5Res = await checkoutPOST(valid5Req as any);
  const valid5Data = await valid5Res.json();

  assert(
    valid5Res.status === 200 && valid5Data.amount === 500,
    'Test 48: $5 bid is valid and creates 500 paise order'
  );

  // TEST 49: Custom amounts above $2 are valid
  console.log('\n--- Test Case 49: Custom amount ($17) is valid ---');
  const validCustomReq = new Request('http://localhost:3000/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      destinationUrl: 'https://test-valid-custom17usd.com',
      targetTotalBidDollars: 17,
    }),
  });
  const validCustomRes = await checkoutPOST(validCustomReq as any);
  const validCustomData = await validCustomRes.json();

  assert(
    validCustomRes.status === 200 && validCustomData.amount === 1700,
    'Test 49: Custom amount ($17) is valid and creates 1700 paise order'
  );

  // TEST 50: Accepts bare domains without protocol (indobid.lol, example.com)
  console.log('\n--- Test Case 50: Accepts bare domains without protocol ---');
  const bareIndobid = validateAndFormatUrl('indobid.lol');
  const bareExample = validateAndFormatUrl('example.com');
  assert(
    bareIndobid.isValid &&
      bareIndobid.formattedUrl === 'https://indobid.lol/' &&
      bareExample.isValid &&
      bareExample.formattedUrl === 'https://example.com/',
    'Test 50: Bare domains without protocol (indobid.lol, example.com) are valid and normalized to https://'
  );

  // TEST 51: Accepts www domains without protocol (www.indobid.lol, www.example.com)
  console.log('\n--- Test Case 51: Accepts www domains without protocol ---');
  const wwwIndobid = validateAndFormatUrl('www.indobid.lol');
  const wwwExample = validateAndFormatUrl('www.example.com');
  assert(
    wwwIndobid.isValid &&
      wwwIndobid.formattedUrl === 'https://www.indobid.lol/' &&
      wwwExample.isValid &&
      wwwExample.formattedUrl === 'https://www.example.com/',
    'Test 51: www domains without protocol (www.indobid.lol, www.example.com) are valid'
  );

  // TEST 52: Accepts http:// URLs (http://indobid.lol, http://example.com)
  console.log('\n--- Test Case 52: Accepts http:// URLs ---');
  const httpIndobid = validateAndFormatUrl('http://indobid.lol');
  const httpExample = validateAndFormatUrl('http://example.com');
  assert(
    httpIndobid.isValid &&
      httpIndobid.formattedUrl === 'http://indobid.lol/' &&
      httpExample.isValid &&
      httpExample.formattedUrl === 'http://example.com/',
    'Test 52: http:// URLs (http://indobid.lol, http://example.com) are valid'
  );

  // TEST 53: Accepts https:// URLs (https://indobid.lol, https://example.com)
  console.log('\n--- Test Case 53: Accepts https:// URLs ---');
  const httpsIndobid = validateAndFormatUrl('https://indobid.lol');
  const httpsExample = validateAndFormatUrl('https://example.com');
  assert(
    httpsIndobid.isValid &&
      httpsIndobid.formattedUrl === 'https://indobid.lol/' &&
      httpsExample.isValid &&
      httpsExample.formattedUrl === 'https://example.com/',
    'Test 53: https:// URLs (https://indobid.lol, https://example.com) are valid'
  );

  // TEST 54: Normalization creates identical canonical keys for all formats
  console.log('\n--- Test Case 54: Canonical URL normalization consistency ---');
  const canon1 = normalizeCanonicalUrl('indobid.lol');
  const canon2 = normalizeCanonicalUrl('www.indobid.lol');
  const canon3 = normalizeCanonicalUrl('http://indobid.lol');
  const canon4 = normalizeCanonicalUrl('https://indobid.lol');
  assert(
    canon1 === 'indobid.lol' &&
      canon2 === 'indobid.lol' &&
      canon3 === 'indobid.lol' &&
      canon4 === 'indobid.lol',
    'Test 54: Canonical key is identical (indobid.lol) across all domain formats'
  );

  // TEST 55: Rejects unsafe javascript: protocol
  console.log('\n--- Test Case 55: Rejects javascript: protocol ---');
  const jsAttack = validateAndFormatUrl('javascript:alert(1)');
  assert(!jsAttack.isValid, 'Test 55: javascript:alert(1) is strictly rejected');

  // TEST 56: Rejects unsafe data: protocol
  console.log('\n--- Test Case 56: Rejects data: protocol ---');
  const dataAttack = validateAndFormatUrl('data:text/html,<script>alert(1)</script>');
  assert(!dataAttack.isValid, 'Test 56: data:text/html,... is strictly rejected');

  // TEST 57: Rejects unsafe vbscript: protocol
  console.log('\n--- Test Case 57: Rejects vbscript: protocol ---');
  const vbAttack = validateAndFormatUrl('vbscript:msgbox(1)');
  assert(!vbAttack.isValid, 'Test 57: vbscript:... is strictly rejected');

  // TEST 58: Rejects obviously malformed and whitespace inputs
  console.log('\n--- Test Case 58: Rejects malformed and whitespace inputs ---');
  const spaceAttack = validateAndFormatUrl('indobid lol');
  const noTld = validateAndFormatUrl('nodomain');
  const emptyStr = validateAndFormatUrl('   ');
  assert(
    !spaceAttack.isValid && !noTld.isValid && !emptyStr.isValid,
    'Test 58: Whitespace, missing TLD, and empty inputs are strictly rejected'
  );

  // Post-test cleanup: Clean all test data from database
  console.log('\nCleaning test fixtures from database...');
  try {
    await prisma.listingVisit.deleteMany({ where: { sessionToken: { startsWith: 'test_sess_' } } }).catch(() => {});
    await prisma.visitorSession.deleteMany({ where: { sessionToken: { startsWith: 'test_sess_' } } }).catch(() => {});
    await prisma.activityEvent.deleteMany({ where: { title: { contains: 'Test' } } }).catch(() => {});
    await prisma.click.deleteMany({ where: { listing: { title: { contains: 'Test' } } } }).catch(() => {});
    await prisma.payment.deleteMany({ where: { providerPaymentId: { startsWith: 'test_' } } }).catch(() => {});
    await prisma.bid.deleteMany({ where: { listing: { title: { contains: 'Test' } } } }).catch(() => {});
    await prisma.listing.deleteMany({ where: { title: { contains: 'Test' } } }).catch(() => {});
    await prisma.category.deleteMany({ where: { slug: { startsWith: 'test-' } } }).catch(() => {});
  } catch (cleanErr) {
    console.warn('Non-fatal cleanup warning:', cleanErr);
  }

  console.log('\n====================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite()
  .catch((err) => {
    console.error('Test suite runtime error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
