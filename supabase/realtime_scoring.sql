-- ============================================
-- REAL-TIME SCORING WITH MATERIALIZED VIEW
-- ============================================
-- Run this AFTER schema.sql and fix_permissions.sql
-- This replaces the UTC-delayed view with real-time scoring

-- ============================================
-- 1. DROP EXISTING VIEW
-- ============================================
DROP VIEW IF EXISTS leaderboard_scores CASCADE;
DROP VIEW IF EXISTS pending_daily_results CASCADE;
DROP FUNCTION IF EXISTS is_day_finalized CASCADE;

-- ============================================
-- 2. CREATE MATERIALIZED VIEW (Real-time, no UTC delay)
-- ============================================
CREATE MATERIALIZED VIEW leaderboard_scores AS
WITH daily_winners AS (
  -- For each group and utc_date, find minimum guesses
  SELECT 
    group_id,
    utc_date,
    MIN(guess_count) AS min_guesses
  FROM daily_results
  WHERE solved = true
  GROUP BY group_id, utc_date
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
    AND dr.utc_date = dw.utc_date
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
all_members AS (
  SELECT DISTINCT group_id, user_id FROM group_members
)
SELECT 
  am.group_id,
  am.user_id,
  p.username,
  COALESCE(es.earned_points, 0) + COALESCE(at.adjustment_points, 0) AS total_score,
  COALESCE(es.earned_points, 0) AS games_won
FROM all_members am
JOIN profiles p ON p.id = am.user_id
LEFT JOIN earned_scores es ON es.group_id = am.group_id AND es.user_id = am.user_id
LEFT JOIN adjustment_totals at ON at.group_id = am.group_id AND at.user_id = am.user_id;

-- Create index on materialized view for fast lookups
CREATE UNIQUE INDEX idx_leaderboard_group_user 
ON leaderboard_scores(group_id, user_id);

-- ============================================
-- 3. CREATE REFRESH FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- CONCURRENTLY allows reads during refresh (requires unique index)
  REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_scores;
  RETURN NULL;
END;
$$;

-- ============================================
-- 4. CREATE TRIGGERS FOR AUTO-REFRESH
-- ============================================

-- Refresh after new result is inserted
DROP TRIGGER IF EXISTS trigger_refresh_leaderboard_insert ON daily_results;
CREATE TRIGGER trigger_refresh_leaderboard_insert
AFTER INSERT ON daily_results
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_leaderboard();

-- Refresh after result is deleted (for admin reset)
DROP TRIGGER IF EXISTS trigger_refresh_leaderboard_delete ON daily_results;
CREATE TRIGGER trigger_refresh_leaderboard_delete
AFTER DELETE ON daily_results
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_leaderboard();

-- Refresh after score adjustment
DROP TRIGGER IF EXISTS trigger_refresh_leaderboard_adjustment ON score_adjustments;
CREATE TRIGGER trigger_refresh_leaderboard_adjustment
AFTER INSERT OR DELETE ON score_adjustments
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_leaderboard();

-- ============================================
-- 5. GRANT PERMISSIONS
-- ============================================
GRANT SELECT ON leaderboard_scores TO authenticated;
GRANT SELECT ON leaderboard_scores TO anon;

-- ============================================
-- 6. INITIAL REFRESH
-- ============================================
REFRESH MATERIALIZED VIEW leaderboard_scores;

-- ============================================
-- VERIFICATION
-- ============================================
-- Run this to verify setup:
-- SELECT * FROM leaderboard_scores LIMIT 10;
