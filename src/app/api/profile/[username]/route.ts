import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculateNextMinimumPaise } from '@/lib/money';
import { getCurrentUser } from '@/lib/user-auth';
import { calculateCreatorEconomics } from '@/lib/creator-economics';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await context.params;
    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const cleanUsername = username.toLowerCase().trim();
    const session = await getCurrentUser();
    const isOwner = session?.username === cleanUsername;

    // Fetch user record if exists
    const userRecord = await prisma.user.findUnique({
      where: { username: cleanUsername },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        isVerified: true,
        rank: true,
        role: true,
        createdAt: true,
      },
    });

    // Fetch user's active debates (exclude anonymous if not owner)
    const debates = await prisma.debate.findMany({
      where: {
        authorUsername: cleanUsername,
        status: 'active',
        ...(isOwner ? {} : { isAnonymous: false }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        category: { select: { id: true, name: true, slug: true, icon: true } },
      },
    });

    // Fetch user's verified contributions (exclude anonymous if not owner)
    const contributions = await prisma.contribution.findMany({
      where: {
        authorUsername: cleanUsername,
        status: 'verified',
        debate: { status: 'active' },
        ...(isOwner ? {} : { isAnonymous: false }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        debate: {
          select: {
            id: true,
            title: true,
            status: true,
            category: { select: { name: true, slug: true } },
          },
        },
      },
    });

    // Calculate total verified contributed amount across all contributions
    const allUserContributions = await prisma.contribution.findMany({
      where: {
        authorUsername: cleanUsername,
        status: 'verified',
      },
      select: { amount: true },
    });
    const totalContributedPaise = allUserContributions.reduce((acc, c) => acc + c.amount, 0);

    // Calculate creator economics
    const creatorEconomics = await calculateCreatorEconomics(cleanUsername);

    // Fetch payout account if owner
    let payoutAccount = null;
    if (isOwner && userRecord?.id) {
      payoutAccount = await prisma.payoutAccount.findUnique({
        where: { userId: userRecord.id },
        select: {
          id: true,
          accountType: true,
          accountHolderName: true,
          maskedAccountNumber: true,
          maskedIfsc: true,
          status: true,
          verifiedAt: true,
          createdAt: true,
        },
      });
    }

    // Follower counts
    let followersCount = 0;
    let followingCount = 0;
    let isFollowing = false;

    if (userRecord) {
      const [f1, f2, isFollow] = await Promise.all([
        prisma.follow.count({ where: { followingId: userRecord.id } }),
        prisma.follow.count({ where: { followerId: userRecord.id } }),
        session ? prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: session.userId,
              followingId: userRecord.id,
            },
          },
        }) : null,
      ]);
      followersCount = f1;
      followingCount = f2;
      isFollowing = !!isFollow;
    }

    const formattedDebates = debates.map((d) => {
      const externalBacking = Math.max(0, d.totalVerifiedContribution - (d.originalContribution || 1000));
      const creatorEarnedPaise = Math.floor(externalBacking * 0.10);
      return {
        id: d.id,
        title: d.title,
        content: d.content,
        category: d.category,
        authorUsername: d.authorUsername,
        authorDisplayName: d.authorDisplayName,
        originalContribution: d.originalContribution,
        totalVerifiedContribution: d.totalVerifiedContribution,
        contributionCount: d.contributionCount,
        lastContributionAmount: d.lastContributionAmount,
        minimumNextContribution: calculateNextMinimumPaise(d.lastContributionAmount),
        likeCount: d.likeCount,
        impressionCount: d.impressionCount,
        creatorEarnedPaise,
        isAnonymous: d.isAnonymous,
        createdAt: d.createdAt,
      };
    });

    return NextResponse.json({
      success: true,
      profile: {
        id: userRecord?.id || null,
        username: cleanUsername,
        displayName: userRecord?.displayName || debates[0]?.authorDisplayName || contributions[0]?.authorDisplayName || cleanUsername,
        bio: userRecord?.bio || null,
        avatarUrl: userRecord?.avatarUrl || null,
        isVerified: userRecord?.isVerified || false,
        rank: userRecord?.rank || 0,
        joinedDate: userRecord?.createdAt ? userRecord.createdAt.toISOString() : null,
        followersCount,
        followingCount,
        isFollowing,
        stats: {
          debatesStarted: debates.length,
          contributionsMade: contributions.length,
          totalContributedPaise,
          totalContributedRupees: totalContributedPaise / 100,
        },
        // Private balances are strictly protected for owner
        creatorEconomics: isOwner ? {
          eligibleExternalBackingPaise: creatorEconomics.eligibleExternalBackingPaise,
          eligibleExternalBackingRupees: creatorEconomics.eligibleExternalBackingRupees,
          formattedEligibleExternalBacking: creatorEconomics.formattedEligibleExternalBacking,
          creatorEarningsPaise: creatorEconomics.creatorEarningsPaise,
          creatorEarningsRupees: creatorEconomics.creatorEarningsRupees,
          formattedCreatorEarnings: creatorEconomics.formattedCreatorEarnings,
          pendingEarningsPaise: creatorEconomics.pendingEarningsPaise,
          pendingEarningsRupees: creatorEconomics.pendingEarningsRupees,
          formattedPendingEarnings: creatorEconomics.formattedPendingEarnings,
          availableEarningsPaise: creatorEconomics.availableEarningsPaise,
          availableEarningsRupees: creatorEconomics.availableEarningsRupees,
          formattedAvailableEarnings: creatorEconomics.formattedAvailableEarnings,
          paidEarningsPaise: creatorEconomics.paidEarningsPaise,
          paidEarningsRupees: creatorEconomics.paidEarningsRupees,
          formattedPaidEarnings: creatorEconomics.formattedPaidEarnings,
          creatorOwnStakePaise: creatorEconomics.creatorOwnStakePaise,
          formattedCreatorOwnStake: creatorEconomics.formattedCreatorOwnStake,
          payoutAccount: payoutAccount || { status: 'not_connected' },
        } : {
          eligibleExternalBackingPaise: creatorEconomics.eligibleExternalBackingPaise,
          eligibleExternalBackingRupees: creatorEconomics.eligibleExternalBackingRupees,
          formattedEligibleExternalBacking: creatorEconomics.formattedEligibleExternalBacking,
          creatorEarningsPaise: creatorEconomics.creatorEarningsPaise,
          creatorEarningsRupees: creatorEconomics.creatorEarningsRupees,
          formattedCreatorEarnings: creatorEconomics.formattedCreatorEarnings,
        },
        debates: formattedDebates,
        contributions: contributions.map((c) => ({
          id: c.id,
          debateId: c.debateId,
          debateTitle: c.debate.title,
          amount: c.amount,
          content: c.content,
          sequence: c.sequence,
          createdAt: c.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('Profile API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
}
