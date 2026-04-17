-- ============================================
-- FIX: DAILY RESULT UNIQUENESS + LEGACY CONFLICTS
-- ============================================
-- Purpose:
-- 1) Ensure one row per (user_id, group_id, local_date) for group play
-- 2) Ensure one row per (user_id, local_date) for personal play
-- 3) Remove legacy UNIQUE(user_id, group_id, day_index) constraint if present,
--    because it can reject valid local_date submissions and cause leaderboard misses.

-- 1) Required uniqueness for group play (idempotent submissions)
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_results_user_group_localdate
ON daily_results(user_id, group_id, local_date)
WHERE group_id IS NOT NULL;

-- 2) Required uniqueness for personal play
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_results_personal_play
ON daily_results(user_id, local_date)
WHERE group_id IS NULL;

-- 3) Drop legacy unique constraint on (user_id, group_id, day_index)
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT c.conname
  INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'daily_results'
    AND c.contype = 'u'
    AND pg_get_constraintdef(c.oid) ILIKE '%(user_id, group_id, day_index)%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.daily_results DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- Optional: keep read performance aligned with local-date scoring queries.
CREATE INDEX IF NOT EXISTS idx_daily_results_group_local_date
ON daily_results(group_id, local_date);
