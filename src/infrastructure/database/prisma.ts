/**
 * INDOBID — PRISMA ORM SINGLETON WITH DATA LOSS PREVENTION
 * Single database connection pool instance across application execution.
 * Hardened with Prisma query middleware to permanently prevent accidental
 * unconditional deletion of user content, debates, contributions, and accounts.
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: any;
};

function createSafePrismaClient() {
  const basePrisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

  return basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          let attempts = 0;
          const maxAttempts = 4;
          while (attempts < maxAttempts) {
            try {
              return await query(args);
            } catch (err: any) {
              attempts++;
              const isTransient =
                err?.code === 'P1017' ||
                err?.code === 'P1001' ||
                err?.code === 'P1008' ||
                err?.message?.includes('Server has closed the connection') ||
                err?.message?.includes('ConnectionReset') ||
                err?.message?.includes('forcibly closed') ||
                err?.message?.includes('Can\'t reach database server');

              if (isTransient && attempts < maxAttempts) {
                await new Promise((resolve) => setTimeout(resolve, 500 * attempts));
                continue;
              }
              throw err;
            }
          }
          return query(args);
        },
      },
      debate: {
        async deleteMany({ args, query }) {
          if (!args.where || Object.keys(args.where).length === 0) {
            throw new Error(
              'SAFETY_VIOLATION: Unconditional deletion of all debates is permanently prohibited. User posts must remain permanently in PostgreSQL until explicitly deleted by author or admin.'
            );
          }
          return query(args);
        },
      },
      user: {
        async deleteMany({ args, query }) {
          if (!args.where || Object.keys(args.where).length === 0) {
            throw new Error(
              'SAFETY_VIOLATION: Unconditional deletion of all users is permanently prohibited. User accounts must remain permanently in PostgreSQL.'
            );
          }
          return query(args);
        },
      },
      contribution: {
        async deleteMany({ args, query }) {
          if (!args.where || Object.keys(args.where).length === 0) {
            throw new Error(
              'SAFETY_VIOLATION: Unconditional deletion of all contributions is permanently prohibited.'
            );
          }
          return query(args);
        },
      },
    },
  });
}

export const prisma = (globalForPrisma.prisma ?? createSafePrismaClient()) as PrismaClient;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
