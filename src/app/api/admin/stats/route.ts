/**
 * INDOBID — ADMIN STATS API CONTROLLER
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
    const metrics = await adminService.getStatsMetrics();
    return NextResponse.json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Failed to aggregate admin statistics' }, { status: 500 });
  }
}
