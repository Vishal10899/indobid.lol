import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getClientIp, checkRateLimit } from '@/lib/rate-limit';
import crypto from 'crypto';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const reportSchema = z.object({
  reason: z.string().min(3, 'Reason must be at least 3 characters').max(500, 'Reason cannot exceed 500 characters'),
  contributionId: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: debateId } = await context.params;
    if (!debateId) {
      return NextResponse.json({ error: 'Debate ID is required' }, { status: 400 });
    }

    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`report:${ip}`, 5, 60);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many report submissions. Please wait a moment.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = reportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid report reason' },
        { status: 400 }
      );
    }

    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');

    // Create report
    await prisma.debateReport.create({
      data: {
        debateId,
        contributionId: parsed.data.contributionId || null,
        reason: parsed.data.reason.trim(),
        ipHash,
        status: 'pending',
      },
    });

    // Increment report count on debate
    await prisma.debate.update({
      where: { id: debateId },
      data: { reportCount: { increment: 1 } },
    });

    return NextResponse.json({
      success: true,
      message: 'Report submitted successfully. Thank you for keeping IndoBid clean.',
    });
  } catch (error) {
    console.error('Report API error:', error);
    return NextResponse.json(
      { error: 'Failed to submit report' },
      { status: 500 }
    );
  }
}
