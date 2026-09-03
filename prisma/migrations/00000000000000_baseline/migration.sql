-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "bio" TEXT,
    "password_hash" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verified_at" TIMESTAMP(3),
    "is_suspended" BOOLEAN NOT NULL DEFAULT false,
    "interests" TEXT,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "role" TEXT NOT NULL DEFAULT 'user',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debates" (
    "id" TEXT NOT NULL,
    "author_id" TEXT,
    "author_username" TEXT NOT NULL DEFAULT 'anonymous',
    "author_display_name" TEXT NOT NULL DEFAULT 'Debater',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "original_contribution" INTEGER NOT NULL DEFAULT 1000,
    "total_verified_contribution" INTEGER NOT NULL DEFAULT 0,
    "contribution_count" INTEGER NOT NULL DEFAULT 0,
    "last_contribution_amount" INTEGER NOT NULL DEFAULT 0,
    "last_contribution_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending_payment',
    "trending_score" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "report_count" INTEGER NOT NULL DEFAULT 0,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "impression_count" INTEGER NOT NULL DEFAULT 0,
    "hashtags" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contributions" (
    "id" TEXT NOT NULL,
    "debate_id" TEXT NOT NULL,
    "author_id" TEXT,
    "author_username" TEXT NOT NULL DEFAULT 'anonymous',
    "author_display_name" TEXT NOT NULL DEFAULT 'Debater',
    "amount" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'pending_payment',
    "provider_payment_id" TEXT,
    "report_count" INTEGER NOT NULL DEFAULT 0,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" TIMESTAMP(3),

    CONSTRAINT "contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debate_likes" (
    "id" TEXT NOT NULL,
    "debate_id" TEXT NOT NULL,
    "user_id" TEXT,
    "user_ip_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debate_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debate_bookmarks" (
    "id" TEXT NOT NULL,
    "debate_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debate_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debate_impressions" (
    "id" TEXT NOT NULL,
    "debate_id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debate_impressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follows" (
    "id" TEXT NOT NULL,
    "follower_id" TEXT NOT NULL,
    "following_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link_url" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "participant_1_id" TEXT NOT NULL,
    "participant_2_id" TEXT NOT NULL,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direct_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "debate_id" TEXT,
    "contribution_id" TEXT,
    "listing_id" TEXT,
    "bid_id" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'razorpay',
    "provider_payment_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL,
    "customer_email" TEXT,
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_earnings_ledger" (
    "id" TEXT NOT NULL,
    "creator_id" TEXT,
    "creator_username" TEXT NOT NULL,
    "debate_id" TEXT NOT NULL,
    "contribution_id" TEXT NOT NULL,
    "payment_id" TEXT,
    "gross_amount_paise" INTEGER NOT NULL,
    "creator_reward_paise" INTEGER NOT NULL,
    "platform_fee_paise" INTEGER NOT NULL,
    "percentage_bps" INTEGER NOT NULL DEFAULT 7000,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "idempotency_key" TEXT NOT NULL,
    "payout_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "reversed_at" TIMESTAMP(3),
    "reversal_reason" TEXT,

    CONSTRAINT "creator_earnings_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_type" TEXT NOT NULL DEFAULT 'bank_account',
    "account_holder_name" TEXT NOT NULL,
    "masked_account_number" TEXT NOT NULL,
    "masked_ifsc" TEXT,
    "status" TEXT NOT NULL DEFAULT 'verified',
    "provider_account_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "verified_at" TIMESTAMP(3),

    CONSTRAINT "payout_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debate_reports" (
    "id" TEXT NOT NULL,
    "debate_id" TEXT,
    "contribution_id" TEXT,
    "reason" TEXT NOT NULL,
    "ip_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debate_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debate_activity_events" (
    "id" TEXT NOT NULL,
    "debate_id" TEXT NOT NULL,
    "contribution_id" TEXT,
    "type" TEXT NOT NULL,
    "author_username" TEXT NOT NULL,
    "author_display_name" TEXT NOT NULL DEFAULT 'Debater',
    "amount" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debate_activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" TEXT NOT NULL,
    "destination_url" TEXT NOT NULL,
    "canonical_url" TEXT NOT NULL,
    "destination_type" TEXT NOT NULL DEFAULT 'website',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "logo_url" TEXT,
    "category_id" TEXT NOT NULL,
    "verified_bid" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "visit_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "is_special" BOOLEAN NOT NULL DEFAULT false,
    "country_code" TEXT DEFAULT 'IN',
    "social_website" TEXT,
    "social_instagram" TEXT,
    "social_youtube" TEXT,
    "social_x" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "bid_reached_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bids" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "previous_bid" INTEGER NOT NULL DEFAULT 0,
    "new_total_bid" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "payment_provider" TEXT NOT NULL DEFAULT 'cashfree',
    "payment_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "bidder_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_events" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "destination_type" TEXT NOT NULL DEFAULT 'website',
    "amount" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clicks" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "ip_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "referrer" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "ip_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_heartbeat_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "page_views" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "visitor_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_visits" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_otps" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "last_sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_sort_order_idx" ON "categories"("sort_order" ASC);

-- CreateIndex
CREATE INDEX "debates_status_trending_score_idx" ON "debates"("status", "trending_score" DESC);

-- CreateIndex
CREATE INDEX "debates_status_total_verified_contribution_idx" ON "debates"("status", "total_verified_contribution" DESC);

-- CreateIndex
CREATE INDEX "debates_status_created_at_idx" ON "debates"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "debates_status_last_contribution_at_idx" ON "debates"("status", "last_contribution_at" DESC);

-- CreateIndex
CREATE INDEX "debates_category_id_status_trending_score_idx" ON "debates"("category_id", "status", "trending_score" DESC);

-- CreateIndex
CREATE INDEX "debates_author_username_idx" ON "debates"("author_username");

-- CreateIndex
CREATE INDEX "contributions_debate_id_status_sequence_idx" ON "contributions"("debate_id", "status", "sequence" ASC);

-- CreateIndex
CREATE INDEX "contributions_status_created_at_idx" ON "contributions"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "contributions_author_username_idx" ON "contributions"("author_username");

-- CreateIndex
CREATE INDEX "contributions_provider_payment_id_idx" ON "contributions"("provider_payment_id");

-- CreateIndex
CREATE INDEX "debate_likes_debate_id_idx" ON "debate_likes"("debate_id");

-- CreateIndex
CREATE INDEX "debate_likes_user_id_idx" ON "debate_likes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "debate_likes_debate_id_user_id_key" ON "debate_likes"("debate_id", "user_id");

-- CreateIndex
CREATE INDEX "debate_bookmarks_user_id_created_at_idx" ON "debate_bookmarks"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "debate_bookmarks_debate_id_user_id_key" ON "debate_bookmarks"("debate_id", "user_id");

-- CreateIndex
CREATE INDEX "debate_impressions_debate_id_idx" ON "debate_impressions"("debate_id");

-- CreateIndex
CREATE UNIQUE INDEX "debate_impressions_debate_id_session_token_key" ON "debate_impressions"("debate_id", "session_token");

-- CreateIndex
CREATE INDEX "follows_follower_id_idx" ON "follows"("follower_id");

-- CreateIndex
CREATE INDEX "follows_following_id_idx" ON "follows"("following_id");

-- CreateIndex
CREATE UNIQUE INDEX "follows_follower_id_following_id_key" ON "follows"("follower_id", "following_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at" DESC);

-- CreateIndex
CREATE INDEX "conversations_participant_1_id_last_message_at_idx" ON "conversations"("participant_1_id", "last_message_at" DESC);

-- CreateIndex
CREATE INDEX "conversations_participant_2_id_last_message_at_idx" ON "conversations"("participant_2_id", "last_message_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "conversations_participant_1_id_participant_2_id_key" ON "conversations"("participant_1_id", "participant_2_id");

-- CreateIndex
CREATE INDEX "direct_messages_conversation_id_created_at_idx" ON "direct_messages"("conversation_id", "created_at" ASC);

-- CreateIndex
CREATE INDEX "direct_messages_recipient_id_is_read_idx" ON "direct_messages"("recipient_id", "is_read");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_payment_id_key" ON "payments"("provider_payment_id");

-- CreateIndex
CREATE INDEX "payments_debate_id_created_at_idx" ON "payments"("debate_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "payments_contribution_id_idx" ON "payments"("contribution_id");

-- CreateIndex
CREATE INDEX "payments_listing_id_created_at_idx" ON "payments"("listing_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "payments_created_at_idx" ON "payments"("created_at" DESC);

-- CreateIndex
CREATE INDEX "payments_provider_payment_id_idx" ON "payments"("provider_payment_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "creator_earnings_ledger_contribution_id_key" ON "creator_earnings_ledger"("contribution_id");

-- CreateIndex
CREATE UNIQUE INDEX "creator_earnings_ledger_idempotency_key_key" ON "creator_earnings_ledger"("idempotency_key");

-- CreateIndex
CREATE INDEX "creator_earnings_ledger_creator_username_status_idx" ON "creator_earnings_ledger"("creator_username", "status");

-- CreateIndex
CREATE INDEX "creator_earnings_ledger_debate_id_status_idx" ON "creator_earnings_ledger"("debate_id", "status");

-- CreateIndex
CREATE INDEX "creator_earnings_ledger_created_at_idx" ON "creator_earnings_ledger"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "payout_accounts_user_id_key" ON "payout_accounts"("user_id");

-- CreateIndex
CREATE INDEX "payout_accounts_status_idx" ON "payout_accounts"("status");

-- CreateIndex
CREATE INDEX "debate_reports_debate_id_created_at_idx" ON "debate_reports"("debate_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "debate_reports_status_idx" ON "debate_reports"("status");

-- CreateIndex
CREATE INDEX "debate_activity_events_created_at_idx" ON "debate_activity_events"("created_at" DESC);

-- CreateIndex
CREATE INDEX "debate_activity_events_debate_id_created_at_idx" ON "debate_activity_events"("debate_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "listings_canonical_url_key" ON "listings"("canonical_url");

-- CreateIndex
CREATE INDEX "listings_status_verified_bid_bid_reached_at_idx" ON "listings"("status", "verified_bid" DESC, "bid_reached_at" ASC);

-- CreateIndex
CREATE INDEX "listings_category_id_status_verified_bid_bid_reached_at_idx" ON "listings"("category_id", "status", "verified_bid" DESC, "bid_reached_at" ASC);

-- CreateIndex
CREATE INDEX "listings_status_visit_count_idx" ON "listings"("status", "visit_count" DESC);

-- CreateIndex
CREATE INDEX "listings_canonical_url_idx" ON "listings"("canonical_url");

-- CreateIndex
CREATE INDEX "listings_status_created_at_idx" ON "listings"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "bids_listing_id_created_at_idx" ON "bids"("listing_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "bids_payment_id_idx" ON "bids"("payment_id");

-- CreateIndex
CREATE INDEX "bids_status_created_at_idx" ON "bids"("status", "created_at");

-- CreateIndex
CREATE INDEX "activity_events_created_at_idx" ON "activity_events"("created_at" DESC);

-- CreateIndex
CREATE INDEX "activity_events_listing_id_created_at_idx" ON "activity_events"("listing_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "clicks_listing_id_created_at_idx" ON "clicks"("listing_id", "created_at");

-- CreateIndex
CREATE INDEX "clicks_ip_hash_listing_id_created_at_idx" ON "clicks"("ip_hash", "listing_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "visitor_sessions_session_token_key" ON "visitor_sessions"("session_token");

-- CreateIndex
CREATE INDEX "visitor_sessions_last_heartbeat_at_idx" ON "visitor_sessions"("last_heartbeat_at" DESC);

-- CreateIndex
CREATE INDEX "visitor_sessions_first_seen_at_idx" ON "visitor_sessions"("first_seen_at" DESC);

-- CreateIndex
CREATE INDEX "listing_visits_listing_id_created_at_idx" ON "listing_visits"("listing_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "listing_visits_listing_id_session_token_key" ON "listing_visits"("listing_id", "session_token");

-- CreateIndex
CREATE INDEX "email_otps_email_expires_at_idx" ON "email_otps"("email", "expires_at");

-- CreateIndex
CREATE INDEX "email_otps_email_used_idx" ON "email_otps"("email", "used");

-- CreateIndex
CREATE INDEX "password_reset_tokens_email_expires_at_idx" ON "password_reset_tokens"("email", "expires_at");

-- CreateIndex
CREATE INDEX "password_reset_tokens_email_used_idx" ON "password_reset_tokens"("email", "used");

-- AddForeignKey
ALTER TABLE "debates" ADD CONSTRAINT "debates_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debates" ADD CONSTRAINT "debates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_likes" ADD CONSTRAINT "debate_likes_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_likes" ADD CONSTRAINT "debate_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_bookmarks" ADD CONSTRAINT "debate_bookmarks_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_bookmarks" ADD CONSTRAINT "debate_bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_impressions" ADD CONSTRAINT "debate_impressions_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "contributions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bids"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_earnings_ledger" ADD CONSTRAINT "creator_earnings_ledger_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_earnings_ledger" ADD CONSTRAINT "creator_earnings_ledger_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_earnings_ledger" ADD CONSTRAINT "creator_earnings_ledger_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "contributions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_earnings_ledger" ADD CONSTRAINT "creator_earnings_ledger_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_reports" ADD CONSTRAINT "debate_reports_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_reports" ADD CONSTRAINT "debate_reports_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "contributions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_activity_events" ADD CONSTRAINT "debate_activity_events_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_activity_events" ADD CONSTRAINT "debate_activity_events_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "contributions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_visits" ADD CONSTRAINT "listing_visits_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

