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
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search') || '';

    const where: any = {};
    if (status !== 'all') {
      where.status = status;
    }
    if (search.trim()) {
      const q = search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
        { authorUsername: { contains: q, mode: 'insensitive' } },
      ];
    }

    const debates = await prisma.debate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        category: true,
        _count: {
          select: { contributions: true, payments: true, reports: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      debates,
    });
  } catch (error) {
    console.error('Admin get debates error:', error);
    return NextResponse.json({ error: 'Failed to fetch debates' }, { status: 500 });
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
      return NextResponse.json({ error: 'Debate ID and status are required' }, { status: 400 });
    }

    const validStatuses = ['active', 'hidden', 'removed', 'pending_payment'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const updated = await prisma.debate.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({
      success: true,
      debate: updated,
    });
  } catch (error) {
    console.error('Admin update debate error:', error);
    return NextResponse.json({ error: 'Failed to update debate' }, { status: 500 });
  }
}
