/**
 * INDOBID — PAYMENT REPOSITORY
 */

import { Prisma, Payment } from '@prisma/client';
import { prisma } from '../prisma';
import { safeDb } from '../transactions';

export class PaymentRepository {
  async findByProviderPaymentId(providerPaymentId: string): Promise<Payment | null> {
    return safeDb(() =>
      prisma.payment.findUnique({
        where: { providerPaymentId },
        include: { debate: true, contribution: true },
      })
    );
  }

  async create(data: Prisma.PaymentCreateInput): Promise<Payment> {
    return safeDb(() => prisma.payment.create({ data }));
  }

  async update(id: string, data: Prisma.PaymentUpdateInput): Promise<Payment> {
    return safeDb(() => prisma.payment.update({ where: { id }, data }));
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.PaymentWhereInput;
    orderBy?: Prisma.PaymentOrderByWithRelationInput;
  }): Promise<Payment[]> {
    return safeDb(() => prisma.payment.findMany(params));
  }

  async count(where?: Prisma.PaymentWhereInput): Promise<number> {
    return safeDb(() => prisma.payment.count({ where }));
  }
}

export const paymentRepository = new PaymentRepository();
