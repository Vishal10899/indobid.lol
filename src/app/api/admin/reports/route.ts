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
    const status = searchParams.get('status') || 'pending';

    const where: any = {};
    if (status !== 'all') where.status = status;

    const reports = await prisma.debateReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        debate: {
          select: { id: true, title: true, authorUsername: true, status: true },
        },
        contribution: {
          select: { id: true, content: true, authorUsername: true, status: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      reports,
    });
  } catch (error) {
    console.error('Admin get reports error:', error);
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
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
      return NextResponse.json({ error: 'Report ID and status are required' }, { status: 400 });
    }

    const updated = await prisma.debateReport.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({
      success: true,
      report: updated,
    });
  } catch (error) {
    console.error('Admin update report error:', error);
    return NextResponse.json({ error: 'Failed to update report' }, { status: 500 });
  }
}
