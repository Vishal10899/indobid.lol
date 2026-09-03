/**
 * INDOBID — DEBATE REPOSITORY (MODULE LAYER)
 * Centralizes database queries for debates, categories, and contributions.
 */

import { debateRepository as dbDebateRepo } from '../../infrastructure/database/repositories/debate.repository';
import { contributionRepository as dbContribRepo } from '../../infrastructure/database/repositories/contribution.repository';
import { categoryRepository as dbCategoryRepo } from '../../infrastructure/database/repositories/category.repository';

export class DebateRepository {
  readonly debates = dbDebateRepo;
  readonly contributions = dbContribRepo;
  readonly categories = dbCategoryRepo;

  async findById(id: string) {
    return this.debates.findById(id);
  }

  async findByIdWithDetails(id: string) {
    return this.debates.findByIdWithDetails(id);
  }

  async create(data: Parameters<typeof dbDebateRepo.create>[0]) {
    return this.debates.create(data);
  }

  async update(id: string, data: Parameters<typeof dbDebateRepo.update>[1]) {
    return this.debates.update(id, data);
  }

  async findMany(params: Parameters<typeof dbDebateRepo.findMany>[0]) {
    return this.debates.findMany(params);
  }

  async count(where?: Parameters<typeof dbDebateRepo.count>[0]) {
    return this.debates.count(where);
  }

  async findCategoryById(id: string) {
    return this.categories.findById(id);
  }

  async findCategoryBySlug(slug: string) {
    return this.categories.findBySlug(slug);
  }

  async listCategories() {
    return this.categories.findAll();
  }
}

export const debateRepository = new DebateRepository();
