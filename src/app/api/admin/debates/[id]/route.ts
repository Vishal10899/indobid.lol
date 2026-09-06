/**
 * INDOBID — ADMIN INDIVIDUAL DEBATE CONTROLLER
 * Supports DELETE and PATCH on /api/admin/debates/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminService } from '@/modules/admin/admin.service';
import { isAuthorizedAdmin } from '@/modules/auth/authorization';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Debate ID is required' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { action, penalty, status, trendingScore } = body;

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
