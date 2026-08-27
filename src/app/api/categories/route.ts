import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { CANONICAL_CATEGORIES, ensureCategoriesInDb } from '@/lib/categories';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export async function GET() {
  try {
    let categories = await prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: {
            listings: {
              where: { status: 'active', verifiedBid: { gt: 0 } },
            },
          },
        },
      },
    });

    // Auto-sync if DB is missing any canonical categories
    if (categories.length < CANONICAL_CATEGORIES.length) {
      await ensureCategoriesInDb(prisma);
      categories = await prisma.category.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
          _count: {
            select: {
              listings: {
                where: { status: 'active', verifiedBid: { gt: 0 } },
              },
            },
          },
        },
      });
    }

    const formatted = categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      count: c._count.listings,
    }));

    return NextResponse.json({ categories: formatted }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

