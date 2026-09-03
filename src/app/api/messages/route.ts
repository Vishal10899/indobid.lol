/**
 * INDOBID — DIRECT MESSAGES CONTROLLER
 * Thin controller delegating to messageService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { messageService } from '@/modules/social/messages/message.service';
import { getCurrentUser } from '@/modules/auth/session.service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const conversations = await messageService.getUserConversations(session.userId);
    return NextResponse.json({ success: true, conversations });
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
    const { recipientUsername, recipientId, content } = body;
    const recipient = recipientUsername || recipientId;

    if (!recipient || !content?.trim()) {
      return NextResponse.json({ success: false, error: 'Recipient and content are required' }, { status: 400 });
    }

    const result = await messageService.sendMessage(session.userId, recipient, content);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Send message error:', error);
    const status =
      error.message === 'Recipient not found'
        ? 404
        : error.name === 'ValidationError'
        ? 400
        : 500;
    return NextResponse.json({ success: false, error: error.message || 'Failed to send message' }, { status });
  }
}
