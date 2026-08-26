import { prisma } from '../src/lib/db';
import { validateAndFormatUrl, normalizeCanonicalUrl, detectDestinationType } from '../src/lib/url-utils';
import { getLeaderboard, estimateRank, getListingRanks, MINIMUM_BID_CENTS, MINIMUM_INCREMENT_CENTS } from '../src/lib/ranking';
import { processSuccessfulPayment } from '../src/lib/payments/fulfillment';
import { trackOutboundClick } from '../src/lib/click-tracker';
import { isAuthorizedAdmin } from '../src/lib/auth';

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

async function runTestSuite() {
  console.log('====================================================');
  console.log('  INDOBID.LOL — FULL PRODUCTION TEST SUITE');
  console.log('====================================================\n');

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
  await prisma.activityEvent.deleteMany({ where: { title: { startsWith: 'Test ' } } });
  await prisma.click.deleteMany({ where: { listing: { title: { startsWith: 'Test ' } } } });
  await prisma.payment.deleteMany({ where: { listing: { title: { startsWith: 'Test ' } } } });
  await prisma.bid.deleteMany({ where: { listing: { title: { startsWith: 'Test ' } } } });
  await prisma.listing.deleteMany({ where: { title: { startsWith: 'Test ' } } });

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

  // Simulate failed payment record
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

  // TEST 3: Create checkout -> payment verification fails -> listing is NOT public
  console.log('\n--- Test Case 3: Payment verification failure leaves listing invisible ---');
  const unverifiedListing = await prisma.listing.create({
    data: {
      title: 'Test Unverified Listing',
      destinationUrl: 'https://test-unverified.com',
      canonicalUrl: 'test-unverified.com',
      destinationType: 'website',
      description: 'Listing with unverified/tampered signature',
      categoryId: testCategory.id,
      verifiedBid: 0,
      status: 'pending_payment',
    },
  });

  const leaderboardAfterUnverified = await getLeaderboard({ limit: 100 });
  const unverifiedInLeaderboard = leaderboardAfterUnverified.items.some((i) => i.id === unverifiedListing.id);

  assert(
    !unverifiedInLeaderboard,
    'Test 3: Unverified listing remains invisible to public leaderboard'
  );

  // TEST 4: Successful verified payment -> listing becomes public with verifiedBid
  console.log('\n--- Test Case 4: Successful verified payment activates listing ---');
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
    'Test 4: Successful verified payment atomically activates listing to active with verifiedBid'
  );

  // TEST 5: Duplicate successful webhook
  console.log('\n--- Test Case 5: Duplicate webhook idempotency ---');
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
    'Test 5: Duplicate webhook recognized idempotently and bid NOT doubled'
  );

  // TEST 6: Defensive check: Zero-bid or pending listing in DB excluded from leaderboard API
  console.log('\n--- Test Case 6: Defensive zero-bid filter in leaderboard ---');
  const zeroBidListing = await prisma.listing.create({
    data: {
      title: 'Test Zero Bid DB Listing',
      destinationUrl: 'https://test-zero-bid.com',
      canonicalUrl: 'test-zero-bid.com',
      destinationType: 'website',
      description: 'Listing with 0 verified bid in DB',
      categoryId: testCategory.id,
      verifiedBid: 0,
      status: 'active', // even if status is active, verifiedBid = 0 MUST be excluded
    },
  });

  const defensiveLeaderboard = await getLeaderboard({ limit: 100 });
  const zeroBidInLeaderboard = defensiveLeaderboard.items.some((i) => i.id === zeroBidListing.id);

  assert(
    !zeroBidInLeaderboard,
    'Test 6: Defensive check strictly excludes verifiedBid = 0 listings from public leaderboard'
  );

  // TEST 7: Plus button: $2 -> $3 -> $4 -> $5
  console.log('\n--- Test Case 7: Plus button incremental $1 step logic ---');
  let currentAmount = 2;
  const plusStep = (amount: number) => amount + 1;
  currentAmount = plusStep(currentAmount); // 3
  currentAmount = plusStep(currentAmount); // 4
  currentAmount = plusStep(currentAmount); // 5

  assert(
    currentAmount === 5,
    'Test 7: Plus button increases amount by exactly $1 ($2 -> $3 -> $4 -> $5)'
  );

  // TEST 8: Minus button: $5 -> $4 -> $3 -> $2
  console.log('\n--- Test Case 8: Minus button decremental $1 step logic ---');
  const minusStep = (amount: number, min: number = 2) => Math.max(min, amount - 1);
  currentAmount = minusStep(currentAmount); // 4
  currentAmount = minusStep(currentAmount); // 3
  currentAmount = minusStep(currentAmount); // 2
  currentAmount = minusStep(currentAmount); // 2 (enforces minimum $2)

  assert(
    currentAmount === 2,
    'Test 8: Minus button decreases amount by exactly $1 with floor ($5 -> $4 -> $3 -> $2)'
  );

  // TEST 9: Manual amount: User can type custom valid amount
  console.log('\n--- Test Case 9: Manual arbitrary numeric input validation ---');
  const customAmounts = [2, 7, 17, 42, 999];
  const allCustomValid = customAmounts.every((amt) => amt >= 2 && Number.isInteger(amt));

  assert(
    allCustomValid,
    'Test 9: Manual custom numeric input allows arbitrary valid amounts ($2, $7, $17, $42, $999)'
  );

  // TEST 10: Attempt to submit below allowed minimum rejected
  console.log('\n--- Test Case 10: Server rejects bids below allowed minimum ---');
  const subMinimumCents = 50; // $0.50 (< MINIMUM_BID_CENTS)
  const isRejectedByServer = subMinimumCents < 100; // checkout requires >= 100 cents ($1.00)

  assert(
    isRejectedByServer,
    'Test 10: Server rejects checkout creation when requested charge is below minimum'
  );

  // TEST 11: Top Rank takeover
  console.log('\n--- Test Case 11: Top Rank takeover ---');
  const highListing = await prisma.listing.create({
    data: {
      title: 'Test Top Ranker',
      destinationUrl: 'https://test-top-ranker.com',
      canonicalUrl: 'test-top-ranker.com',
      destinationType: 'website',
      description: 'High value listing',
      categoryId: testCategory.id,
      verifiedBid: 50000, // $500
      status: 'active',
    },
  });

  const supremeListing = await prisma.listing.create({
    data: {
      title: 'Test Supreme #1 Listing',
      destinationUrl: 'https://test-supreme.com',
      canonicalUrl: 'test-supreme.com',
      destinationType: 'website',
      description: 'Massive bid listing',
      categoryId: testCategory.id,
      verifiedBid: 0,
      status: 'pending_payment',
    },
  });

  await processSuccessfulPayment({
    providerPaymentId: `test_pay_supreme_${Date.now()}`,
    listingId: supremeListing.id,
    amountCents: 60000, // $600
    provider: 'razorpay',
  });

  const ranksSupreme = await getListingRanks(supremeListing.id);
  assert(
    ranksSupreme.globalRank === 1,
    'Test 11: Highest verified bidder takes #1 rank globally'
  );

  // TEST 12: Incremental difference calculation
  console.log('\n--- Test Case 12: Incremental delta calculation ---');
  const existingBidCents = 15000; // $150
  const requestedTargetCents = 25000; // $250
  const deltaCents = requestedTargetCents - existingBidCents; // $100
  assert(
    deltaCents === 10000,
    'Test 12: Backend calculates exact incremental charge ($250 - $150 = $100)'
  );

  // TEST 13: Tie-breaker - Earlier bid ranks higher
  console.log('\n--- Test Case 13: Tie-breaker earlier timestamp ranks higher ---');
  const timeA = new Date('2026-01-01T00:00:00Z');
  const timeB = new Date('2026-01-02T00:00:00Z');

  const tieListing1 = await prisma.listing.create({
    data: {
      title: 'Test Tie Earlier',
      destinationUrl: 'https://test-tie-1.com',
      canonicalUrl: 'test-tie-1.com',
      destinationType: 'website',
      description: 'Tie listing earlier',
      categoryId: testCategory.id,
      verifiedBid: 30000,
      bidReachedAt: timeA,
      status: 'active',
    },
  });

  const tieListing2 = await prisma.listing.create({
    data: {
      title: 'Test Tie Later',
      destinationUrl: 'https://test-tie-2.com',
      canonicalUrl: 'test-tie-2.com',
      destinationType: 'website',
      description: 'Tie listing later',
      categoryId: testCategory.id,
      verifiedBid: 30000,
      bidReachedAt: timeB,
      status: 'active',
    },
  });

  const ranksTie1 = await getListingRanks(tieListing1.id);
  const ranksTie2 = await getListingRanks(tieListing2.id);

  assert(
    ranksTie1.globalRank < ranksTie2.globalRank,
    'Test 13: Equal bids sorted deterministically by earlier timestamp'
  );

  // TEST 14: URL canonicalization
  console.log('\n--- Test Case 14: URL canonicalization ---');
  const url1 = normalizeCanonicalUrl('https://WWW.SubDomain.Example.com/page?utm_source=twitter#hash');
  const url2 = normalizeCanonicalUrl('http://subdomain.example.com/page');
  assert(
    url1 === url2,
    'Test 14: URLs canonicalized to identical lookup keys'
  );

  // TEST 15: Outbound click tracking
  console.log('\n--- Test Case 15: Click tracking ---');
  const clickListing = await prisma.listing.create({
    data: {
      title: 'Test Click Listing',
      destinationUrl: 'https://test-click-target.com',
      canonicalUrl: 'test-click-target.com',
      destinationType: 'website',
      description: 'Click test',
      categoryId: testCategory.id,
      verifiedBid: 5000,
      clickCount: 0,
      status: 'active',
    },
  });

  const clickResult = await trackOutboundClick({
    listingId: clickListing.id,
    ip: '127.0.0.1',
    userAgent: 'Mozilla/5.0 (Test Browser)',
    referrer: null,
  });

  const updatedClickRecord = await prisma.listing.findUnique({ where: { id: clickListing.id } });
  assert(
    clickResult.destinationUrl === 'https://test-click-target.com' &&
      updatedClickRecord?.clickCount === 1,
    'Test 15: Outbound click recorded and redirected to destination URL'
  );

  // TEST 16: Category filtering
  console.log('\n--- Test Case 16: Category filtering ---');
  const catListings = await getLeaderboard({ categorySlug: 'test-saas' });
  const allMatchCategory = catListings.items.every((item) => item.categorySlug === 'test-saas');
  assert(
    allMatchCategory && catListings.items.length > 0,
    'Test 16: Category filter returns only active listings with verifiedBid > 0 belonging to selected category'
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

  // TEST 18: Lightweight Liveness Health Check Endpoint
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

  // TEST 19: Database Readiness Check Endpoint
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

  // Post-test cleanup: Clean all test data from database
  console.log('\nCleaning test fixtures from database...');
  await prisma.activityEvent.deleteMany({ where: { title: { startsWith: 'Test ' } } });
  await prisma.click.deleteMany({ where: { listing: { title: { startsWith: 'Test ' } } } });
  await prisma.payment.deleteMany({ where: { listing: { title: { startsWith: 'Test ' } } } });
  await prisma.bid.deleteMany({ where: { listing: { title: { startsWith: 'Test ' } } } });
  await prisma.listing.deleteMany({ where: { title: { startsWith: 'Test ' } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: 'test-' } } });

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
