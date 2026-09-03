/**
 * INDOBID — USER REPOSITORY
 */

import { Prisma, User } from '@prisma/client';
import { prisma } from '../prisma';
import { safeDb } from '../transactions';

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    return safeDb(() => prisma.user.findUnique({ where: { id } }));
  }

  async findByEmail(email: string): Promise<User | null> {
    return safeDb(() =>
      prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      })
    );
  }

  async findByUsername(username: string): Promise<User | null> {
    return safeDb(() =>
      prisma.user.findUnique({
        where: { username: username.toLowerCase().trim() },
      })
    );
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return safeDb(() => prisma.user.create({ data }));
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return safeDb(() => prisma.user.update({ where: { id }, data }));
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
  }): Promise<User[]> {
    return safeDb(() => prisma.user.findMany(params));
  }

  async count(where?: Prisma.UserWhereInput): Promise<number> {
    return safeDb(() => prisma.user.count({ where }));
  }
}

export const userRepository = new UserRepository();
