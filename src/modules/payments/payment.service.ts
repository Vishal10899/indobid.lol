/**
 * INDOBID — PAYMENT SERVICE
 * Manages checkout order creation, signature verification, and atomic transactional fulfillment.
 * Fully integrated with global country/currency resolution and server-side minimum validation.
 */

import { razorpayAdapter, CheckoutSessionOptions, CheckoutSessionResult } from '../../infrastructure/payments/razorpay.adapter';
import { buildSafeRazorpayNotes } from '../../infrastructure/payments/payment-metadata';
import { processSuccessfulPayment, FulfillmentParams, FulfillmentResult } from '../../lib/payments/fulfillment';
import { userRepository } from '../../infrastructure/database/repositories/user.repository';
import { CreateCheckoutDTO } from './payment.types';
import { ValidationError } from '../../lib/errors';
import { appConfig } from '../../config/app';
import {
  getCurrencyForCountry,
  isValidCountryCode,
  getMinimumSupport,
  validateSupportAmount,
  exchangeRateService,
  DEFAULT_COUNTRY,
  BASE_MINIMUM_SUPPORT_PAISE,
  formatINR,
} from '../../lib/money';

export class PaymentService {
  /**
   * Resolves the authoritative country and currency for a user.
   * If userId is provided, the database record is the sole authority (client overrides ignored).
   */
  async resolveUserCountryAndCurrency(userId?: string | null, clientCountryCode?: string | null): Promise<{
    countryCode: string;
    currencyCode: string;
    isAuthoritative: boolean;
  }> {
    if (userId) {
      const user = await userRepository.findById(userId);
      if (user && user.countryCode) {
        return {
          countryCode: user.countryCode,
          currencyCode: user.currencyCode || getCurrencyForCountry(user.countryCode),
          isAuthoritative: true,
        };
      }
    }

    // Guest user fallback with server-side validation
    const rawCountry = clientCountryCode?.trim().toUpperCase();
    const countryCode = rawCountry && isValidCountryCode(rawCountry) ? rawCountry : DEFAULT_COUNTRY;
    return {
      countryCode,
      currencyCode: getCurrencyForCountry(countryCode),
      isAuthoritative: false,
    };
  }

  async createCheckoutOrder(dto: CreateCheckoutDTO, userId?: string) {
    const resolved = await this.resolveUserCountryAndCurrency(userId, dto.countryCode);
    const countryCode = resolved.countryCode;
    const currencyCode = (dto.currency || resolved.currencyCode).toUpperCase();

    // 1. Server-side minimum support validation based on canonical ₹10 floor
    const minSupport = getMinimumSupport(currencyCode);
    if (dto.amountPaise < minSupport.minimumMinorUnits) {
      throw new ValidationError(
        `Minimum paid backing is ${minSupport.formatted} (${minSupport.minimumMinorUnits} ${currencyCode}).`
      );
    }

    // 2. Compute canonical base amount in INR paise
    const baseAmountPaise = exchangeRateService.convertToBase(dto.amountPaise, currencyCode);

    if (baseAmountPaise < BASE_MINIMUM_SUPPORT_PAISE) {
      throw new ValidationError(
        `Minimum paid backing is ${formatINR(BASE_MINIMUM_SUPPORT_PAISE)}.`
      );
    }

    const order = await razorpayAdapter.createOrder({
      amountPaise: baseAmountPaise,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
      notes: buildSafeRazorpayNotes({
        user_id: userId || '',
        userId: userId || '',
        country_code: countryCode,
        countryCode,
        currency: currencyCode,
        currencyCode,
        original_amount: String(dto.amountPaise),
        original_currency: currencyCode,
        amount: String(baseAmountPaise),
        base_amount: String(baseAmountPaise),
        baseAmountPaise: String(baseAmountPaise),
        debate_id: dto.debateId || '',
        debateId: dto.debateId || '',
        is_new_debate: String(dto.isNewDebate || false),
        isNewDebate: String(dto.isNewDebate || false),
      }),
    });

    return {
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      countryCode,
      baseAmountPaise,
      keyId: process.env.RAZORPAY_KEY_ID || '',
    };
  }

  async createCheckoutSession(options: CheckoutSessionOptions): Promise<CheckoutSessionResult> {
    return razorpayAdapter.createCheckoutSession(options);
  }

  verifyPaymentSignature(params: { orderId: string; paymentId: string; signature: string }): boolean {
    return razorpayAdapter.verifyPaymentSignature(params);
  }

  verifyWebhookSignature(params: { body: string; signature: string }): boolean {
    return razorpayAdapter.verifyWebhookSignature(params);
  }

  async processSuccessfulPayment(params: FulfillmentParams): Promise<FulfillmentResult> {
    return processSuccessfulPayment(params);
  }
}

export const paymentService = new PaymentService();
