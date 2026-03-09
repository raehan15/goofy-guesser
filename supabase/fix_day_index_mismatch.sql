-- ============================================
-- FIX: DAY_INDEX MISMATCH BUG
-- ============================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- This script:
--   1. Shows you which leaderboard view/materialized view is currently active
--   2. Adds a proper UNIQUE constraint on (user_id, group_id, local_date)
--   3. Ensures the correct (local_date-based) leaderboard view is active

-- ============================================
-- STEP 1: DIAGNOSE - Check what leaderboard_scores currently is
-- ============================================
-- Run this SELECT first to see what you have:
SELECT 
  c.relname AS name,
  CASE c.relkind
    WHEN 'v' THEN 'REGULAR VIEW'
    WHEN 'm' THEN 'MATERIALIZED VIEW'
    WHEN 'r' THEN 'TABLE'
  END AS type
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'leaderboard_scores'
AND n.nspname = 'public';

-- ============================================
-- STEP 2: Show the view definition (so you can see if it uses day_index or local_date)
-- ============================================
-- For a regular VIEW:
SELECT pg_get_viewdef('leaderboard_scores'::regclass, true);

-- ============================================
-- STEP 3: Add UNIQUE constraint on (user_id, group_id, local_date) 
-- This prevents duplicate submissions per local date per group.
-- The old constraint UNIQUE(user_id, group_id, day_index) can stay 
-- but this new one is what actually matters.
-- ============================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_results_user_group_localdate 
ON daily_results(user_id, group_id, local_date)
WHERE group_id IS NOT NULL;

-- ============================================
-- STEP 4: Ensure the correct local_date-based VIEW is active
-- ============================================
-- Drop any existing materialized or regular view
DO $$ 
BEGIN
  -- Try dropping as materialized view first
  BEGIN
    EXECUTE 'DROP MATERIALIZED VIEW IF EXISTS leaderboard_scores CASCADE';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  -- Then try as regular view
  BEGIN
    EXECUTE 'DROP VIEW IF EXISTS leaderboard_scores CASCADE';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

-- Recreate as a regular VIEW using local_date (not day_index!)
CREATE VIEW leaderboard_scores AS
WITH daily_winners AS (
  SELECT 
    group_id,
    local_date,
    MIN(guess_count) AS min_guesses
  FROM daily_results
  WHERE solved = true
  GROUP BY group_id, local_date
),
point_earners AS (
  SELECT 
    dr.user_id,
    dr.group_id,
    1 AS points
  FROM daily_results dr
  JOIN daily_winners dw 
    ON dr.group_id = dw.group_id 
    AND dr.local_date = dw.local_date
    AND dr.guess_count = dw.min_guesses
  WHERE dr.solved = true
),
earned_scores AS (
  SELECT 
    group_id,
    user_id,
    SUM(points) AS earned_points
  FROM point_earners
  GROUP BY group_id, user_id
),
adjustment_totals AS (
  SELECT 
    group_id,
    user_id,
    SUM(adjustment) AS adjustment_points
  FROM score_adjustments
  GROUP BY group_id, user_id
),
current_members AS (
  SELECT group_id, user_id FROM group_members
)
SELECT 
  cm.group_id,
  cm.user_id,
  p.username,
  COALESCE(es.earned_points, 0) + COALESCE(at.adjustment_points, 0) AS total_score,
  COALESCE(es.earned_points, 0) AS games_won
FROM current_members cm
JOIN profiles p ON p.id = cm.user_id
LEFT JOIN earned_scores es ON es.group_id = cm.group_id AND es.user_id = cm.user_id
LEFT JOIN adjustment_totals at ON at.group_id = cm.group_id AND at.user_id = cm.user_id
ORDER BY total_score DESC;

-- Grant permissions
GRANT SELECT ON leaderboard_scores TO authenticated;
GRANT SELECT ON leaderboard_scores TO anon;

-- ============================================
-- VERIFY
-- ============================================
-- Check the view is now correct:
SELECT pg_get_viewdef('leaderboard_scores'::regclass, true);
-- Should show local_date, NOT day_index
