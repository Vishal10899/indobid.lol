import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { formatINR } from '@/lib/money';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const activities = await prisma.debateActivityEvent.findMany({
      take: 20,
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
      where: {
        debate: {
          status: 'active',
        },
      },
    });

    const formatted = activities.map((a) => ({
      id: a.id,
      debateId: a.debateId,
      type: a.type,
      title: a.title,
      authorUsername: a.authorUsername,
      authorDisplayName: a.authorDisplayName,
      amount: a.amount,
      formattedAmount: formatINR(a.amount),
      message: a.message,
      categoryName: a.debate.category.name,
      createdAt: a.createdAt,
    }));

    return NextResponse.json({
      success: true,
      activities: formatted,
    });
  } catch (error) {
    console.error('Activity API error:', error);
    return NextResponse.json(
      { success: false, activities: [] },
      { status: 500 }
    );
  }
}
