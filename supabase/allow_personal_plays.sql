-- ============================================
-- ALLOW NULL GROUP_ID FOR PERSONAL PLAYS
-- ============================================
-- Run this to allow users without groups to have their plays tracked.
-- Records with group_id = NULL are "personal plays" (not in any group).

-- ============================================
-- 1. ALLOW NULL ON group_id
-- ============================================
ALTER TABLE daily_results ALTER COLUMN group_id DROP NOT NULL;

-- ============================================
-- 2. ADD UNIQUE INDEX FOR PERSONAL PLAYS
-- ============================================
-- The existing UNIQUE(user_id, group_id, day_index) won't work for NULL group_id
-- because in SQL, NULL != NULL, so multiple NULLs would be allowed.
-- We need a partial unique index for personal plays.

-- This ensures: one personal play per user per local_date
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_results_personal_play 
ON daily_results(user_id, local_date) 
WHERE group_id IS NULL;

-- ============================================
-- 3. UPDATE RLS POLICIES (if needed)
-- ============================================
-- The existing "Users can insert their own results" policy should still work
-- because it just checks auth.uid() = user_id

-- Add a policy to let users view their own personal plays
DROP POLICY IF EXISTS "Users can view their own personal plays" ON daily_results;
CREATE POLICY "Users can view their own personal plays"
  ON daily_results FOR SELECT
  USING (
    group_id IS NULL AND auth.uid() = user_id
  );

-- ============================================
-- VERIFY
-- ============================================
-- Check column is now nullable:
-- SELECT column_name, is_nullable FROM information_schema.columns 
-- WHERE table_name = 'daily_results' AND column_name = 'group_id';
