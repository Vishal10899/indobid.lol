import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return NextResponse.json({ message: 'Cashfree webhooks are inactive. IndoBid uses Razorpay.' }, { status: 200 });
}
