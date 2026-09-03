/**
 * INDOBID — DIRECT MESSAGE THREAD CONTROLLER
 * Thin controller delegating to messageService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { messageService } from '@/modules/social/messages/message.service';
import { getCurrentUser } from '@/modules/auth/session.service';

export const dynamic = 'force-dynamic';

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

    const data = await messageService.getConversationMessages(conversationId, session.userId);
    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    console.error('Fetch conversation error:', error);
    const status =
      error.message === 'Conversation not found'
        ? 404
        : error.name === 'AuthorizationError'
        ? 403
        : 500;
    return NextResponse.json({ success: false, error: error.message || 'Failed to load conversation' }, { status });
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

    const body = await req.json();
    const { content } = body;

    const message = await messageService.sendThreadMessage(
      conversationId,
      session.userId,
      session.username,
      content
    );

    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    console.error('Send message in thread error:', error);
    const status =
      error.message === 'Conversation not found'
        ? 404
        : error.name === 'AuthorizationError'
        ? 403
        : error.name === 'ValidationError'
        ? 400
        : 500;
    return NextResponse.json({ success: false, error: error.message || 'Failed to send message' }, { status });
  }
}
