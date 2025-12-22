-- ============================================
-- USER GAME PROGRESS TABLE
-- ============================================
-- Stores in-progress and completed games for authenticated users.
-- Auto-deletes records older than 2 days to stay within free tier limits.

-- ============================================
-- 1. CREATE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_game_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  local_date DATE NOT NULL,
  guesses TEXT[] NOT NULL DEFAULT '{}',
  guess_states JSONB NOT NULL DEFAULT '[]',
  turn INTEGER NOT NULL DEFAULT 0,
  is_game_over BOOLEAN NOT NULL DEFAULT FALSE,
  is_game_won BOOLEAN NOT NULL DEFAULT FALSE,
  used_keys JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, local_date)
);

-- ============================================
-- 2. CREATE INDEX FOR FAST LOOKUPS
-- ============================================
CREATE INDEX IF NOT EXISTS idx_user_game_progress_user_date 
ON user_game_progress(user_id, local_date);

CREATE INDEX IF NOT EXISTS idx_user_game_progress_date 
ON user_game_progress(local_date);

-- ============================================
-- 3. ENABLE RLS
-- ============================================
ALTER TABLE user_game_progress ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. RLS POLICIES
-- ============================================
-- Users can only see their own progress
DROP POLICY IF EXISTS "Users can view own progress" ON user_game_progress;
CREATE POLICY "Users can view own progress"
  ON user_game_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own progress
DROP POLICY IF EXISTS "Users can insert own progress" ON user_game_progress;
CREATE POLICY "Users can insert own progress"
  ON user_game_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own progress
DROP POLICY IF EXISTS "Users can update own progress" ON user_game_progress;
CREATE POLICY "Users can update own progress"
  ON user_game_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own progress
DROP POLICY IF EXISTS "Users can delete own progress" ON user_game_progress;
CREATE POLICY "Users can delete own progress"
  ON user_game_progress FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- 5. CLEANUP FUNCTION (called from frontend)
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_old_game_progress()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_game_progress 
  WHERE local_date < CURRENT_DATE - INTERVAL '2 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION cleanup_old_game_progress() TO authenticated;

-- ============================================
-- 6. GRANT TABLE PERMISSIONS
-- ============================================
GRANT ALL ON user_game_progress TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_game_progress TO authenticated;

-- ============================================
-- VERIFY
-- ============================================
-- SELECT * FROM user_game_progress LIMIT 5;
-- SELECT cleanup_old_game_progress();
