-- CreateIndex
CREATE INDEX IF NOT EXISTS "debates_status_impression_count_idx" ON "debates"("status", "impression_count" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "debates_status_like_count_idx" ON "debates"("status", "like_count" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "debates_author_id_status_created_at_idx" ON "debates"("author_id", "status", "created_at" DESC);
