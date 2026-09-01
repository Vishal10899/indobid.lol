import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user-auth';
import { prisma } from '@/lib/db';

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

// Magic bytes validator for real image header verification
function validateImageMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return true;
  }

  // GIF: 47 49 46 38
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return true;
  }

  // WebP: RIFF ... WEBP (52 49 46 46 .... 57 45 42 50)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return true;
  }

  return false;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { image } = body;

    if (!image || typeof image !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Image data is required' },
        { status: 400 }
      );
    }

    // Validate data URI prefix
    const match = image.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/);
    if (!match) {
      return NextResponse.json(
        { success: false, error: 'Invalid image format. Supported: PNG, JPEG, WebP, GIF' },
        { status: 400 }
      );
    }

    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Validate file size limit
    if (buffer.length > MAX_AVATAR_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Image size exceeds maximum limit of 2MB' },
        { status: 400 }
      );
    }

    // Validate magic bytes to prevent executable / malicious files disguised as images
    if (!validateImageMagicBytes(buffer)) {
      return NextResponse.json(
        { success: false, error: 'Uploaded file is not a valid image file' },
        { status: 400 }
      );
    }

    // Save avatar to database
    const updatedUser = await prisma.user.update({
      where: { id: session.userId },
      data: { avatarUrl: image },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
      },
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
      avatarUrl: updatedUser.avatarUrl,
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update profile photo' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.userId },
      data: { avatarUrl: null },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
      },
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
      avatarUrl: null,
    });
  } catch (error) {
    console.error('Avatar remove error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove profile photo' },
      { status: 500 }
    );
  }
}
