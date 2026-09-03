/**
 * INDOBID — PAYMENT SERVICE
 * Manages checkout order creation, signature verification, and atomic transactional fulfillment.
 */

import { razorpayProvider } from '../../infrastructure/payments/razorpay/razorpay.provider';
import { earningsService } from '../creator-economics/earnings.service';
import { calculateRankingScore } from '../feed/ranking/ranking.service';
import { prisma } from '../../infrastructure/database/prisma';
import { Prisma } from '@prisma/client';
import { CreateCheckoutDTO, FulfillPaymentResult, VerifyPaymentDTO } from './payment.types';
import { PaymentError, ValidationError } from '../../lib/errors';
import { appConfig } from '../../config/app';

export class PaymentService {
  async createCheckoutOrder(dto: CreateCheckoutDTO, userId: string) {
    if (dto.amountPaise < appConfig.money.MINIMUM_DEBATE_PAISE) {
      throw new ValidationError(`Minimum paid backing is $${appConfig.money.MINIMUM_DEBATE_PAISE / 100}.00`);
    }

    const order = await razorpayProvider.createOrder({
      amountPaise: dto.amountPaise,
      currency: appConfig.money.DEFAULT_CURRENCY,
      receipt: `rcpt_${Date.now()}`,
      notes: {
        userId,
        debateId: dto.debateId || '',
        isNewDebate: String(dto.isNewDebate || false),
      },
    });

    return {
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID || '',
    };
  }

  async fulfillPayment(params: {
    providerPaymentId: string;
    orderId?: string;
    amountPaise: number;
    currency?: string;
    userId: string;
    debateId: string;
    argumentContent?: string;
    isNewDebate?: boolean;
    title?: string;
    categoryId?: string;
  }): Promise<FulfillPaymentResult> {
    const {
      providerPaymentId,
      orderId,
      amountPaise,
      currency = 'INR',
      userId,
      debateId,
      argumentContent,
      isNewDebate = false,
      title,
      categoryId,
    } = params;

    // Check if already fulfilled
    const existingPayment = await prisma.payment.findUnique({
      where: { providerPaymentId },
      include: { debate: true },
    });

    if (existingPayment && existingPayment.status === 'succeeded') {
      return { success: true, alreadyProcessed: true, debateId: existingPayment.debateId || debateId };
    }

    // Atomic Transactional Fulfillment
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Re-check inside transaction to prevent double execution
      const txPaymentCheck = await tx.payment.findUnique({
        where: { providerPaymentId },
      });
      if (txPaymentCheck && txPaymentCheck.status === 'succeeded') {
        return { alreadyProcessed: true, debateId: txPaymentCheck.debateId || debateId };
      }

      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error('User not found');

      let targetDebateId = debateId;
      let sequence = 1;
      let isDebateAuthor = true;

      if (isNewDebate) {
        let debate = await tx.debate.findUnique({ where: { id: debateId } });
        if (!debate) {
          const finalCategoryId = categoryId || (await tx.category.findFirst())?.id;
          if (!finalCategoryId) throw new Error('Category required');

          debate = await tx.debate.create({
            data: {
              id: debateId,
              title: title || 'Untitled Debate',
              content: argumentContent || title || 'New Debate',
              status: 'active',
              authorId: userId,
              authorUsername: user.username || 'anonymous',
              authorDisplayName: user.displayName || user.username || 'Debater',
              categoryId: finalCategoryId,
              totalVerifiedContribution: amountPaise,
              contributionCount: 1,
              lastContributionAmount: amountPaise,
              lastContributionAt: new Date(),
            },
          });
        } else {
          debate = await tx.debate.update({
            where: { id: debate.id },
            data: {
              status: 'active',
              totalVerifiedContribution: amountPaise,
              contributionCount: 1,
              lastContributionAmount: amountPaise,
              lastContributionAt: new Date(),
            },
          });
        }
        targetDebateId = debate.id;
        sequence = 1;
        isDebateAuthor = true;
      } else {
        const debate = await tx.debate.findUnique({
          where: { id: debateId },
          include: { author: true },
        });
        if (!debate) throw new Error('Debate not found');

        sequence = debate.contributionCount + 1;
        isDebateAuthor = debate.authorId === userId;

        const newTotal = debate.totalVerifiedContribution + amountPaise;
        const now = new Date();

        const ranking = calculateRankingScore({
          likeCount: debate.likeCount,
          impressionCount: debate.impressionCount,
          contributionCount: sequence,
          uniqueParticipants: Math.max(1, sequence),
          totalVerifiedPaise: newTotal,
          createdAt: debate.createdAt,
          lastContributionAt: now,
          contentLength: debate.content.length,
          reportCount: debate.reportCount,
        });

        await tx.debate.update({
          where: { id: debateId },
          data: {
            totalVerifiedContribution: newTotal,
            contributionCount: sequence,
            lastContributionAmount: amountPaise,
            lastContributionAt: now,
            trendingScore: ranking.finalScore,
          },
        });
      }

      // Record Contribution
      const contribution = await tx.contribution.create({
        data: {
          debateId: targetDebateId,
          authorId: userId,
          authorUsername: user.username || 'anonymous',
          authorDisplayName: user.displayName || user.username || 'Debater',
          content: argumentContent || 'Financial Backing',
          amount: amountPaise,
          sequence,
          status: 'verified',
        },
      });

      // Calculate 50/50 Creator Economics
      const econ = earningsService.calculateCreatorEconomics({
        amountPaise,
        isDebateAuthor,
        sequence,
      });

      // Create Payment Record
      const payment = await tx.payment.create({
        data: {
          debateId: targetDebateId,
          contributionId: contribution.id,
          amount: amountPaise,
          currency,
          status: 'succeeded',
          providerPaymentId,
        },
      });

      // Write to Immutable Double-Entry Creator Ledger
      await tx.creatorEarningsLedger.create({
        data: {
          creatorUsername: isDebateAuthor ? (user.username || 'anonymous') : 'platform',
          debateId: targetDebateId,
          contributionId: contribution.id,
          paymentId: payment.id,
          grossAmountPaise: econ.grossAmountPaise,
          creatorRewardPaise: econ.creatorRewardPaise,
          platformFeePaise: econ.platformFeePaise,
          status: econ.isEligibleForReward ? 'pending' : 'settled',
          idempotencyKey: `ledger_${contribution.id}_${providerPaymentId}`,
        },
      });

      return { alreadyProcessed: false, debateId: targetDebateId };
    });

    return { success: true, alreadyProcessed: result.alreadyProcessed, debateId: result.debateId };
  }

  async verifyPayment(dto: VerifyPaymentDTO, userId: string): Promise<FulfillPaymentResult> {
    const isValid = razorpayProvider.verifyPaymentSignature({
      orderId: dto.razorpay_order_id,
      paymentId: dto.razorpay_payment_id,
      signature: dto.razorpay_signature,
    });

    if (!isValid) {
      throw new PaymentError('Invalid payment signature');
    }

    return this.fulfillPayment({
      providerPaymentId: dto.razorpay_payment_id,
      orderId: dto.razorpay_order_id,
      amountPaise: 200,
      userId,
      debateId: dto.debateId,
      argumentContent: dto.argumentContent,
      isNewDebate: dto.isNewDebate,
      title: dto.title,
      categoryId: dto.categoryId,
    });
  }
}

export const paymentService = new PaymentService();
