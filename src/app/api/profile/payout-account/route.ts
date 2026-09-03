/**
 * INDOBID — PAYOUT ACCOUNT CONTROLLER
 * Thin controller delegating to payoutService in modules/creator-earnings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { payoutService } from '@/modules/creator-earnings/payout.service';
import { getCurrentUser } from '@/modules/auth/session.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payoutAccount = await payoutService.getAccount(session.userId);

    if (!payoutAccount) {
      return NextResponse.json({
        success: true,
        payoutAccount: {
          status: 'not_connected',
        },
      });
    }

    return NextResponse.json({
      success: true,
      payoutAccount,
    });
  } catch (error) {
    console.error('Fetch payout account error:', error);
    return NextResponse.json({ error: 'Failed to fetch payout account' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { accountType = 'bank_account', accountHolderName, accountNumber, ifsc, upiId } = body;

    const savedAccount = await payoutService.saveAccount(session.userId, {
      accountType: accountType === 'upi' ? 'upi' : 'bank_account',
      accountHolderName,
      accountNumber,
      ifsc,
      vpa: upiId,
    });

    return NextResponse.json({
      success: true,
      payoutAccount: savedAccount,
      message: 'Payout account connected successfully',
    });
  } catch (error: any) {
    console.error('Save payout account error:', error);
    const status = error.name === 'ValidationError' ? 400 : 500;
    return NextResponse.json({ error: error.message || 'Failed to save payout account' }, { status });
  }
}

export async function DELETE() {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await payoutService.disconnectAccount(session.userId);

    return NextResponse.json({
      success: true,
      message: 'Payout account disconnected successfully',
    });
  } catch (error) {
    console.error('Delete payout account error:', error);
    return NextResponse.json({ error: 'Failed to disconnect payout account' }, { status: 500 });
  }
}
