/**
 * INDOBID — PAYMENT REPOSITORY GATEWAY
 * Centralizes data access for payments, checkout records, and transactions.
 */

import { paymentRepository as dbPaymentRepo } from '../../infrastructure/database/repositories/payment.repository';
import { contributionRepository } from '../../infrastructure/database/repositories/contribution.repository';
import { debateRepository } from '../../infrastructure/database/repositories/debate.repository';

export class PaymentRepository {
  readonly payments = dbPaymentRepo;
  readonly contributions = contributionRepository;
  readonly debates = debateRepository;

  async findByProviderPaymentId(providerPaymentId: string) {
    return this.payments.findByProviderPaymentId(providerPaymentId);
  }

  async findById(id: string) {
    return this.payments.findById(id);
  }

  async create(data: Parameters<typeof dbPaymentRepo.create>[0]) {
    return this.payments.create(data);
  }

  async update(id: string, data: Parameters<typeof dbPaymentRepo.update>[1]) {
    return this.payments.update(id, data);
  }
}

export const paymentRepository = new PaymentRepository();
