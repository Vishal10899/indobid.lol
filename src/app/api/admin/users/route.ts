/**
 * INDOBID — ADMIN USERS CONTROLLER
 * Thin controller delegating to adminService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminService } from '@/modules/admin/admin.service';
import { isAuthorizedAdmin } from '@/modules/auth/authorization';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isAuthorizedAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';

    const { users } = await adminService.listUsers(0, 50, search);
    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error('Admin users error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isAuthorizedAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { userId, isSuspended, isVerified, role } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const updatedUser = await adminService.moderateUser(userId, {
      isSuspended,
      isVerified,
      role,
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error('Admin update user error:', error);
    const status = error.message === 'User not found' ? 404 : 400;
    return NextResponse.json({ error: error.message || 'Failed to update user' }, { status });
  }
}
