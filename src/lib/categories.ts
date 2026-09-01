/**
 * CANONICAL CATEGORY SYSTEM — SINGLE SOURCE OF TRUTH
 * Used across the entire application:
 * - HeroBidSection
 * - BidModal
 * - CategoryNav
 * - Admin listing moderation & creation
 * - API validation & database syncing
 * - Automated test fixtures
 */

export interface CategoryDefinition {
  name: string;
  slug: string;
  icon?: string;
  sortOrder: number;
}

export const CANONICAL_CATEGORIES: CategoryDefinition[] = [
  { name: 'AI', slug: 'ai', icon: 'Bot', sortOrder: 1 },
  { name: 'Technology', slug: 'technology', icon: 'Cpu', sortOrder: 2 },
  { name: 'Startups', slug: 'startups', icon: 'Rocket', sortOrder: 3 },
  { name: 'Business', slug: 'business', icon: 'Briefcase', sortOrder: 4 },
  { name: 'Money', slug: 'money', icon: 'Coins', sortOrder: 5 },
  { name: 'Society', slug: 'society', icon: 'Users', sortOrder: 6 },
  { name: 'Education', slug: 'education', icon: 'GraduationCap', sortOrder: 7 },
  { name: 'Science', slug: 'science', icon: 'FlaskConical', sortOrder: 8 },
  { name: 'Culture', slug: 'culture', icon: 'Sparkles', sortOrder: 9 },
  { name: 'Politics', slug: 'politics', icon: 'Landmark', sortOrder: 10 },
  { name: 'Lifestyle', slug: 'lifestyle', icon: 'Heart', sortOrder: 11 },
  { name: 'Other', slug: 'other', icon: 'Globe', sortOrder: 12 },
];

export const DEFAULT_CATEGORY_SLUG = 'all';
export const DEFAULT_CATEGORY_NAME = 'All';

/**
 * Returns canonical category definition by slug
 */
export function getCategoryBySlug(slug: string): CategoryDefinition | undefined {
  if (!slug) return undefined;
  const normalized = slug.toLowerCase().trim();
  return CANONICAL_CATEGORIES.find((c) => c.slug.toLowerCase() === normalized);
}

/**
 * Validates if a given slug is in the canonical category taxonomy
 */
export function isValidCategorySlug(slug: string): boolean {
  if (!slug) return false;
  const normalized = slug.toLowerCase().trim();
  return normalized === 'all' || CANONICAL_CATEGORIES.some((c) => c.slug.toLowerCase() === normalized);
}

/**
 * Ensures all canonical categories exist in the database (self-healing idempotency)
 */
export async function ensureCategoriesInDb(prismaClient: any) {
  try {
    const existingCount = await prismaClient.category.count();
    if (existingCount >= CANONICAL_CATEGORIES.length) {
      return;
    }

    for (const cat of CANONICAL_CATEGORIES) {
      const existing = await prismaClient.category.findFirst({
        where: {
          OR: [
            { slug: cat.slug },
            { slug: cat.slug.toLowerCase() },
            { name: cat.name },
          ],
        },
      });

      if (existing) {
        await prismaClient.category.update({
          where: { id: existing.id },
          data: {
            name: cat.name,
            slug: cat.slug,
            icon: cat.icon,
            sortOrder: cat.sortOrder,
          },
        });
      } else {
        await prismaClient.category.create({
          data: {
            name: cat.name,
            slug: cat.slug,
            icon: cat.icon,
            sortOrder: cat.sortOrder,
          },
        });
      }
    }
  } catch (error) {
    console.error('Error ensuring canonical categories in DB:', error);
  }
}

