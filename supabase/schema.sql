-- ============================================
-- GOOFY GUESSER - SUPABASE DATABASE SCHEMA
-- ============================================
-- Run this entire script in your Supabase SQL Editor
-- Dashboard > SQL Editor > New Query > Paste & Run

-- ============================================
-- 1. TABLES
-- ============================================

-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Groups table
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group members (join table)
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  is_admin BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, group_id)
);

-- Daily results (minimal storage as specified)
CREATE TABLE daily_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  day_index INTEGER NOT NULL, -- Days since user joined group
  guess_count INTEGER NOT NULL CHECK (guess_count >= 1 AND guess_count <= 6),
  solved BOOLEAN NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  local_date DATE NOT NULL, -- User's local date
  timezone_offset INTEGER NOT NULL, -- Offset in minutes from UTC
  UNIQUE(user_id, group_id, day_index)
);

-- ============================================
-- 2. INDEXES
-- ============================================

CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_daily_results_group_day ON daily_results(group_id, day_index);
CREATE INDEX idx_groups_invite_code ON groups(invite_code);

-- ============================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_results ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
CREATE POLICY "Users can view any profile"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- GROUPS policies
CREATE POLICY "Users can view groups they belong to"
  ON groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
    )
    OR creator_id = auth.uid()
  );

CREATE POLICY "Authenticated users can create groups"
  ON groups FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Group creators can update their groups"
  ON groups FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "Group creators can delete their groups"
  ON groups FOR DELETE
  USING (auth.uid() = creator_id);

-- Allow viewing group by invite code (for joining)
CREATE POLICY "Anyone can view group by invite code"
  ON groups FOR SELECT
  USING (true);

-- GROUP_MEMBERS policies
CREATE POLICY "Users can view members of their groups"
  ON group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members AS gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join groups (insert own membership)"
  ON group_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave groups (delete own membership)"
  ON group_members FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can update memberships in their groups"
  ON group_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM group_members AS gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.is_admin = true
    )
  );

-- DAILY_RESULTS policies
CREATE POLICY "Users can view results in their groups"
  ON daily_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = daily_results.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own results"
  ON daily_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can delete results in their groups (for reset)"
  ON daily_results FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = daily_results.group_id
      AND group_members.user_id = auth.uid()
      AND group_members.is_admin = true
    )
  );

-- ============================================
-- 4. LEADERBOARD VIEW
-- ============================================

-- Calculate scores: For each day, fewer guesses = +1 point
-- Ties: all tied players get +1
CREATE OR REPLACE VIEW leaderboard_scores AS
WITH daily_winners AS (
  -- For each group and day, find the minimum guess count among solved puzzles
  SELECT 
    group_id,
    day_index,
    MIN(guess_count) AS min_guesses
  FROM daily_results
  WHERE solved = true
  GROUP BY group_id, day_index
),
point_earners AS (
  -- Users who matched the minimum guess count for that day (winners)
  SELECT 
    dr.user_id,
    dr.group_id,
    dr.day_index,
    1 AS points
  FROM daily_results dr
  JOIN daily_winners dw 
    ON dr.group_id = dw.group_id 
    AND dr.day_index = dw.day_index
    AND dr.guess_count = dw.min_guesses
  WHERE dr.solved = true
)
SELECT 
  pe.group_id,
  pe.user_id,
  p.username,
  SUM(pe.points) AS total_score,
  COUNT(pe.day_index) AS days_won
FROM point_earners pe
JOIN profiles p ON p.id = pe.user_id
GROUP BY pe.group_id, pe.user_id, p.username
ORDER BY total_score DESC;

-- ============================================
-- 5. HELPER FUNCTIONS
-- ============================================

-- Function to create a profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to make group creator an admin
CREATE OR REPLACE FUNCTION handle_new_group()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO group_members (user_id, group_id, is_admin)
  VALUES (NEW.creator_id, NEW.id, true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-add creator as admin
CREATE OR REPLACE TRIGGER on_group_created
  AFTER INSERT ON groups
  FOR EACH ROW EXECUTE FUNCTION handle_new_group();

-- ============================================
-- 6. MANUAL SCORE ADJUSTMENT TABLE
-- ============================================

-- For manual score adjustments by admins
CREATE TABLE score_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  adjustment INTEGER NOT NULL, -- Positive or negative
  reason TEXT,
  adjusted_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE score_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view adjustments in their groups"
  ON score_adjustments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = score_adjustments.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert adjustments"
  ON score_adjustments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = score_adjustments.group_id
      AND group_members.user_id = auth.uid()
      AND group_members.is_admin = true
    )
  );

-- ============================================
-- 7. UPDATED LEADERBOARD WITH ADJUSTMENTS
-- ============================================

-- Drop old view and recreate with adjustments
DROP VIEW IF EXISTS leaderboard_scores;

CREATE OR REPLACE VIEW leaderboard_scores AS
WITH daily_winners AS (
  SELECT 
    group_id,
    day_index,
    MIN(guess_count) AS min_guesses
  FROM daily_results
  WHERE solved = true
  GROUP BY group_id, day_index
),
point_earners AS (
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
