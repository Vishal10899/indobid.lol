import { NextRequest, NextResponse } from 'next/server';
import { getDebateById } from '@/lib/debates';
import { prisma } from '@/lib/db';
import { calculateNextMinimumPaise } from '@/lib/money';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Debate ID is required' }, { status: 400 });
    }

    const debate = await getDebateById(id);

    if (!debate) {
      // Check if it's pending_payment or hidden
      const unverified = await prisma.debate.findUnique({
        where: { id },
        select: { id: true, status: true },
      });

      if (unverified && unverified.status === 'pending_payment') {
        return NextResponse.json(
          { error: 'Debate is pending payment verification' },
          { status: 404 }
        );
      }

      return NextResponse.json({ error: 'Debate not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      debate,
    });
  } catch (error) {
    console.error('Get debate by ID error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch debate' },
      { status: 500 }
    );
  }
}
