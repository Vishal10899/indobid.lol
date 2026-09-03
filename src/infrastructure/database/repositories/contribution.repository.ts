/**
 * INDOBID — CONTRIBUTION REPOSITORY
 */

import { Prisma, Contribution } from '@prisma/client';
import { prisma } from '../prisma';
import { safeDb } from '../transactions';

export class ContributionRepository {
  async findById(id: string): Promise<Contribution | null> {
    return safeDb(() => prisma.contribution.findUnique({ where: { id } }));
  }

  async create(data: Prisma.ContributionCreateInput): Promise<Contribution> {
    return safeDb(() => prisma.contribution.create({ data }));
  }

  async update(id: string, data: Prisma.ContributionUpdateInput): Promise<Contribution> {
    return safeDb(() => prisma.contribution.update({ where: { id }, data }));
  }

  async findByDebateId(debateId: string, status = 'verified'): Promise<Contribution[]> {
    return safeDb(() =>
      prisma.contribution.findMany({
        where: { debateId, status },
        orderBy: { sequence: 'asc' },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              isVerified: true,
            },
          },
        },
      })
    );
  }

  async count(where?: Prisma.ContributionWhereInput): Promise<number> {
    return safeDb(() => prisma.contribution.count({ where }));
  }
}

export const contributionRepository = new ContributionRepository();
