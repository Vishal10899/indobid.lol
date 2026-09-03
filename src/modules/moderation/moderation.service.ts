/**
 * INDOBID — MODERATION SERVICE
 */

import { reportRepository } from '../../infrastructure/database/repositories/report.repository';
import { debateRepository } from '../../infrastructure/database/repositories/debate.repository';
import { NotFoundError } from '../../lib/errors';
import { CreateReportDTO, ResolveReportDTO } from './moderation.types';

export class ModerationService {
  async reportDebate(dto: CreateReportDTO) {
    const debate = await debateRepository.findById(dto.debateId);
    if (!debate) throw new NotFoundError('Debate not found');

    const report = await reportRepository.create({
      debate: { connect: { id: dto.debateId } },
      reason: dto.reason,
      status: 'pending',
    });

    // Increment debate report count
    await debateRepository.update(dto.debateId, {
      reportCount: (debate.reportCount || 0) + 1,
    });

    return report;
  }

  async resolveReport(dto: ResolveReportDTO) {
    const report = await reportRepository.findById(dto.reportId);
    if (!report) throw new NotFoundError('Report not found');

    if (dto.action === 'hide_debate' && report.debateId) {
      await debateRepository.update(report.debateId, { status: 'hidden' });
    }

    return reportRepository.update(dto.reportId, {
      status: 'resolved',
    });
  }

  async listPendingReports(skip = 0, take = 50) {
    return reportRepository.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: { debate: true },
    });
  }
}

export const moderationService = new ModerationService();
