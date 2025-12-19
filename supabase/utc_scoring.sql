-- ============================================
-- UTC-12 SCORE FINALIZATION UPDATE
-- ============================================
-- Run this AFTER fix_permissions.sql
-- This updates the leaderboard to only count finalized days
-- A day is "finalized" when UTC-12 timezone hits midnight
-- (which is 12:00 PM / noon UTC the NEXT day)

-- ============================================
-- 1. ADD UTC_DATE COLUMN TO DAILY_RESULTS
-- ============================================

-- Add utc_date column if it doesn't exist
ALTER TABLE daily_results 
ADD COLUMN IF NOT EXISTS utc_date DATE;

-- Backfill existing records with submitted_at date
UPDATE daily_results 
SET utc_date = (submitted_at AT TIME ZONE 'UTC')::DATE 
WHERE utc_date IS NULL;

-- Make utc_date NOT NULL for future inserts
-- (Skip this if you want to allow NULL temporarily)
-- ALTER TABLE daily_results ALTER COLUMN utc_date SET NOT NULL;

-- ============================================
-- 2. UPDATE LEADERBOARD VIEW
-- ============================================

-- Drop existing view
DROP VIEW IF EXISTS leaderboard_scores;

-- Recreate with UTC-12 finalization logic
-- A day is finalized when current UTC time >= that date + 36 hours
-- (12 hours for UTC-12 offset + 24 hours for the full day)
-- Simpler: finalized when NOW() >= (utc_date + 1 day + 12 hours)

CREATE OR REPLACE VIEW leaderboard_scores AS
WITH finalized_days AS (
  -- Only include results where the UTC-12 day has ended
  -- UTC-12 midnight = UTC noon next day
  -- So a result for utc_date X is finalized when NOW() >= X + 1 day + 12 hours
  SELECT *
  FROM daily_results
  WHERE NOW() >= (utc_date + INTERVAL '1 day' + INTERVAL '12 hours')
),
daily_winners AS (
  SELECT 
    group_id,
    utc_date,
    MIN(guess_count) AS min_guesses
  FROM finalized_days
  WHERE solved = true
  GROUP BY group_id, utc_date
),
point_earners AS (
  SELECT 
    dr.user_id,
    dr.group_id,
    dr.utc_date,
    1 AS points
  FROM finalized_days dr
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
LEFT JOIN adjustment_totals at ON at.group_id = am.group_id AND at.user_id = am.user_id
ORDER BY total_score DESC;

-- ============================================
-- 3. CREATE PENDING RESULTS VIEW
-- ============================================

-- View for today's results that are NOT yet finalized
-- Useful for showing "pending" status in UI
CREATE OR REPLACE VIEW pending_daily_results AS
SELECT 
  dr.*,
  p.username,
  g.name AS group_name
FROM daily_results dr
JOIN profiles p ON p.id = dr.user_id
JOIN groups g ON g.id = dr.group_id
WHERE NOW() < (dr.utc_date + INTERVAL '1 day' + INTERVAL '12 hours');

-- ============================================
-- 4. HELPER FUNCTION FOR FRONTEND
-- ============================================

-- Function to check if a UTC date is finalized
CREATE OR REPLACE FUNCTION is_day_finalized(check_date DATE)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT NOW() >= (check_date + INTERVAL '1 day' + INTERVAL '12 hours');
$$;

-- ============================================
-- USAGE NOTES
-- ============================================
-- 
-- Frontend should now:
-- 1. Always send utc_date when submitting results
--    (UTC date of the word being solved)
-- 2. Leaderboard automatically only shows finalized scores
-- 3. Use pending_daily_results to show "waiting for finalization"
--
-- Example: If today is Dec 18:
-- - Dec 17's results are finalized (it's past Dec 18 12:00 UTC)
-- - Dec 18's results are pending until Dec 19 12:00 UTC
