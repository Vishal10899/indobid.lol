import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/user-auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { participant1Id: session.userId },
          { participant2Id: session.userId },
        ],
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    // Fetch participant info
    const otherUserIds = Array.from(
      new Set(
        conversations.map((c) =>
          c.participant1Id === session.userId ? c.participant2Id : c.participant1Id
        )
      )
    );

    const users = await prisma.user.findMany({
      where: { id: { in: otherUserIds } },
      select: { id: true, username: true, displayName: true, avatarUrl: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    const items = conversations.map((c) => {
      const otherId = c.participant1Id === session.userId ? c.participant2Id : c.participant1Id;
      const otherUser = userMap.get(otherId);
      const lastMsg = c.messages[0] || null;

      return {
        id: c.id,
        otherUser: otherUser || { id: otherId, username: 'user', displayName: 'Debater' },
        lastMessage: lastMsg ? { content: lastMsg.content, createdAt: lastMsg.createdAt, senderId: lastMsg.senderId, isRead: lastMsg.isRead } : null,
        lastMessageAt: c.lastMessageAt,
      };
    });

    return NextResponse.json({ success: true, conversations: items });
  } catch (error) {
    console.error('Messages list error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load conversations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { recipientUsername, content } = body;

    if (!recipientUsername || !content?.trim()) {
      return NextResponse.json({ success: false, error: 'Recipient and content are required' }, { status: 400 });
    }

    const cleanUsername = recipientUsername.trim().toLowerCase();
    const recipient = await prisma.user.findUnique({
      where: { username: cleanUsername },
      select: { id: true, username: true, displayName: true },
    });

    if (!recipient) {
      return NextResponse.json({ success: false, error: 'Recipient user not found' }, { status: 404 });
    }

    if (recipient.id === session.userId) {
      return NextResponse.json({ success: false, error: 'Cannot message yourself' }, { status: 400 });
    }

    // Canonical order for unique pair constraint
    const [p1, p2] = session.userId < recipient.id ? [session.userId, recipient.id] : [recipient.id, session.userId];

    let conversation = await prisma.conversation.findUnique({
      where: {
        participant1Id_participant2Id: {
          participant1Id: p1,
          participant2Id: p2,
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          participant1Id: p1,
          participant2Id: p2,
        },
      });
    }

    const message = await prisma.directMessage.create({
      data: {
        conversationId: conversation.id,
        senderId: session.userId,
        recipientId: recipient.id,
        content: content.trim(),
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    // Notify recipient
    await prisma.notification.create({
      data: {
        userId: recipient.id,
        type: 'message',
        title: 'New Message',
        message: `@${session.username}: "${content.trim().substring(0, 40)}..."`,
        linkUrl: `/messages/${conversation.id}`,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, conversationId: conversation.id, message });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({ success: false, error: 'Failed to send message' }, { status: 500 });
  }
}
