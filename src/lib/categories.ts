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
  { name: 'SaaS', slug: 'saas', icon: 'Cloud', sortOrder: 2 },
  { name: 'Startups', slug: 'startups', icon: 'Rocket', sortOrder: 3 },
  { name: 'FinTech', slug: 'fintech', icon: 'DollarSign', sortOrder: 4 },
  { name: 'Developer Tools', slug: 'developer-tools', icon: 'Code', sortOrder: 5 },
  { name: 'HealthTech', slug: 'healthtech', icon: 'Heart', sortOrder: 6 },
  { name: 'EdTech', slug: 'edtech', icon: 'GraduationCap', sortOrder: 7 },
  { name: 'E-commerce', slug: 'ecommerce', icon: 'ShoppingCart', sortOrder: 8 },
  { name: 'Marketplace', slug: 'marketplace', icon: 'Store', sortOrder: 9 },
  { name: 'B2B', slug: 'b2b', icon: 'Briefcase', sortOrder: 10 },
  { name: 'B2C', slug: 'b2c', icon: 'ShoppingBag', sortOrder: 11 },
  { name: 'Enterprise', slug: 'enterprise', icon: 'Building', sortOrder: 12 },
  { name: 'Productivity', slug: 'productivity', icon: 'CheckCircle2', sortOrder: 13 },
  { name: 'Marketing', slug: 'marketing', icon: 'Megaphone', sortOrder: 14 },
  { name: 'Social', slug: 'social', icon: 'Share2', sortOrder: 15 },
  { name: 'Consumer', slug: 'consumer', icon: 'UserCheck', sortOrder: 16 },
  { name: 'Cybersecurity', slug: 'cybersecurity', icon: 'ShieldCheck', sortOrder: 17 },
  { name: 'Web3 / Crypto', slug: 'web3-crypto', icon: 'Coins', sortOrder: 18 },
  { name: 'Gaming', slug: 'gaming', icon: 'Gamepad2', sortOrder: 19 },
  { name: 'Creator Economy', slug: 'creator-economy', icon: 'Sparkles', sortOrder: 20 },
  { name: 'Media', slug: 'media', icon: 'Tv', sortOrder: 21 },
  { name: 'Entertainment', slug: 'entertainment', icon: 'Film', sortOrder: 22 },
  { name: 'D2C', slug: 'd2c', icon: 'PackageCheck', sortOrder: 23 },
  { name: 'FoodTech', slug: 'foodtech', icon: 'Utensils', sortOrder: 24 },
  { name: 'Travel', slug: 'travel', icon: 'Plane', sortOrder: 25 },
  { name: 'Logistics', slug: 'logistics', icon: 'Truck', sortOrder: 26 },
  { name: 'Mobility', slug: 'mobility', icon: 'Car', sortOrder: 27 },
  { name: 'ClimateTech', slug: 'climatetech', icon: 'Leaf', sortOrder: 28 },
  { name: 'CleanTech', slug: 'cleantech', icon: 'Sun', sortOrder: 29 },
  { name: 'PropTech', slug: 'proptech', icon: 'Building2', sortOrder: 30 },
  { name: 'InsurTech', slug: 'insurtech', icon: 'Shield', sortOrder: 31 },
  { name: 'LegalTech', slug: 'legaltech', icon: 'Scale', sortOrder: 32 },
  { name: 'HRTech', slug: 'hrtech', icon: 'UserPlus', sortOrder: 33 },
  { name: 'DeepTech', slug: 'deeptech', icon: 'Cpu', sortOrder: 34 },
  { name: 'Hardware', slug: 'hardware', icon: 'HardDrive', sortOrder: 35 },
  { name: 'Robotics', slug: 'robotics', icon: 'Bot', sortOrder: 36 },
  { name: 'Biotech', slug: 'biotech', icon: 'Dna', sortOrder: 37 },
  { name: 'AgriTech', slug: 'agritech', icon: 'Sprout', sortOrder: 38 },
  { name: 'Other', slug: 'other', icon: 'Globe', sortOrder: 39 },
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

