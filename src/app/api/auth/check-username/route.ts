import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const USERNAME_REGEX = /^[a-z0-9_]{3,25}$/;

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const usernameParam = searchParams.get('username');

    if (!usernameParam || typeof usernameParam !== 'string') {
      return NextResponse.json(
        { available: false, error: 'Username parameter is required' },
        { status: 400 }
      );
    }

    const cleanUsername = usernameParam.trim().toLowerCase();

    if (!USERNAME_REGEX.test(cleanUsername)) {
      return NextResponse.json(
        {
          available: false,
          error: 'Username must be 3-25 characters (lowercase alphanumeric and underscores only)',
        },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { username: cleanUsername },
      select: { id: true, username: true },
    });

    return NextResponse.json({
      available: !existingUser,
      username: cleanUsername,
      message: existingUser ? 'Username is already taken' : 'Username is available',
    });
  } catch (error) {
    console.error('Check username error:', error);
    return NextResponse.json(
      { available: false, error: 'Failed to verify username availability' },
      { status: 500 }
    );
  }
}
