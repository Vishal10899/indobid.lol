import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isAuthorizedAdmin } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const query = searchParams.get('q') || undefined;

    const listings = await prisma.listing.findMany({
      where: {
        status: status ? status : undefined,
        OR: query
          ? [
              { title: { contains: query } },
              { canonicalUrl: { contains: query } },
              { description: { contains: query } },
            ]
          : undefined,
      },
      orderBy: [
        { verifiedBid: 'desc' },
        { bidReachedAt: 'asc' },
      ],
      include: {
        category: true,
        _count: {
          select: { bids: true, payments: true, clicks: true },
        },
      },
    });

    return NextResponse.json({ listings });
  } catch (error) {
    console.error('Admin listings fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch admin listings' }, { status: 500 });
  }
}

const updateListingSchema = z.object({
  id: z.string().min(1, 'Listing ID is required'),
  status: z.enum(['active', 'hidden', 'flagged']).optional(),
  categoryId: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
});

export async function PATCH(request: NextRequest) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = updateListingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    }

    const { id, status, categoryId, title, description } = parsed.data;

    const updated = await prisma.listing.update({
      where: { id },
      data: {
        status: status || undefined,
        categoryId: categoryId || undefined,
        title: title || undefined,
        description: description || undefined,
      },
      include: { category: true },
    });

    return NextResponse.json({ success: true, listing: updated });
  } catch (error) {
    console.error('Admin listing update error:', error);
    return NextResponse.json({ error: 'Failed to update listing' }, { status: 500 });
  }
}
