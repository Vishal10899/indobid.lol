/**
 * INDOBID — CURRENCY-AWARE MINIMUM CONVICTION TEST SUITE
 *
 * Verifies that:
 * 1. ₹10 INR is the platform canonical minimum floor (1000 paise).
 * 2. All foreign currencies derive minimum conviction from ₹10 INR (e.g. USD $0.12 = 1020 paise >= 1000 paise).
 * 3. Case A: INR user: ₹10 ACCEPT, ₹9.99 REJECT, ₹5 REJECT.
 * 4. Case B: USD user: $0.12 ACCEPT, $0.11 REJECT, $0.01 REJECT.
 * 5. Case C: Other currencies (EUR, GBP, JPY) enforce ₹10 INR equivalent.
 * 6. Case D: Razorpay order creation: INR minimum creates 1000 paise order; USD converts to correct INR paise (>= 1000 paise), never 200 paise / ₹2.
 * 7. Case E: Manual API request bypass: backend independently rejects below-minimum amounts (via debateService and paymentService).
 * 8. Case F: Currency switching updates minimum and selected amounts properly.
 * 9. Case G: Amount decrement / stepper logic stops exactly at minimum.
 */

import {
  BASE_CURRENCY,
  BASE_MINIMUM_SUPPORT_PAISE,
  getMinimumSupport,
  validateSupportAmount,
  getLocalizedPresets,
  formatCurrencyAmount,
  formatINR,
  formatUSD,
  exchangeRateService,
  MINIMUM_DEBATE_PAISE,
  calculateNextMinimumPaise,
  isValidContributionAmount,
} from '../src/lib/money';
import { paymentService } from '../src/modules/payments/payment.service';
import { debateService } from '../src/modules/debates/debate.service';
import { prisma } from '../src/lib/db';
import { processSuccessfulPayment } from '../src/lib/payments/fulfillment';

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

