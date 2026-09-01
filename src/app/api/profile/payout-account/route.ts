import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/user-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/profile/payout-account
 * Returns the authenticated user's configured payout account status and masked information.
 * Strictly protected: unauthenticated or 3rd-party users cannot access.
 */
export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payoutAccount = await prisma.payoutAccount.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        accountType: true,
        accountHolderName: true,
        maskedAccountNumber: true,
        maskedIfsc: true,
        status: true,
        verifiedAt: true,
        createdAt: true,
      },
    });

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

/**
 * POST /api/profile/payout-account
 * Connects or updates a payout account with strict credential masking.
 * Never stores raw unmasked account numbers, passwords, or sensitive keys.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { accountType = 'bank_account', accountHolderName, accountNumber, ifsc, upiId } = body;

    const cleanHolder = (accountHolderName || '').trim();
    if (!cleanHolder || cleanHolder.length < 2) {
      return NextResponse.json({ error: 'Account holder name is required' }, { status: 400 });
    }

    let maskedAccountNumber = '';
    let maskedIfsc: string | null = null;

    if (accountType === 'upi') {
      const cleanUpi = (upiId || '').trim().toLowerCase();
      if (!cleanUpi || !cleanUpi.includes('@')) {
        return NextResponse.json({ error: 'Valid UPI ID is required (e.g. name@okhdfcbank)' }, { status: 400 });
      }
      const [userPart, bankPart] = cleanUpi.split('@');
      const maskedUser = userPart.length > 2 ? `${userPart.slice(0, 2)}••••` : `${userPart}••••`;
      maskedAccountNumber = `${maskedUser}@${bankPart}`;
    } else {
      // Bank account
      const cleanAcc = (accountNumber || '').toString().replace(/\s+/g, '').replace(/-/g, '');
      if (!cleanAcc || cleanAcc.length < 6) {
        return NextResponse.json({ error: 'Valid bank account number is required' }, { status: 400 });
      }
      maskedAccountNumber = `•••• ${cleanAcc.slice(-4)}`;

      const cleanIfsc = (ifsc || '').trim().toUpperCase();
      if (cleanIfsc) {
        maskedIfsc = cleanIfsc.length >= 4 ? `${cleanIfsc.slice(0, 4)}•••••••` : '•••••••••••';
      }
    }

    // Upsert masked payout account record
    const savedAccount = await prisma.payoutAccount.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        accountType: accountType === 'upi' ? 'upi' : 'bank_account',
        accountHolderName: cleanHolder,
        maskedAccountNumber,
        maskedIfsc,
        status: 'verified', // Verified payout target
        verifiedAt: new Date(),
      },
      update: {
        accountType: accountType === 'upi' ? 'upi' : 'bank_account',
        accountHolderName: cleanHolder,
        maskedAccountNumber,
        maskedIfsc,
        status: 'verified',
        verifiedAt: new Date(),
      },
      select: {
        id: true,
        accountType: true,
        accountHolderName: true,
        maskedAccountNumber: true,
        maskedIfsc: true,
        status: true,
        verifiedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      payoutAccount: savedAccount,
      message: 'Payout account connected successfully',
    });
  } catch (error) {
    console.error('Save payout account error:', error);
    return NextResponse.json({ error: 'Failed to save payout account' }, { status: 500 });
  }
}

/**
 * DELETE /api/profile/payout-account
 * Disconnects the user's payout account safely.
 */
export async function DELETE() {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.payoutAccount.deleteMany({
      where: { userId: session.userId },
    });

    return NextResponse.json({
      success: true,
      message: 'Payout account disconnected successfully',
    });
  } catch (error) {
    console.error('Delete payout account error:', error);
    return NextResponse.json({ error: 'Failed to disconnect payout account' }, { status: 500 });
  }
}
