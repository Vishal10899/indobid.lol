import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/user-auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: debateId } = await params;
    const session = await getCurrentUser();

    if (!session) {
      return NextResponse.json({ success: false, error: 'Please sign in to save debates' }, { status: 401 });
    }

    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
      select: { id: true },
    });

    if (!debate) {
      return NextResponse.json({ success: false, error: 'Debate not found' }, { status: 404 });
    }

    const existing = await prisma.debateBookmark.findUnique({
      where: {
        debateId_userId: {
          debateId,
          userId: session.userId,
        },
      },
    });

    if (existing) {
      await prisma.debateBookmark.delete({
        where: { id: existing.id },
      });
      return NextResponse.json({ success: true, saved: false });
    } else {
      await prisma.debateBookmark.create({
        data: {
          debateId,
          userId: session.userId,
        },
      });
      return NextResponse.json({ success: true, saved: true });
    }
  } catch (error) {
    console.error('Bookmark toggle error:', error);
    return NextResponse.json({ success: false, error: 'Failed to bookmark debate' }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: debateId } = await params;
    const session = await getCurrentUser();

    if (!session) {
      return NextResponse.json({ saved: false });
    }

    const bookmark = await prisma.debateBookmark.findUnique({
      where: {
        debateId_userId: {
          debateId,
          userId: session.userId,
        },
      },
    });

    return NextResponse.json({ saved: !!bookmark });
  } catch {
    return NextResponse.json({ saved: false });
  }
}
