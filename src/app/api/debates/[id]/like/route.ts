import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/user-auth';
import crypto from 'crypto';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: debateId } = await params;
    const session = await getCurrentUser();

    // IP hash fallback for guest/unauthenticated users
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);

    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
      select: { id: true, authorId: true, title: true, likeCount: true },
    });

    if (!debate) {
      return NextResponse.json({ success: false, error: 'Debate not found' }, { status: 404 });
    }

    const userId = session?.userId || null;

    // Check if like exists
    const existingLike = await prisma.debateLike.findFirst({
      where: userId
        ? { debateId, userId }
        : { debateId, userIpHash: ipHash, userId: null },
    });

    if (existingLike) {
      // Unlike
      await prisma.$transaction([
        prisma.debateLike.delete({ where: { id: existingLike.id } }),
        prisma.debate.update({
          where: { id: debateId },
          data: { likeCount: { decrement: 1 } },
        }),
      ]);

      const updated = await prisma.debate.findUnique({
        where: { id: debateId },
        select: { likeCount: true },
      });

      return NextResponse.json({
        success: true,
        liked: false,
        likeCount: Math.max(0, updated?.likeCount || 0),
      });
    } else {
      // Like
      await prisma.$transaction([
        prisma.debateLike.create({
          data: {
            debateId,
            userId,
            userIpHash: userId ? null : ipHash,
          },
        }),
        prisma.debate.update({
          where: { id: debateId },
          data: { likeCount: { increment: 1 } },
        }),
      ]);

      // Notify debate author if not liking own post
      if (debate.authorId && debate.authorId !== userId) {
        let actorName = 'Someone';
        if (userId) {
          const liker = await prisma.user.findUnique({
            where: { id: userId },
            select: { ghostMode: true, ghostDisplayName: true, displayName: true },
          });
          actorName = liker?.ghostMode ? (liker.ghostDisplayName || 'Someone') : (liker?.displayName || 'Someone');
        }

        await prisma.notification.create({
          data: {
            userId: debate.authorId,
            actorId: userId,
            type: 'like',
            title: 'New Like',
            message: `${actorName} liked your opinion: "${debate.title.substring(0, 40)}..."`,
            linkUrl: `/debate/${debateId}`,
          },
        }).catch(() => {});
      }

      const updated = await prisma.debate.findUnique({
        where: { id: debateId },
        select: { likeCount: true },
      });

      return NextResponse.json({
        success: true,
        liked: true,
        likeCount: updated?.likeCount || 1,
      });
    }
  } catch (error) {
    console.error('Like toggle error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update like' }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: debateId } = await params;
    const session = await getCurrentUser();

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);

    const userId = session?.userId || null;

    const [debate, userLike] = await Promise.all([
      prisma.debate.findUnique({
        where: { id: debateId },
        select: { likeCount: true },
      }),
      prisma.debateLike.findFirst({
        where: userId
          ? { debateId, userId }
          : { debateId, userIpHash: ipHash, userId: null },
      }),
    ]);

    return NextResponse.json({
      liked: !!userLike,
      likeCount: debate?.likeCount || 0,
    });
  } catch {
    return NextResponse.json({ liked: false, likeCount: 0 });
  }
}
