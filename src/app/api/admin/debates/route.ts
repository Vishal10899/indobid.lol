/**
 * INDOBID — ADMIN DEBATES CONTROLLER
 * Thin controller delegating to adminService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminService } from '@/modules/admin/admin.service';
import { isAuthorizedAdmin } from '@/modules/auth/authorization';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'all';
    const debates = await adminService.listDebates(0, 100, status);

    return NextResponse.json({
      success: true,
      debates: debates.debates,
    });
  } catch (error) {
    console.error('Admin get debates error:', error);
    return NextResponse.json({ error: 'Failed to fetch debates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, content, categorySlug, categoryId, hashtags, isAnonymous } = body;

    if (!title || typeof title !== 'string' || title.trim().length < 5) {
      return NextResponse.json({ error: 'Post title must be at least 5 characters' }, { status: 400 });
    }
    if (!content || typeof content !== 'string' || content.trim().length < 5) {
      return NextResponse.json({ error: 'Post content must be at least 5 characters' }, { status: 400 });
    }

    const debate = await adminService.createFounderDebate({
      title,
      content,
      categorySlug,
      categoryId,
      hashtags,
      isAnonymous,
    });

    return NextResponse.json({
      success: true,
      debate,
      message: 'Post created and published directly as Founder',
    });
  } catch (error: any) {
    console.error('Admin create debate error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create debate as Founder' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, status, action, penalty, trendingScore } = body;

    if (!id) {
      return NextResponse.json({ error: 'Debate ID is required' }, { status: 400 });
    }

    // 1. Rank Down Action
    if (action === 'rankdown') {
      const penaltyAmount = typeof penalty === 'number' && penalty > 0 ? penalty : 50;
      const updated = await adminService.rankDownDebate(id, penaltyAmount);
      return NextResponse.json({
        success: true,
        message: `Post ranked down by ${penaltyAmount} points`,
        debate: updated,
      });
    }

    // 2. Reset Rank Action
    if (action === 'reset_rank') {
      const updated = await adminService.resetDebateRank(id);
      return NextResponse.json({
        success: true,
        message: 'Post ranking restored to organic score',
        debate: updated,
      });
    }

    // 3. Delete Action via PATCH
    if (action === 'delete') {
      await adminService.deleteDebate(id);
      return NextResponse.json({
        success: true,
        message: 'Post deleted successfully by admin',
        id,
      });
    }

    // 4. Direct Trending Score Override
    if (trendingScore !== undefined && typeof trendingScore === 'number') {
      const updated = await adminService.updateDebate(id, { trendingScore });
      return NextResponse.json({
        success: true,
        debate: updated,
      });
    }

    // 5. Status update
    if (status) {
      const validStatuses = ['active', 'hidden', 'removed', 'pending_payment'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }

      const updated = await adminService.updateDebate(id, { status });
      return NextResponse.json({
        success: true,
        debate: updated,
      });
    }

    return NextResponse.json({ error: 'No valid update action specified' }, { status: 400 });
  } catch (error: any) {
    console.error('Admin update debate error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update debate' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    let id = searchParams.get('id');
    if (!id) {
      const body = await request.json().catch(() => ({}));
      id = body?.id;
    }

    if (!id) {
      return NextResponse.json({ error: 'Debate ID is required' }, { status: 400 });
    }

    await adminService.deleteDebate(id);

    return NextResponse.json({
      success: true,
      message: 'Post deleted successfully by admin',
      id,
    });
  } catch (error: any) {
    console.error('Admin delete debate error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete debate' }, { status: 500 });
  }
}

