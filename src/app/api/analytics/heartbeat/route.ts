import { NextRequest, NextResponse } from 'next/server';
import { recordVisitorHeartbeat } from '@/lib/visitor-tracker';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { sessionToken } = body;

    if (!sessionToken || typeof sessionToken !== 'string') {
      return NextResponse.json({ error: 'Valid sessionToken is required' }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const clientIp = (forwardedFor ? forwardedFor.split(',')[0].trim() : realIp) || '127.0.0.1';
    const userAgent = request.headers.get('user-agent');

    const result = await recordVisitorHeartbeat({
      sessionToken,
      ip: clientIp,
      userAgent,
    });

    return NextResponse.json(result, {
      status: 200,
      headers: NO_CACHE_HEADERS,
    });
  } catch (error) {
    console.error('Visitor heartbeat API error:', error);
    return NextResponse.json({ success: false }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
