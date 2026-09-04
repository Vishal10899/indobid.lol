import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-auth';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const userSession = await getCurrentUser();
    if (!userSession) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    const user = await prisma.user.findUnique({
      where: { id: userSession.userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        avatarUrl: true,
        bio: true,
        interests: true,
        isVerified: true,
        rank: true,
        role: true,
        countryCode: true,
        currencyCode: true,
        isPrivate: true,
        ghostMode: true,
        ghostDisplayName: true,
        createdAt: true,
        _count: {
          select: {
            debates: true,
            contributions: true,
            followers: true,
            following: true,
            bookmarks: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    // Calculate total verified contribution in paise
    const totalContributed = await prisma.contribution.aggregate({
      where: { authorId: user.id, status: 'verified' },
      _sum: { amount: true },
    });

    const unreadNotifications = await prisma.notification.count({
      where: { userId: user.id, isRead: false },
    });

    const unreadMessages = await prisma.directMessage.count({
      where: { recipientId: user.id, isRead: false },
    });

    return NextResponse.json({
      authenticated: true,
      user: {
        ...user,
        totalContributedPaise: totalContributed._sum.amount || 0,
        unreadNotificationsCount: unreadNotifications,
        unreadMessagesCount: unreadMessages,
      },
    });
  } catch (error) {
    console.error('Failed to get current user session:', error);
    return NextResponse.json({ authenticated: false, user: null }, { status: 500 });
  }
}
