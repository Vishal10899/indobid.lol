/**
 * INDOBID — DEBATE REPOSITORY
 */

import { Prisma, Debate } from '@prisma/client';
import { prisma } from '../prisma';
import { safeDb } from '../transactions';

export class DebateRepository {
  async findById(id: string): Promise<Debate | null> {
    return safeDb(() => prisma.debate.findUnique({ where: { id } }));
  }

  async findByIdWithDetails(id: string) {
    return safeDb(() =>
      prisma.debate.findUnique({
        where: { id },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              isVerified: true,
              role: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          contributions: {
            where: { status: 'verified' },
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
          },
        },
      })
    );
  }

  async create(data: Prisma.DebateCreateInput): Promise<Debate> {
    return safeDb(() => prisma.debate.create({ data }));
  }

  async update(id: string, data: Prisma.DebateUpdateInput): Promise<Debate> {
    return safeDb(() => prisma.debate.update({ where: { id }, data }));
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.DebateWhereInput;
    orderBy?: Prisma.DebateOrderByWithRelationInput | Prisma.DebateOrderByWithRelationInput[];
    include?: Prisma.DebateInclude;
  }) {
    return safeDb(() => prisma.debate.findMany(params));
  }

  async count(where?: Prisma.DebateWhereInput): Promise<number> {
    return safeDb(() => prisma.debate.count({ where }));
  }
}

export const debateRepository = new DebateRepository();
