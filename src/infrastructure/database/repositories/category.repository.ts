/**
 * INDOBID — CATEGORY REPOSITORY
 */

import { Category } from '@prisma/client';
import { prisma } from '../prisma';
import { safeDb } from '../transactions';

export class CategoryRepository {
  async findAll(): Promise<Category[]> {
    return safeDb(() =>
      prisma.category.findMany({
        orderBy: { sortOrder: 'asc' },
      })
    );
  }

  async findBySlug(slug: string): Promise<Category | null> {
    return safeDb(() =>
      prisma.category.findUnique({
        where: { slug },
      })
    );
  }

  async findById(id: string): Promise<Category | null> {
    return safeDb(() =>
      prisma.category.findUnique({
        where: { id },
      })
    );
  }
}

export const categoryRepository = new CategoryRepository();
