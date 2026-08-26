import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedAdmin, ADMIN_EMAIL } from '@/lib/auth';

export async function GET(request: NextRequest) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    email: ADMIN_EMAIL,
  });
}
