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
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'Debate ID and status are required' }, { status: 400 });
    }

    const validStatuses = ['active', 'hidden', 'removed', 'pending_payment'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const updated = await adminService.updateDebate(id, { status });

    return NextResponse.json({
      success: true,
      debate: updated,
    });
  } catch (error) {
    console.error('Admin update debate error:', error);
    return NextResponse.json({ error: 'Failed to update debate' }, { status: 500 });
  }
}
