-- ============================================
-- LOCAL DATE BASED SCORING UPDATE
-- ============================================
-- Run this AFTER realtime_scoring.sql
-- Changes scoring to use local_date instead of utc_date
-- This ensures users on the same local date are compared

-- ============================================
-- 1. DROP OLD MATERIALIZED VIEW
-- ============================================
DROP MATERIALIZED VIEW IF EXISTS leaderboard_scores CASCADE;

-- ============================================
-- 2. CREATE NEW MATERIALIZED VIEW (LOCAL DATE BASED)
-- ============================================
CREATE MATERIALIZED VIEW leaderboard_scores AS
WITH daily_winners AS (
  -- For each group and LOCAL date, find minimum guesses
  -- Users in different timezones but same local date compete together
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
-- 3. RECREATE REFRESH TRIGGERS
-- ============================================

-- The triggers should still exist from realtime_scoring.sql
-- If not, run that file first

-- ============================================
-- 4. GRANT PERMISSIONS
-- ============================================
GRANT SELECT ON leaderboard_scores TO authenticated;
GRANT SELECT ON leaderboard_scores TO anon;

-- ============================================
-- 5. INITIAL REFRESH
-- ============================================
REFRESH MATERIALIZED VIEW leaderboard_scores;

-- ============================================
-- VERIFY
-- ============================================
-- SELECT * FROM leaderboard_scores LIMIT 10;
