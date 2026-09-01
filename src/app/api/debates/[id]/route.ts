import { NextRequest, NextResponse } from 'next/server';
import { getDebateById } from '@/lib/debates';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/user-auth';
import { isAuthorizedAdmin } from '@/lib/auth';
import { isFounder } from '@/lib/founder';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Debate ID is required' }, { status: 400 });
    }

    const debate = await getDebateById(id);

    if (!debate) {
      // Check if it's pending_payment or hidden
      const unverified = await prisma.debate.findUnique({
        where: { id },
        select: { id: true, status: true },
      });

      if (unverified && unverified.status === 'pending_payment') {
        return NextResponse.json(
          { error: 'Debate is pending payment verification' },
          { status: 404 }
        );
      }

      return NextResponse.json({ error: 'Debate not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      debate,
    });
  } catch (error) {
    console.error('Get debate by ID error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch debate' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/debates/[id] — Author Post Editing
 * Allows the original author or admin to update post content, title, hashtags, and mention other users.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Debate ID is required' }, { status: 400 });
    }

    // 1. Authoritative Session Check
    const currentUser = await getCurrentUser(request);
    const isAdmin = isAuthorizedAdmin(request);

    if (!currentUser && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Authentication required to edit post' },
        { status: 401 }
      );
    }

    // 2. Fetch Target Debate
    const debate = await prisma.debate.findUnique({
      where: { id },
      select: {
        id: true,
        authorId: true,
        authorUsername: true,
        authorDisplayName: true,
        title: true,
        content: true,
        status: true,
      },
    });

    if (!debate) {
      return NextResponse.json({ success: false, error: 'Debate not found' }, { status: 404 });
    }

    // 3. Authorize: Must be original author or Founder/Admin
    const isAuthor = currentUser && (
      (debate.authorId && currentUser.userId === debate.authorId) ||
      (debate.authorUsername && currentUser.username.toLowerCase() === debate.authorUsername.toLowerCase())
    );
    const isFounderUser = currentUser && isFounder(currentUser);

    if (!isAuthor && !isAdmin && !isFounderUser) {
      return NextResponse.json(
        { success: false, error: 'You are not authorized to edit this post. Only the author can make changes.' },
        { status: 403 }
      );
    }

    // 4. Validate Input Payload
    const body = await request.json();
    const rawContent = typeof body.content === 'string' ? body.content.trim() : '';

    if (!rawContent || rawContent.length < 5) {
      return NextResponse.json(
        { success: false, error: 'Post content must be at least 5 characters long.' },
        { status: 400 }
      );
    }

    if (rawContent.length > 5000) {
      return NextResponse.json(
        { success: false, error: 'Post content cannot exceed 5,000 characters.' },
        { status: 400 }
      );
    }

    // 5. Derive or Validate Title
    let title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title || title.length < 3) {
      const firstLine = rawContent.split('\n').filter((l: string) => l.trim().length > 0)[0] || rawContent;
      title = firstLine.length > 180 ? firstLine.substring(0, 180).trim() : firstLine;
    }

    // 6. Process Hashtags
    let hashtags = typeof body.hashtags === 'string' ? body.hashtags.trim() : null;
    const inTextTags = (rawContent.match(/#[a-zA-Z0-9_]+/g) || []).join(' ');
    if (inTextTags) {
      hashtags = hashtags ? `${hashtags} ${inTextTags}` : inTextTags;
    }

    // 7. Mention Detection and Notifications
    const mentionMatches = [...rawContent.matchAll(/@([a-zA-Z0-9_]{2,30})/g)];
    const mentionedUsernames = Array.from(
      new Set(mentionMatches.map((m) => m[1].toLowerCase()))
    );

    if (mentionedUsernames.length > 0) {
      const mentionedUsers = await prisma.user.findMany({
        where: {
          username: { in: mentionedUsernames, mode: 'insensitive' },
          ...(currentUser?.userId ? { id: { not: currentUser.userId } } : {}),
        },
        select: { id: true, username: true },
      });

      const authorName = currentUser?.displayName || currentUser?.username || debate.authorDisplayName || debate.authorUsername;

      for (const mUser of mentionedUsers) {
        // Create mention notification
        await prisma.notification.create({
          data: {
            userId: mUser.id,
            type: 'mention',
            title: `@${currentUser?.username || debate.authorUsername} mentioned you`,
            message: `${authorName} mentioned you in an opinion: "${title.substring(0, 80)}"`,
            linkUrl: `/debate/${debate.id}`,
          },
        });
      }
    }

    // 8. Update Debate in Database
    const updatedDebate = await prisma.debate.update({
      where: { id },
      data: {
        title,
        content: rawContent,
        hashtags: hashtags || null,
        updatedAt: new Date(),
      },
      include: {
        category: { select: { id: true, name: true, slug: true, icon: true } },
      },
    });

    // 9. Synchronize Sequence 1 Contribution Content
    const firstContrib = await prisma.contribution.findFirst({
      where: { debateId: id, sequence: 1 },
    });
    if (firstContrib) {
      await prisma.contribution.update({
        where: { id: firstContrib.id },
        data: { content: rawContent },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Post updated successfully',
      debate: {
        id: updatedDebate.id,
        title: updatedDebate.title,
        content: updatedDebate.content,
        hashtags: updatedDebate.hashtags,
        updatedAt: updatedDebate.updatedAt,
      },
    });
  } catch (error) {
    console.error('Edit debate error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update post' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return PATCH(request, context);
}

/**
 * DELETE /api/debates/[id] — Author Post Hiding / Drafting
 * Allows the original author or Founder/Admin to hide their post from the public feed.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Debate ID is required' }, { status: 400 });
    }

    const currentUser = await getCurrentUser(request);
    const isAdmin = isAuthorizedAdmin(request);

    if (!currentUser && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const debate = await prisma.debate.findUnique({
      where: { id },
      select: { id: true, authorId: true, authorUsername: true, status: true },
    });

    if (!debate) {
      return NextResponse.json({ success: false, error: 'Debate not found' }, { status: 404 });
    }

    const isAuthor = currentUser && (
      (debate.authorId && currentUser.userId === debate.authorId) ||
      (debate.authorUsername && currentUser.username.toLowerCase() === debate.authorUsername.toLowerCase())
    );
    const isFounderUser = currentUser && isFounder(currentUser);

    if (!isAuthor && !isAdmin && !isFounderUser) {
      return NextResponse.json(
        { success: false, error: 'You are not authorized to hide or delete this post' },
        { status: 403 }
      );
    }

    await prisma.debate.update({
      where: { id },
      data: { status: 'hidden' },
    });

    return NextResponse.json({
      success: true,
      message: 'Post hidden successfully',
    });
  } catch (error) {
    console.error('Delete debate error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to hide post' },
      { status: 500 }
    );
  }
}


