import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/user-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params;
    const session = await getCurrentUser();

    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 100,
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 });
    }

    // Authorization check: User must be a participant in this conversation
    if (
      conversation.participant1Id !== session.userId &&
      conversation.participant2Id !== session.userId
    ) {
      return NextResponse.json({ success: false, error: 'Access denied to this private conversation' }, { status: 403 });
    }

    const otherId = conversation.participant1Id === session.userId ? conversation.participant2Id : conversation.participant1Id;
    const otherUser = await prisma.user.findUnique({
      where: { id: otherId },
      select: { id: true, username: true, displayName: true, avatarUrl: true },
    });

    // Mark messages sent to this user as read
    await prisma.directMessage.updateMany({
      where: {
        conversationId,
        recipientId: session.userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return NextResponse.json({
      success: true,
      otherUser: otherUser || { id: otherId, username: 'user', displayName: 'Debater' },
      messages: conversation.messages,
    });
  } catch (error) {
    console.error('Fetch conversation error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load conversation' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params;
    const session = await getCurrentUser();

    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 });
    }

    if (
      conversation.participant1Id !== session.userId &&
      conversation.participant2Id !== session.userId
    ) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const body = await req.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json({ success: false, error: 'Message content is required' }, { status: 400 });
    }

    const recipientId =
      conversation.participant1Id === session.userId
        ? conversation.participant2Id
        : conversation.participant1Id;

    const message = await prisma.directMessage.create({
      data: {
        conversationId,
        senderId: session.userId,
        recipientId,
        content: content.trim(),
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    // Notification to recipient
    await prisma.notification.create({
      data: {
        userId: recipientId,
        type: 'message',
        title: 'New Message',
        message: `@${session.username}: "${content.trim().substring(0, 40)}..."`,
        linkUrl: `/messages/${conversationId}`,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error('Send message in thread error:', error);
    return NextResponse.json({ success: false, error: 'Failed to send message' }, { status: 500 });
  }
}
