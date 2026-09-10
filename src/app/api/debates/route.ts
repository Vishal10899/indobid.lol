/**
 * INDOBID — DEBATES API CONTROLLER
 * Thin HTTP controller delegating to debateService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { debateService } from '@/modules/debates/debate.service';
import { getCurrentUser } from '@/modules/auth/session.service';
import { isAuthorizedAdmin } from '@/modules/auth/authorization';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const createDebateSchema = z.object({
  title: z
    .string()
    .min(5, 'Debate title/opinion must be at least 5 characters')
    .max(200, 'Title cannot exceed 200 characters'),
  content: z
    .string()
    .min(5, 'Main argument must be at least 5 characters')
    .max(3000, 'Argument cannot exceed 3000 characters'),
  categorySlug: z.string().optional(),
  categoryId: z.string().optional(),
  authorUsername: z.string().max(30).optional(),
  authorDisplayName: z.string().max(50).optional(),
  isFree: z.boolean().optional(),
  amountPaise: z.number().int().optional().nullable(),
  amountRupees: z.number().optional().nullable(),
  amount: z.number().optional().nullable(),
  currency: z.string().optional().nullable(),
  currencyCode: z.string().optional().nullable(),
  countryCode: z.string().optional().nullable(),
  isAnonymous: z.boolean().optional(),
  hashtags: z.string().max(200).optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentUser();
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') || 'all';
    const sort = (searchParams.get('sort') || 'for_you') as any;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const search = searchParams.get('search') || searchParams.get('q') || '';

    const result = await debateService.getDebates({
      category,
      sort,
      page,
      limit,
      search,
      currentUserId: session?.userId || null,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Debates list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch debates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Rate Limiting
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`create-debate:${ip}`, 30, 60);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment before trying again.' },
        { status: 429 }
      );
    }

    // 2. Validate input schema
    const body = await request.json();
    const parsed = createDebateSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Invalid debate input';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    // 3. Resolve user session & Admin/Founder status
    const session = await getCurrentUser();
    const isAdmin = isAuthorizedAdmin(request);

    // 4. Delegate to Domain Service
    const response = await debateService.createDebate(parsed.data, session, isAdmin);
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Create debate API error:', error);
    const status = error.statusCode || (error.name === 'ValidationError' ? 400 : 500);
    return NextResponse.json(
      { error: error.message || 'Internal error creating debate' },
      { status }
    );
  }
}
