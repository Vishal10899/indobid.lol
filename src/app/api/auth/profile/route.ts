import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-auth';
import { prisma } from '@/lib/db';

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { displayName, bio, avatarUrl, interests } = body;

    const updatedUser = await prisma.user.update({
      where: { id: session.userId },
      data: {
        displayName: displayName !== undefined ? displayName.trim() : undefined,
        bio: bio !== undefined ? bio.trim().substring(0, 300) : undefined,
        avatarUrl: avatarUrl !== undefined ? avatarUrl.trim() : undefined,
        interests: interests !== undefined ? interests.trim().substring(0, 200) : undefined,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        interests: true,
      },
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 });
  }
}
