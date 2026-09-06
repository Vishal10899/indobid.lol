/**
 * INDOBID — DATABASE TRANSACTIONS & RETRY WRAPPER
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from './prisma';

/**
 * Retries a database query with exponential backoff on connection pauses / cold starts.
 */
export async function safeDb<T>(fn: () => Promise<T>, retries = 5): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (attempt === retries - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  return fn();
}

/**
 * Runs a transactional unit of work with safe retries and generous timeouts for remote connections.
 */
export async function runTransaction<T>(
  action: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { maxWait?: number; timeout?: number }
): Promise<T> {
  return safeDb(async () => {
    return prisma.$transaction(action, {
      maxWait: options?.maxWait ?? 15000,
      timeout: options?.timeout ?? 30000,
    });
  });
}

