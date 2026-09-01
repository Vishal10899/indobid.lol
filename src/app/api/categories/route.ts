import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { CANONICAL_CATEGORIES } from '@/lib/categories';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const categoriesFromDb = await prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
        sortOrder: true,
        _count: {
          select: {
            debates: {
              where: { status: 'active' },
            },
          },
        },
      },
    });

    const categories = categoriesFromDb.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      count: c._count.debates,
    }));

    return NextResponse.json({
      success: true,
      categories: categories.length > 0 ? categories : CANONICAL_CATEGORIES.map((c) => ({ ...c, count: 0 })),
    });
  } catch (error) {
    console.error('Categories API error:', error);
    return NextResponse.json(
      { success: false, categories: CANONICAL_CATEGORIES.map((c) => ({ ...c, count: 0 })) },
      { status: 500 }
    );
  }
}
