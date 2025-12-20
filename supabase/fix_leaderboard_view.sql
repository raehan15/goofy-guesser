-- ============================================
-- FIX: LEADERBOARD GHOST MEMBERS
-- Run this script in Supabase SQL Editor to update the view
-- ============================================

DROP MATERIALIZED VIEW IF EXISTS leaderboard_scores;
DROP MATERIALIZED VIEW IF EXISTS leaderboard_scores;
DROP VIEW IF EXISTS leaderboard_scores;

CREATE OR REPLACE VIEW leaderboard_scores AS
WITH daily_winners AS (
  -- 1. Identify the best score (min guesses) for each day in each group
  SELECT 
    group_id,
    day_index,
    MIN(guess_count) AS min_guesses
  FROM daily_results
  WHERE solved = true
  GROUP BY group_id, day_index
),
point_earners AS (
  -- 2. Find users who achieved that best score
  SELECT 
    dr.user_id,
    dr.group_id,
    1 AS points
  FROM daily_results dr
  JOIN daily_winners dw 
    ON dr.group_id = dw.group_id 
    AND dr.day_index = dw.day_index
    AND dr.guess_count = dw.min_guesses
  WHERE dr.solved = true
),
earned_scores AS (
  -- 3. Sum up points from wins
  SELECT 
    group_id,
    user_id,
    SUM(points) AS earned_points
  FROM point_earners
  GROUP BY group_id, user_id
),
adjustment_totals AS (
  -- 4. Sum up manual Admin adjustments
  SELECT 
    group_id,
    user_id,
    SUM(adjustment) AS adjustment_points
  FROM score_adjustments
  GROUP BY group_id, user_id
),
current_members AS (
  -- 5. TRUTH SOURCE: Only include users currently in the group
  SELECT group_id, user_id FROM group_members
)
SELECT 
  cm.group_id,
  cm.user_id,
  p.username,
  -- Total score = Game points + Adjustments
  COALESCE(es.earned_points, 0) + COALESCE(at.adjustment_points, 0) AS total_score,
  COALESCE(es.earned_points, 0) AS games_won
FROM current_members cm
JOIN profiles p ON p.id = cm.user_id
-- We LEFT JOIN scores to the members list. 
-- If a member has no scores, they appear with 0.
-- If a score exists for a non-member, it is EXCLUDED because we start FROM current_members.
LEFT JOIN earned_scores es ON es.group_id = cm.group_id AND es.user_id = cm.user_id
LEFT JOIN adjustment_totals at ON at.group_id = cm.group_id AND at.user_id = cm.user_id
ORDER BY total_score DESC;
