import { NextRequest, NextResponse } from 'next/server';
import { trackOutboundClick } from '@/lib/click-tracker';
import { getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ listingId: string }> }
) {
  const { listingId } = await context.params;

  if (!listingId) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const ip = getClientIp(request);
  const userAgent = request.headers.get('user-agent');
  const referrer = request.headers.get('referer');

  try {
    const { destinationUrl } = await trackOutboundClick({
      listingId,
      ip,
      userAgent,
      referrer,
    });

    if (!destinationUrl) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.redirect(destinationUrl, {
      status: 307,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Click redirect error:', error);
    return NextResponse.redirect(new URL('/', request.url));
  }
}
