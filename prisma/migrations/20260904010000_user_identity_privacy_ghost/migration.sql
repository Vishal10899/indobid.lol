-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_private" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "ghost_mode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "ghost_display_name" TEXT;

-- AlterTable
ALTER TABLE "debates" ADD COLUMN IF NOT EXISTS "is_ghost" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "contributions" ADD COLUMN IF NOT EXISTS "is_ghost" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "actor_id" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "username_change_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "old_username" TEXT,
    "new_username" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "username_change_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "username_change_history_user_id_changed_at_idx" ON "username_change_history"("user_id", "changed_at" DESC);

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'username_change_history_user_id_fkey'
    ) THEN
        ALTER TABLE "username_change_history" ADD CONSTRAINT "username_change_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
