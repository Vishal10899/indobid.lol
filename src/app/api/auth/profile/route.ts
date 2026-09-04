import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-auth';
import { userService } from '@/modules/users/user.service';
import { toAuthenticatedUserDTO } from '@/modules/users/user.dto';
import { ValidationError, ConflictError, NotFoundError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const [profile, usernameStatus] = await Promise.all([
      userService.getProfile(session.username, session.userId),
      userService.getUsernameChangeStatus(session.userId),
    ]);

    return NextResponse.json({
      success: true,
      profile,
      usernameStatus,
    });
  } catch (error) {
    console.error('Fetch profile settings error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch profile settings' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      displayName,
      username,
      bio,
      avatarUrl,
      interests,
      countryCode,
      isPrivate,
      ghostMode,
    } = body;

    const updatedUser = await userService.updateProfile(session.userId, {
      displayName,
      username,
      bio,
      avatarUrl,
      interests,
      countryCode,
      isPrivate,
      ghostMode,
    });

    return NextResponse.json({
      success: true,
      user: toAuthenticatedUserDTO(updatedUser),
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }

    console.error('Profile update error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 });
  }
}
