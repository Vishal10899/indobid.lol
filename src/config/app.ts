/**
 * INDOBID — APPLICATION & PRODUCT CONSTANTS
 * Single source of truth for pagination, debate constraints, and business thresholds.
 */

export const appConfig = {
  name: 'IndoBid',
  tagline: 'The Social Marketplace for Human Conviction',
  domain: 'indobid.lol',
  supportEmail: 'support@indobid.lol',
  
  // Economics Constants (Paise: $1 = 100 paise)
  money: {
    MINIMUM_DEBATE_PAISE: 200,      // $2.00 USD
    MINIMUM_INCREMENT_PAISE: 100,   // $1.00 USD
    CREATOR_SHARE_BPS: 5000,        // 50.00%
    PLATFORM_FEE_BPS: 5000,         // 50.00%
    DEFAULT_CURRENCY: 'INR',
  },

  // Pagination & Lists
  pagination: {
    DEFAULT_FEED_LIMIT: 20,
    MAX_FEED_LIMIT: 50,
    DEFAULT_COMMENTS_LIMIT: 30,
    MAX_COMMENTS_LIMIT: 100,
    DEFAULT_USERS_LIMIT: 50,
  },

  // Debate Content Constraints
  debateConstraints: {
    MIN_TITLE_LENGTH: 3,
    MAX_TITLE_LENGTH: 200,
    MIN_CONTENT_LENGTH: 10,
    MAX_CONTENT_LENGTH: 5000,
    MIN_ARGUMENT_LENGTH: 10,
    MAX_ARGUMENT_LENGTH: 5000,
  },

  // Media Constraints
  media: {
    MAX_AVATAR_SIZE_BYTES: 2 * 1024 * 1024, // 2MB
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  },
} as const;

export type AppConfig = typeof appConfig;
