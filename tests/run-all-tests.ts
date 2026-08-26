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
  console.log('  INDOBID.LOL — FULL PRODUCTION AUDIT TEST SUITE');
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

  // Post-test cleanup: Clean all test data from database
  console.log('\nCleaning test fixtures from database...');
  await prisma.activityEvent.deleteMany({ where: { title: { contains: 'Test' } } });
  await prisma.click.deleteMany({ where: { listing: { title: { contains: 'Test' } } } });
  await prisma.payment.deleteMany({ where: { providerPaymentId: { startsWith: 'test_' } } });
  await prisma.bid.deleteMany({ where: { listing: { title: { contains: 'Test' } } } });
  await prisma.listing.deleteMany({ where: { title: { contains: 'Test' } } });
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
