import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/user-auth';
import { CREATOR_SHARE_BPS } from '@/lib/creator-economics';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim().toLowerCase() || '';
    const statusFilter = searchParams.get('status')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const skip = (page - 1) * limit;

    // 1. Fetch Aggregates across all Ledger Records
    const [allLedgerRecords, allDebates] = await Promise.all([
      prisma.creatorEarningsLedger.findMany({
        select: {
          creatorUsername: true,
          grossAmountPaise: true,
          creatorRewardPaise: true,
          status: true,
        },
      }),
      prisma.debate.findMany({
        where: { status: 'active' },
        select: {
          id: true,
          title: true,
          authorUsername: true,
          totalVerifiedContribution: true,
          originalContribution: true,
          contributionCount: true,
        },
      }),
    ]);

    let totalVerifiedBackingPaise = 0;
    let totalCreatorRewardsPaise = 0;
    let totalPendingRewardsPaise = 0;
    let totalAvailableRewardsPaise = 0;
    let totalPaidRewardsPaise = 0;
    let totalReversedRewardsPaise = 0;
    const earningCreatorsSet = new Set<string>();

    for (const record of allLedgerRecords) {
      if (record.status !== 'reversed') {
        totalVerifiedBackingPaise += record.grossAmountPaise;
        totalCreatorRewardsPaise += record.creatorRewardPaise;
        earningCreatorsSet.add(record.creatorUsername.toLowerCase());

        if (record.status === 'pending') {
          totalPendingRewardsPaise += record.creatorRewardPaise;
        } else if (record.status === 'available') {
          totalAvailableRewardsPaise += record.creatorRewardPaise;
        } else if (record.status === 'paid') {
          totalPaidRewardsPaise += record.creatorRewardPaise;
        }
      } else {
        totalReversedRewardsPaise += record.creatorRewardPaise;
      }
    }

    // 2. Top Earning Opinions
    const topEarningOpinions = allDebates
      .map((d) => {
        const externalBacking = Math.max(0, d.totalVerifiedContribution - d.originalContribution);
        const rewardPaise = Math.floor((externalBacking * CREATOR_SHARE_BPS) / 10000);
        return {
          id: d.id,
          title: d.title,
          creatorUsername: d.authorUsername,
          totalBackingPaise: d.totalVerifiedContribution,
          externalBackingPaise: externalBacking,
          creatorRewardPaise: rewardPaise,
          contributionCount: d.contributionCount,
        };
      })
      .sort((a, b) => b.creatorRewardPaise - a.creatorRewardPaise)
      .slice(0, 10);

    // 3. Top Earning Creators
    const creatorTotals: Record<string, { username: string; totalEarnedPaise: number; count: number }> = {};
    for (const record of allLedgerRecords) {
      if (record.status !== 'reversed') {
        const u = record.creatorUsername.toLowerCase();
        if (!creatorTotals[u]) {
          creatorTotals[u] = { username: record.creatorUsername, totalEarnedPaise: 0, count: 0 };
        }
        creatorTotals[u].totalEarnedPaise += record.creatorRewardPaise;
        creatorTotals[u].count += 1;
      }
    }
    const topEarningCreators = Object.values(creatorTotals)
      .sort((a, b) => b.totalEarnedPaise - a.totalEarnedPaise)
      .slice(0, 10);

    // 4. Paginated Auditable Ledger Table
    const whereClause: any = {};
    if (statusFilter && statusFilter !== 'all') {
      whereClause.status = statusFilter;
    }
    if (search) {
      whereClause.OR = [
        { creatorUsername: { contains: search, mode: 'insensitive' } },
        { debate: { title: { contains: search, mode: 'insensitive' } } },
        { contributionId: { contains: search, mode: 'insensitive' } },
        { id: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [totalLedgerEntries, ledgerEntries] = await Promise.all([
      prisma.creatorEarningsLedger.count({ where: whereClause }),
      prisma.creatorEarningsLedger.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          debate: { select: { id: true, title: true } },
          contribution: { select: { id: true, sequence: true, authorUsername: true, content: true } },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      summary: {
        totalVerifiedBackingPaise,
        totalCreatorRewardsPaise,
        totalPendingRewardsPaise,
        totalAvailableRewardsPaise,
        totalPaidRewardsPaise,
        totalReversedRewardsPaise,
        earningCreatorsCount: earningCreatorsSet.size,
        rewardRatePercent: 10,
      },
      topEarningCreators,
      topEarningOpinions,
      ledger: {
        items: ledgerEntries.map((e) => ({
          id: e.id,
          creatorUsername: e.creatorUsername,
          debateId: e.debateId,
          debateTitle: e.debate?.title || 'Unknown Opinion',
          contributionId: e.contributionId,
          contributionSequence: e.contribution?.sequence || 1,
          contributorUsername: e.contribution?.authorUsername || 'anonymous',
          grossAmountPaise: e.grossAmountPaise,
          creatorRewardPaise: e.creatorRewardPaise,
          platformFeePaise: e.platformFeePaise,
          percentageBps: e.percentageBps,
          status: e.status,
          idempotencyKey: e.idempotencyKey,
          createdAt: e.createdAt,
          settledAt: e.settledAt,
          reversedAt: e.reversedAt,
          reversalReason: e.reversalReason,
        })),
        total: totalLedgerEntries,
        page,
        limit,
        totalPages: Math.ceil(totalLedgerEntries / limit) || 1,
      },
    });
  } catch (error) {
    console.error('Admin Creator Economy API error:', error);
    return NextResponse.json({ error: 'Failed to fetch creator economy data' }, { status: 500 });
  }
}
