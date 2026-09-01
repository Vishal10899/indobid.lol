import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/user-auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const session = await getCurrentUser();

    if (!session) {
      return NextResponse.json({ success: false, error: 'Please sign in to follow debaters' }, { status: 401 });
    }

    const cleanUsername = username.trim().toLowerCase();
    const targetUser = await prisma.user.findUnique({
      where: { username: cleanUsername },
      select: { id: true, username: true, displayName: true },
    });

    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (targetUser.id === session.userId) {
      return NextResponse.json({ success: false, error: 'You cannot follow yourself' }, { status: 400 });
    }

    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: session.userId,
          followingId: targetUser.id,
        },
      },
    });

    if (existingFollow) {
      // Unfollow
      await prisma.follow.delete({
        where: { id: existingFollow.id },
      });

      const followersCount = await prisma.follow.count({
        where: { followingId: targetUser.id },
      });

      return NextResponse.json({
        success: true,
        following: false,
        followersCount,
      });
    } else {
      // Follow
      await prisma.follow.create({
        data: {
          followerId: session.userId,
          followingId: targetUser.id,
        },
      });

      // Send notification to target user
      await prisma.notification.create({
        data: {
          userId: targetUser.id,
          type: 'follow',
          title: 'New Follower',
          message: `@${session.username} followed you.`,
          linkUrl: `/profile/${session.username}`,
        },
      }).catch(() => {});

      const followersCount = await prisma.follow.count({
        where: { followingId: targetUser.id },
      });

      return NextResponse.json({
        success: true,
        following: true,
        followersCount,
      });
    }
  } catch (error) {
    console.error('Follow toggle error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update follow status' }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const session = await getCurrentUser();

    const cleanUsername = username.trim().toLowerCase();
    const targetUser = await prisma.user.findUnique({
      where: { username: cleanUsername },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json({ following: false, followersCount: 0 });
    }

    const [followersCount, isFollowing] = await Promise.all([
      prisma.follow.count({
        where: { followingId: targetUser.id },
      }),
      session
        ? prisma.follow.findUnique({
            where: {
              followerId_followingId: {
                followerId: session.userId,
                followingId: targetUser.id,
              },
            },
          })
        : null,
    ]);

    return NextResponse.json({
      following: !!isFollowing,
      followersCount,
    });
  } catch {
    return NextResponse.json({ following: false, followersCount: 0 });
  }
}
