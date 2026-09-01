import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: debateId } = await params;
    const body = await req.json().catch(() => ({}));
    const sessionToken = body.sessionToken || req.cookies.get('indobid_visitor')?.value || crypto.randomUUID();

    // Check if this session already registered an impression for this debate
    const existing = await prisma.debateImpression.findUnique({
      where: {
        debateId_sessionToken: {
          debateId,
          sessionToken,
        },
      },
    });

    if (!existing) {
      await prisma.$transaction([
        prisma.debateImpression.create({
          data: {
            debateId,
            sessionToken,
          },
        }),
        prisma.debate.update({
          where: { id: debateId },
          data: { impressionCount: { increment: 1 } },
        }),
      ]);
    }

    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
      select: { impressionCount: true },
    });

    return NextResponse.json({
      success: true,
      impressionCount: debate?.impressionCount || 0,
    });
  } catch {
    return NextResponse.json({ success: true });
  }
}
