import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isAuthorizedAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const debateId = searchParams.get('debate_id');
    const status = searchParams.get('status') || 'all';

    const where: any = {};
    if (debateId) where.debateId = debateId;
    if (status !== 'all') where.status = status;

    const contributions = await prisma.contribution.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        debate: {
          select: { id: true, title: true, status: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      contributions,
    });
  } catch (error) {
    console.error('Admin get contributions error:', error);
    return NextResponse.json({ error: 'Failed to fetch contributions' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'Contribution ID and status are required' }, { status: 400 });
    }

    const updated = await prisma.contribution.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({
      success: true,
      contribution: updated,
    });
  } catch (error) {
    console.error('Admin update contribution error:', error);
    return NextResponse.json({ error: 'Failed to update contribution' }, { status: 500 });
  }
}