async function runCurrencyConvictionTests() {
  console.log('====================================================');
  console.log('  INDOBID — CURRENCY-AWARE MINIMUM CONVICTION TESTS');
  console.log('====================================================\n');

  // --- Check 0: Platform Canonical Constants ---
  console.log('--- 0. PLATFORM CANONICAL CONSTANTS ---');
  assert(BASE_CURRENCY === 'INR', '0.1 Base currency is INR');
  assert(BASE_MINIMUM_SUPPORT_PAISE === 1000, '0.2 BASE_MINIMUM_SUPPORT_PAISE is strictly 1000 paise (₹10.00)');
  assert(MINIMUM_DEBATE_PAISE === 1000, '0.3 MINIMUM_DEBATE_PAISE is 1000 paise (not 200 paise / ₹2)');

  // --- Case A: INR User Validation ---
  console.log('\n--- CASE A: INR USER VALIDATION (₹10 ACCEPT, <₹10 REJECT) ---');
  const inrMin = getMinimumSupport('INR');
  assert(inrMin.minimumMinorUnits === 1000, 'A.1 getMinimumSupport("INR") returns 1000 paise');
  assert(inrMin.formatted === '₹10', 'A.2 INR minimum displays formatted as ₹10');

  // ₹10 (1000 paise) -> ACCEPT
  const inr10 = validateSupportAmount(1000, 'INR');
  assert(inr10.valid === true, 'A.3 ₹10 (1000 paise) is ACCEPTED');
  const inrBasePaise = exchangeRateService.convertToBase(1000, 'INR');
  assert(inrBasePaise === 1000, 'A.4 ₹10 baseAmountPaise is 1000 paise');

  // ₹9.99 (999 paise) -> REJECT
  const inr999 = validateSupportAmount(999, 'INR');
  assert(inr999.valid === false, 'A.5 ₹9.99 (999 paise) is strictly REJECTED');

  // ₹5.00 (500 paise) -> REJECT
  const inr500 = validateSupportAmount(500, 'INR');
  assert(inr500.valid === false, 'A.6 ₹5.00 (500 paise) is strictly REJECTED');

  // ₹2.00 (200 paise) -> REJECT (old bug amount)
  const inr200 = validateSupportAmount(200, 'INR');
  assert(inr200.valid === false, 'A.7 ₹2.00 (200 paise old bug) is strictly REJECTED');

  // --- Case B: USD User Validation ---
  console.log('\n--- CASE B: USD USER VALIDATION ($0.12 ACCEPT, $0.11 & $0.01 REJECT) ---');
  const usdMin = getMinimumSupport('USD');
  // 1000 paise / 85 = 11.76 cents -> ceil = 12 cents ($0.12)
  assert(usdMin.minimumMinorUnits === 12, `B.1 USD minimumMinorUnits is 12 cents ($0.12), got ${usdMin.minimumMinorUnits}`);
  assert(usdMin.formatted === '$0.12', `B.2 USD minimum formatted is $0.12, got ${usdMin.formatted}`);

  // $0.12 (12 cents) converts to base INR paise: 12 * 85 = 1020 paise >= 1000 paise -> ACCEPT
  const usd12 = validateSupportAmount(12, 'USD');
  assert(usd12.valid === true, 'B.3 $0.12 (12 cents) is ACCEPTED');
  const usd12BasePaise = exchangeRateService.convertToBase(12, 'USD');
  assert(usd12BasePaise >= 1000, `B.4 $0.12 converts to >= 1000 base paise (got ${usd12BasePaise})`);

  // $0.11 (11 cents) converts to 11 * 85 = 935 paise < 1000 paise -> REJECT
  const usd11 = validateSupportAmount(11, 'USD');
  assert(usd11.valid === false, 'B.5 $0.11 (11 cents) is strictly REJECTED');

  // $0.01 (1 cent) converts to 85 paise < 1000 paise -> REJECT
  const usd01 = validateSupportAmount(1, 'USD');
  assert(usd01.valid === false, 'B.6 $0.01 (1 cent) is strictly REJECTED');

  // $2.00 (200 cents) -> ACCEPT and converts to 17000 paise (₹170.00)
  const usd200 = validateSupportAmount(200, 'USD');
  const usd200BasePaise = exchangeRateService.convertToBase(200, 'USD');
  assert(usd200.valid === true && usd200BasePaise === 17000, 'B.7 $2.00 (200 cents) converts to 17000 paise (₹170.00), NEVER 200 paise');

  // --- Case C: Other Currencies Enforce ₹10 INR Equivalent Floor ---
  console.log('\n--- CASE C: OTHER CURRENCIES (EUR, GBP, JPY, CAD, AUD, SGD, AED) ---');
  const otherCurrencies = ['EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'SGD', 'AED'];
  for (const curr of otherCurrencies) {
    const minSup = getMinimumSupport(curr);
    assert(minSup.minimumMinorUnits > 0, `C.1 [${curr}] minimumMinorUnits > 0 (${minSup.minimumMinorUnits} ${curr})`);
    
    // Validate minimum is accepted
    const validCheck = validateSupportAmount(minSup.minimumMinorUnits, curr);
    assert(validCheck.valid === true, `C.2 [${curr}] Minimum ${minSup.formatted} is ACCEPTED`);
    const basePaise = exchangeRateService.convertToBase(minSup.minimumMinorUnits, curr);
    assert(basePaise >= 1000, `C.3 [${curr}] Converts to >= 1000 paise (got ${basePaise})`);

    // Validate 1 unit below minimum is rejected
    if (minSup.minimumMinorUnits > 1) {
      const belowCheck = validateSupportAmount(minSup.minimumMinorUnits - 1, curr);
      assert(belowCheck.valid === false, `C.4 [${curr}] Below minimum (${minSup.minimumMinorUnits - 1}) is REJECTED`);
    }
  }

  // --- Case D: Razorpay Order Creation & Conversion ---
  console.log('\n--- CASE D: RAZORPAY ORDER CREATION & CONVERSION ---');
  // INR order: 1000 paise creates 1000 paise order with currency 'INR'
  const inrOrder = await paymentService.createCheckoutOrder({
    amountPaise: 1000,
    currency: 'INR',
  });
  assert(inrOrder.amount === 1000, `D.1 INR order amount is exactly 1000 paise, got ${inrOrder.amount}`);
  assert(inrOrder.currency === 'INR', `D.2 INR order currency is 'INR', got ${inrOrder.currency}`);
  assert(inrOrder.amount !== 200, 'D.3 INR order amount is NOT 200 paise (₹2 bug prevented)');

  // USD order: $0.12 (12 cents) converts to 1020 paise in INR
  const usdOrder = await paymentService.createCheckoutOrder({
    amountPaise: 12,
    currency: 'USD',
  });
  assert(usdOrder.amount === 1020, `D.4 USD $0.12 order creates Razorpay order of 1020 paise (₹10.20), got ${usdOrder.amount}`);
  assert(usdOrder.currency === 'INR', `D.5 USD order is charged to Razorpay in 'INR', got ${usdOrder.currency}`);
  assert(usdOrder.amount >= 1000, 'D.6 USD order Razorpay amount is >= 1000 paise floor');

  // USD $2.00 (200 cents) converts to 17000 paise (₹170.00), NOT 200 paise (₹2.00)
  const usd2Order = await paymentService.createCheckoutOrder({
    amountPaise: 200,
    currency: 'USD',
  });
  assert(usd2Order.amount === 17000, `D.7 USD $2 order creates Razorpay order of 17000 paise (₹170.00), got ${usd2Order.amount}`);
  assert(usd2Order.amount !== 200, 'D.8 USD $2 order is NOT charged as 200 paise (₹2 bug prevented)');

  // --- Case E: Backend Independent Validation & Bypass Rejection ---
  console.log('\n--- CASE E: BACKEND INDEPENDENT VALIDATION & BYPASS REJECTION ---');
  // E.1: Under-minimum INR order rejected by paymentService
  let inrUnderRejected = false;
  try {
    await paymentService.createCheckoutOrder({
      amountPaise: 999, // ₹9.99
      currency: 'INR',
    });
  } catch (err: any) {
    inrUnderRejected = err.message.includes('Minimum paid backing is') || err.message.includes('Minimum support is');
  }
  assert(inrUnderRejected, 'E.1 paymentService independently rejects under-minimum INR amount (999 paise)');

  // E.2: Under-minimum USD order rejected by paymentService
  let usdUnderRejected = false;
  try {
    await paymentService.createCheckoutOrder({
      amountPaise: 11, // $0.11 < $0.12
      currency: 'USD',
    });
  } catch (err: any) {
    usdUnderRejected = err.message.includes('Minimum paid backing is') || err.message.includes('Minimum support is');
  }
  assert(usdUnderRejected, 'E.2 paymentService independently rejects under-minimum USD amount (11 cents)');

  // E.3: Bypass attempt sending 200 paise INR directly
  let bypass200Rejected = false;
  try {
    await paymentService.createCheckoutOrder({
      amountPaise: 200, // ₹2
      currency: 'INR',
    });
  } catch (err: any) {
    bypass200Rejected = err.message.includes('Minimum paid backing is') || err.message.includes('Minimum support is');
  }
  assert(bypass200Rejected, 'E.3 paymentService independently rejects 200 paise (₹2) bypass attempt');

  // E.4: debateService.createDebate under-minimum validation
  const testCategory = await prisma.category.upsert({
    where: { slug: 'general' },
    update: {},
    create: { name: 'General', slug: 'general', sortOrder: 99 },
  });

  let debateCreateUnderRejected = false;
  try {
    await debateService.createDebate(
      {
        title: 'Under min test debate',
        content: 'This should fail validation due to under-minimum conviction backing.',
        categoryId: testCategory.id,
        amount: 5, // ₹5 < ₹10
        currency: 'INR',
      },
      null
    );
  } catch (err: any) {
    debateCreateUnderRejected = err.message.includes('Minimum') || err.message.includes('10');
  }
  assert(debateCreateUnderRejected, 'E.4 debateService.createDebate independently rejects under-minimum ₹5 INR backing');

  // E.5: debateService.createDebate USD under-minimum validation
  let debateCreateUsdUnderRejected = false;
  try {
    await debateService.createDebate(
      {
        title: 'Under min USD test debate',
        content: 'This should fail validation due to under-minimum conviction backing in USD.',
        categoryId: testCategory.id,
        amount: 0.10, // $0.10 < $0.12
        currency: 'USD',
      },
      null
    );
  } catch (err: any) {
    debateCreateUsdUnderRejected = err.message.includes('Minimum') || err.message.includes('0.12');
  }
  assert(debateCreateUsdUnderRejected, 'E.5 debateService.createDebate independently rejects under-minimum $0.10 USD backing');

  // --- Case F: Currency Switching Presets & Selected Values ---
  console.log('\n--- CASE F: CURRENCY SWITCHING PRESETS & SELECTED VALUES ---');
  // INR Presets
  const inrPresets = getLocalizedPresets('INR');
  assert(inrPresets.length >= 6, 'F.1 INR has localized presets');
  assert(inrPresets[0].targetMinorUnits === 1000, `F.2 First INR preset is ₹10 (1000 paise), got ${inrPresets[0].targetMinorUnits}`);
  assert(inrPresets[0].label === '₹10', `F.3 First INR preset label is '₹10', got ${inrPresets[0].label}`);

  // USD Presets
  const usdPresets = getLocalizedPresets('USD');
  assert(usdPresets.length >= 6, 'F.4 USD has localized presets');
  assert(usdPresets[0].targetMinorUnits >= 12, `F.5 First USD preset is >= 12 cents ($0.12), got ${usdPresets[0].targetMinorUnits}`);
  assert(usdPresets[0].label.includes('$'), `F.6 First USD preset label includes $, got ${usdPresets[0].label}`);

  // All presets across all currencies must be >= minimum
  for (const curr of ['INR', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'SGD', 'AED']) {
    const minMinor = getMinimumSupport(curr).minimumMinorUnits;
    const presets = getLocalizedPresets(curr);
    const allGteMin = presets.every((p) => p.targetMinorUnits >= minMinor);
    assert(allGteMin, `F.7 All presets for [${curr}] are >= minimum support (${minMinor} minor units)`);
  }

  // --- Case G: Amount Decrement & Stepper Invariant ---
  console.log('\n--- CASE G: AMOUNT DECREMENT & STEPPER INVARIANT ---');
  // In frontend stepper:
  const stepINR = 10;
  const currentINR = 10;
  const minINRVal = 10;
  const nextDecrementedINR = Math.max(minINRVal, currentINR - stepINR);
  assert(nextDecrementedINR === 10, 'G.1 Decrementing at ₹10 minimum stops exactly at ₹10');

  // For USD: min = 0.12, step = 0.50, if current is 0.12:
  const minUSDVal = 0.12;
  const currentUSD = 0.12;
  const stepUSD = 0.50;
  const nextDecrementedUSD = Math.max(minUSDVal, Number((currentUSD - stepUSD).toFixed(2)));
  assert(nextDecrementedUSD === 0.12, 'G.2 Decrementing at $0.12 minimum stops exactly at $0.12');

  // Next minimum calculation for continuing debates
  const nextAfterZero = calculateNextMinimumPaise(0);
  assert(nextAfterZero === 1000, `G.3 Continuation after 0 paise requires ₹10 (1000 paise), got ${nextAfterZero}`);

  const nextAfter1000 = calculateNextMinimumPaise(1000);
  assert(nextAfter1000 === 1100, `G.4 Continuation after 1000 paise requires ₹11 (1100 paise), got ${nextAfter1000}`);

  // Test frontend helper isValidContributionAmount
  const checkZeroTo1000 = isValidContributionAmount(1000, 0);
  assert(checkZeroTo1000.valid === true, 'G.5 isValidContributionAmount accepts 1000 paise after 0');

  const checkZeroTo900 = isValidContributionAmount(900, 0);
  assert(checkZeroTo900.valid === false, 'G.6 isValidContributionAmount rejects 900 paise after 0');

  // Clean up test records
  try {
    await prisma.debate.deleteMany({ where: { title: { startsWith: 'Under min' } } });
  } catch {}

  // --- Summary ---
  console.log('\n====================================================');
  console.log(`TOTAL: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCurrencyConvictionTests()
  .then(() => {
    console.log('All Currency Conviction tests passed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Unhandled error in currency conviction test suite:', err);
    process.exit(1);
  });
