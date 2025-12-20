-- ============================================
-- RESET: LOCAL DATE SCORING (Clean Slate)
-- ============================================
-- Run this script to reset the leaderboard to use local_date only.
-- This removes any materialized views and creates a simple regular view.

-- ============================================
-- 1. DROP ALL EXISTING VIEWS (try regular VIEW first, then materialized)
-- ============================================
-- PostgreSQL requires correct DROP type, so we try both
DROP VIEW IF EXISTS leaderboard_scores CASCADE;
DROP VIEW IF EXISTS pending_daily_results CASCADE;

-- In case it's a materialized view (from previous scripts)
-- This will fail silently if it doesn't exist or isn't materialized
DO $$ 
BEGIN
  EXECUTE 'DROP MATERIALIZED VIEW IF EXISTS leaderboard_scores CASCADE';
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore errors
END $$;

DROP FUNCTION IF EXISTS is_day_finalized CASCADE;
DROP FUNCTION IF EXISTS refresh_leaderboard CASCADE;

-- ============================================
-- 2. CREATE SIMPLE VIEW (local_date based)
-- ============================================
-- Scoring: For each group + local_date, the user(s) with fewest guesses get 1 point.
-- Ties: All tied winners get 1 point.

CREATE VIEW leaderboard_scores AS
WITH daily_winners AS (
  -- For each group and LOCAL DATE, find the minimum guess count
  SELECT 
    group_id,
    local_date,
    MIN(guess_count) AS min_guesses
  FROM daily_results
  WHERE solved = true
  GROUP BY group_id, local_date
),
point_earners AS (
  -- Users who matched the minimum for that day
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
  -- Sum up points per user per group
  SELECT 
    group_id,
    user_id,
    SUM(points) AS earned_points
  FROM point_earners
  GROUP BY group_id, user_id
),
adjustment_totals AS (
  -- Sum up manual admin adjustments
  SELECT 
    group_id,
    user_id,
    SUM(adjustment) AS adjustment_points
  FROM score_adjustments
  GROUP BY group_id, user_id
),
current_members AS (
  -- Only include CURRENT group members (excludes people who left)
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

-- ============================================
-- 3. GRANT PERMISSIONS
-- ============================================
GRANT SELECT ON leaderboard_scores TO authenticated;
GRANT SELECT ON leaderboard_scores TO anon;

-- ============================================
-- 4. VERIFY
-- ============================================
-- SELECT * FROM leaderboard_scores LIMIT 10;
