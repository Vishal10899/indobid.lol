/**
 * INDOBID — REPORT REPOSITORY
 */

import { Prisma, DebateReport } from '@prisma/client';
import { prisma } from '../prisma';
import { safeDb } from '../transactions';

export class ReportRepository {
  async findById(id: string): Promise<DebateReport | null> {
    return safeDb(() => prisma.debateReport.findUnique({ where: { id } }));
  }

  async create(data: Prisma.DebateReportCreateInput): Promise<DebateReport> {
    return safeDb(() => prisma.debateReport.create({ data }));
  }

  async update(id: string, data: Prisma.DebateReportUpdateInput): Promise<DebateReport> {
    return safeDb(() => prisma.debateReport.update({ where: { id }, data }));
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.DebateReportWhereInput;
    orderBy?: Prisma.DebateReportOrderByWithRelationInput;
    include?: Prisma.DebateReportInclude;
  }) {
    return safeDb(() => prisma.debateReport.findMany(params));
  }

  async count(where?: Prisma.DebateReportWhereInput): Promise<number> {
    return safeDb(() => prisma.debateReport.count({ where }));
  }
}

export const reportRepository = new ReportRepository();
