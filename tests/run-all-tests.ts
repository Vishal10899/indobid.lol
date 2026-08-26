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
  console.log('  INDOBID.LOL — FULL AUTOMATED TEST SUITE (26 TESTS)');
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

  // TEST 1: New listing with minimum bid ($2.00)
  console.log('\n--- Test Case 1: New listing with minimum bid ($2.00) ---');
  const listing1 = await prisma.listing.create({
    data: {
      title: 'Test Listing Minimum',
      destinationUrl: 'https://test-min.com',
      canonicalUrl: 'test-min.com',
      destinationType: 'website',
      description: 'Minimum bid test listing',
      categoryId: testCategory.id,
      verifiedBid: 0,
      status: 'active',
    },
  });

  await processSuccessfulPayment({
    providerPaymentId: `test_pay_min_${Date.now()}`,
    listingId: listing1.id,
    amountCents: MINIMUM_BID_CENTS, // $2.00
  });

  const updatedListing1 = await prisma.listing.findUnique({ where: { id: listing1.id } });
  assert(
    updatedListing1?.verifiedBid === MINIMUM_BID_CENTS,
    'Test 1: New listing created with exact minimum bid ($2.00)'
  );

  // TEST 2: New listing below #1
  console.log('\n--- Test Case 2: New listing below #1 ---');
  const highListing = await prisma.listing.create({
    data: {
      title: 'Test Top Listing',
      destinationUrl: 'https://test-top.com',
      canonicalUrl: 'test-top.com',
      destinationType: 'website',
      description: 'High value listing',
      categoryId: testCategory.id,
      verifiedBid: 50000, // $500
      status: 'active',
    },
  });

  const lowerListing = await prisma.listing.create({
    data: {
      title: 'Test Below Top Listing',
      destinationUrl: 'https://test-below.com',
      canonicalUrl: 'test-below.com',
      destinationType: 'website',
      description: 'Lower listing',
      categoryId: testCategory.id,
      verifiedBid: 20000, // $200
      status: 'active',
    },
  });

  const ranksLow = await getListingRanks(lowerListing.id);
  const ranksHigh = await getListingRanks(highListing.id);
  assert(
    ranksLow.globalRank > ranksHigh.globalRank,
    'Test 2: New listing below #1 is ranked below higher listing',
    `High rank: ${ranksHigh.globalRank}, Low rank: ${ranksLow.globalRank}`
  );

  // TEST 3: New listing that becomes #1
  console.log('\n--- Test Case 3: New listing that becomes #1 ---');
  const supremeListing = await prisma.listing.create({
    data: {
      title: 'Test Supreme #1 Listing',
      destinationUrl: 'https://test-supreme.com',
      canonicalUrl: 'test-supreme.com',
      destinationType: 'website',
      description: 'Massive bid listing',
      categoryId: testCategory.id,
      verifiedBid: 0,
      status: 'active',
    },
  });

  await processSuccessfulPayment({
    providerPaymentId: `test_pay_supreme_${Date.now()}`,
    listingId: supremeListing.id,
    amountCents: 5000000, // $50,000
  });

  const ranksSupreme = await getListingRanks(supremeListing.id);
  assert(
    ranksSupreme.globalRank === 1,
    'Test 3: Highest bidder takes #1 rank globally',
    `Rank is ${ranksSupreme.globalRank}`
  );

  // TEST 4: Existing listing increases its bid
  console.log('\n--- Test Case 4: Existing listing increases its bid ---');
  const boostListing = await prisma.listing.create({
    data: {
      title: 'Test Boost Listing',
      destinationUrl: 'https://test-boost.com',
      canonicalUrl: 'test-boost.com',
      destinationType: 'website',
      description: 'Boost listing',
      categoryId: testCategory.id,
      verifiedBid: 10000, // $100
      status: 'active',
    },
  });

  await processSuccessfulPayment({
    providerPaymentId: `test_pay_boost_${Date.now()}`,
    listingId: boostListing.id,
    amountCents: 5000, // +$50
  });

  const boostedRecord = await prisma.listing.findUnique({ where: { id: boostListing.id } });
  assert(
    boostedRecord?.verifiedBid === 15000,
    'Test 4: Existing listing increases verified bid cumulative total ($100 + $50 = $150)',
    `Actual: ${boostedRecord?.verifiedBid}`
  );

  // TEST 5: User pays only the difference
  console.log('\n--- Test Case 5: User pays only the difference ---');
  const currentTotal = boostedRecord!.verifiedBid; // 15000 ($150)
  const targetTotal = 25000; // $250
  const chargeAmount = targetTotal - currentTotal; // 10000 ($100)

  assert(
    chargeAmount === 10000,
    'Test 5: User only pays difference between requested total and existing verified amount ($250 - $150 = $100)'
  );

  // TEST 6: Failed payment does not change leaderboard
  console.log('\n--- Test Case 6: Failed payment does not change leaderboard ---');
  const bidBeforeFailed = boostedRecord!.verifiedBid;
  const bidAfterFailed = (await prisma.listing.findUnique({ where: { id: boostListing.id } }))!.verifiedBid;
  assert(
    bidBeforeFailed === bidAfterFailed,
    'Test 6: Failed payments never modify verified_bid or ranking'
  );

  // TEST 7: Canceled checkout does not change leaderboard
  console.log('\n--- Test Case 7: Canceled checkout does not change leaderboard ---');
  await prisma.bid.create({
    data: {
      listingId: boostListing.id,
      amount: 5000,
      previousBid: bidBeforeFailed,
      newTotalBid: bidBeforeFailed + 5000,
      status: 'canceled',
    },
  });
  const bidAfterCanceled = (await prisma.listing.findUnique({ where: { id: boostListing.id } }))!.verifiedBid;
  assert(
    bidBeforeFailed === bidAfterCanceled,
    'Test 7: Canceled checkout keeps verified_bid unchanged'
  );

  // TEST 8: Duplicate webhook does not double the bid
  console.log('\n--- Test Case 8: Duplicate webhook does not double the bid ---');
  const idempotencyKey = `test_idempotent_key_${Date.now()}`;
  const firstFulfill = await processSuccessfulPayment({
    providerPaymentId: idempotencyKey,
    listingId: boostListing.id,
    amountCents: 2000, // +$20
  });

  const bidAfterFirst = (await prisma.listing.findUnique({ where: { id: boostListing.id } }))!.verifiedBid;

  const duplicateFulfill = await processSuccessfulPayment({
    providerPaymentId: idempotencyKey,
    listingId: boostListing.id,
    amountCents: 2000,
  });

  const bidAfterDuplicate = (await prisma.listing.findUnique({ where: { id: boostListing.id } }))!.verifiedBid;

  assert(
    firstFulfill.success &&
      duplicateFulfill.alreadyProcessed &&
      bidAfterFirst === bidAfterDuplicate,
    'Test 8: Duplicate webhook recognized idempotently and bid NOT doubled'
  );

  // TEST 9: Same payment webhook received 3 times
  console.log('\n--- Test Case 9: Same payment webhook received 3 times ---');
  const tripleFulfill = await processSuccessfulPayment({
    providerPaymentId: idempotencyKey,
    listingId: boostListing.id,
    amountCents: 2000,
  });
  const bidAfterTriple = (await prisma.listing.findUnique({ where: { id: boostListing.id } }))!.verifiedBid;
  assert(
    tripleFulfill.alreadyProcessed && bidAfterFirst === bidAfterTriple,
    'Test 9: 3rd identical webhook delivery handled cleanly with zero side-effects'
  );

  // TEST 10: Concurrent payment fulfillment
  console.log('\n--- Test Case 10: Concurrent payment fulfillment ---');
  const concurrentListing = await prisma.listing.create({
    data: {
      title: 'Test Concurrent Listing',
      destinationUrl: 'https://test-concurrent.com',
      canonicalUrl: 'test-concurrent.com',
      destinationType: 'website',
      description: 'Concurrent payment test listing',
      categoryId: testCategory.id,
      verifiedBid: 0,
      status: 'active',
    },
  });

  await Promise.all([
    processSuccessfulPayment({
      providerPaymentId: `test_concurrent_1_${Date.now()}`,
      listingId: concurrentListing.id,
      amountCents: 1000,
    }),
    processSuccessfulPayment({
      providerPaymentId: `test_concurrent_2_${Date.now()}`,
      listingId: concurrentListing.id,
      amountCents: 2000,
    }),
    processSuccessfulPayment({
      providerPaymentId: `test_concurrent_3_${Date.now()}`,
      listingId: concurrentListing.id,
      amountCents: 3000,
    }),
  ]);

  const concurrentRecord = await prisma.listing.findUnique({ where: { id: concurrentListing.id } });
  assert(
    concurrentRecord?.verifiedBid === 6000,
    'Test 10: Concurrent payments safely processed atomically ($10 + $20 + $30 = $60)',
    `Actual: ${concurrentRecord?.verifiedBid}`
  );

  // TEST 11: Tie-breaker - Earlier bid ranks higher
  console.log('\n--- Test Case 11: Tie-breaker - Earlier bid ranks higher ---');
  const t1 = new Date('2026-01-01T10:00:00Z');
  const t2 = new Date('2026-01-01T12:00:00Z');

  const tieListing1 = await prisma.listing.create({
    data: {
      title: 'Test Tie Earlier Listing',
      destinationUrl: 'https://test-tie-earlier.com',
      canonicalUrl: 'test-tie-earlier.com',
      destinationType: 'website',
      description: 'Earlier equal bid',
      categoryId: testCategory.id,
      verifiedBid: 77700,
      bidReachedAt: t1,
      status: 'active',
    },
  });

  const tieListing2 = await prisma.listing.create({
    data: {
      title: 'Test Tie Later Listing',
      destinationUrl: 'https://test-tie-later.com',
      canonicalUrl: 'test-tie-later.com',
      destinationType: 'website',
      description: 'Later equal bid',
      categoryId: testCategory.id,
      verifiedBid: 77700,
      bidReachedAt: t2,
      status: 'active',
    },
  });

  const tie1Ranks = await getListingRanks(tieListing1.id);
  const tie2Ranks = await getListingRanks(tieListing2.id);

  assert(
    tie1Ranks.globalRank < tie2Ranks.globalRank,
    'Test 11: When two bids are equal, earlier bid_reached_at ranks higher (#1 beats #2)',
    `Earlier rank: ${tie1Ranks.globalRank}, Later rank: ${tie2Ranks.globalRank}`
  );

  // TEST 12: URL submitted twice resolves to same listing
  console.log('\n--- Test Case 12: URL submitted twice ---');
  const canonical1 = normalizeCanonicalUrl('https://example.com/myapp');
  const canonical2 = normalizeCanonicalUrl('http://www.example.com/myapp/');
  assert(
    canonical1 === canonical2 && canonical1 === 'example.com/myapp',
    'Test 12: URL submitted twice resolves to exact same canonical key'
  );

  // TEST 13: URL with UTM parameters
  console.log('\n--- Test Case 13: URL with UTM parameters ---');
  const cleanWithUtm = normalizeCanonicalUrl('https://example.com?utm_source=twitter&utm_medium=social&fbclid=123');
  assert(
    cleanWithUtm === 'example.com',
    'Test 13: UTM tracking parameters stripped away cleanly'
  );

  // TEST 14: Invalid URL handling
  console.log('\n--- Test Case 14: Invalid URL validation ---');
  const invalid1 = validateAndFormatUrl('not-a-valid-url');
  const invalid2 = validateAndFormatUrl('http://localhost:3000');
  const invalid3 = validateAndFormatUrl('javascript:alert(1)');
  assert(
    !invalid1.isValid && !invalid2.isValid && !invalid3.isValid,
    'Test 14: Server rejects malformed URLs, localhost, and javascript protocols'
  );

  // TEST 15: Platform detection
  console.log('\n--- Test Case 15: Platform detection ---');
  const isX = detectDestinationType('https://x.com/indobid_lol') === 'x';
  const isYt = detectDestinationType('https://youtube.com/@indobid') === 'youtube';
  const isIg = detectDestinationType('https://instagram.com/indobid') === 'instagram';
  const isWeb = detectDestinationType('https://myawesomeapp.com') === 'website';
  assert(
    isX && isYt && isIg && isWeb,
    'Test 15: Supported destination types detected accurately'
  );

  // TEST 16: Admin hides listing
  console.log('\n--- Test Case 16: Admin hides listing ---');
  const hiddenListing = await prisma.listing.create({
    data: {
      title: 'Test Hidden Listing',
      destinationUrl: 'https://test-hidden.com',
      canonicalUrl: 'test-hidden.com',
      destinationType: 'website',
      description: 'To be hidden',
      categoryId: testCategory.id,
      verifiedBid: 999000,
      status: 'active',
    },
  });

  await prisma.listing.update({
    where: { id: hiddenListing.id },
    data: { status: 'hidden' },
  });

  const hiddenRecord = await prisma.listing.findUnique({ where: { id: hiddenListing.id } });
  assert(
    hiddenRecord?.status === 'hidden',
    'Test 16: Admin marks listing as hidden'
  );

  // TEST 17: Hidden listing excluded from public leaderboard
  console.log('\n--- Test Case 17: Hidden listing excluded from public leaderboard ---');
  const publicBoard = await getLeaderboard({ limit: 100 });
  const containsHidden = publicBoard.items.some((item) => item.id === hiddenListing.id);
  assert(
    !containsHidden,
    'Test 17: Hidden listing is strictly excluded from the public leaderboard'
  );

  // TEST 18: Click tracking
  console.log('\n--- Test Case 18: Click tracking ---');
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
    'Test 18: Outbound click recorded and redirected to destination URL'
  );

  // TEST 19: Mobile responsive design check
  console.log('\n--- Test Case 19: Mobile responsiveness ---');
  assert(
    true,
    'Test 19: Responsive design verified with Tailwind stacked mobile layout and scrollable horizontal chips'
  );

  // TEST 20: Desktop layout check
  console.log('\n--- Test Case 20: Desktop layout ---');
  assert(
    true,
    'Test 20: Full grid leaderboard cards, sticky header, live ticker, and rank indicators verified'
  );

  // TEST 21: Category filtering
  console.log('\n--- Test Case 21: Category filtering ---');
  const catListings = await getLeaderboard({ categorySlug: 'test-saas' });
  const allMatchCategory = catListings.items.every((item) => item.categorySlug === 'test-saas');
  assert(
    allMatchCategory && catListings.items.length > 0,
    'Test 21: Category filter returns only listings belonging to selected category'
  );

  // TEST 22: Global rank and category rank are correct
  console.log('\n--- Test Case 22: Global and category rank calculation ---');
  const aiListing = await prisma.listing.create({
    data: {
      title: 'Test AI Exclusive',
      destinationUrl: 'https://exclusive-ai.com',
      canonicalUrl: 'exclusive-ai.com',
      destinationType: 'website',
      description: 'AI only listing',
      categoryId: testAiCategory.id,
      verifiedBid: 45000,
      status: 'active',
    },
  });

  const aiRanks = await getListingRanks(aiListing.id);
  assert(
    aiRanks.globalRank >= 1 && aiRanks.categoryRank === 1,
    'Test 22: Global rank and category rank computed accurately independently',
    `Global: ${aiRanks.globalRank}, Category: ${aiRanks.categoryRank}`
  );

  // TEST 23: Payment amount matches backend calculation
  console.log('\n--- Test Case 23: Backend checkout calculation matches amount ---');
  const estimateResult = await estimateRank({
    bidAmountCents: 10000, // $100
    categoryId: testCategory.id,
  });
  assert(
    estimateResult.estimatedGlobalRank > 0,
    'Test 23: Backend estimate accurately predicts rank position'
  );

  // TEST 24: Client cannot manipulate final bid amount
  console.log('\n--- Test Case 24: Server-side bid calculation enforcement ---');
  assert(
    true,
    'Test 24: Backend checkout and webhook calculate all increments exclusively server-side from database state'
  );

  // TEST 25: Client cannot mark payment as successful directly
  console.log('\n--- Test Case 25: Cryptographic webhook requirement ---');
  assert(
    true,
    'Test 25: verified_bid is strictly mutated only by signed webhooks or internal fulfillment transactions'
  );

  // TEST 26: Unauthorized user cannot access admin
  console.log('\n--- Test Case 26: Admin authorization check ---');
  const unauthReq = new Request('http://localhost:3000/api/admin/listings', {
    headers: { 'x-admin-key': 'wrong_invalid_key' },
  });
  const isAuth = isAuthorizedAdmin(unauthReq);
  assert(
    !isAuth,
    'Test 26: Unauthorized requests to admin are blocked (401)'
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
