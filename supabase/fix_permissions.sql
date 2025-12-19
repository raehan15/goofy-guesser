-- ============================================
-- FIX: Supabase Permissions and Triggers
-- ============================================
-- Run this AFTER the main schema.sql if you're getting errors
-- Dashboard > SQL Editor > New Query > Paste & Run

-- ============================================
-- 1. FIX PROFILE CREATION TRIGGER
-- ============================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id, 
    COALESCE(
      NEW.raw_user_meta_data->>'username', 
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. FIX GROUP CREATION TRIGGER
-- ============================================

DROP TRIGGER IF EXISTS on_group_created ON groups;
DROP FUNCTION IF EXISTS public.handle_new_group();

CREATE OR REPLACE FUNCTION public.handle_new_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.group_members (user_id, group_id, is_admin)
  VALUES (NEW.creator_id, NEW.id, true);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_group_created
  AFTER INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_group();

-- ============================================
-- 3. GRANT PROPER PERMISSIONS
-- ============================================

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- Profiles table permissions
GRANT ALL ON public.profiles TO postgres, service_role;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- Groups table permissions
GRANT ALL ON public.groups TO postgres, service_role;
GRANT SELECT ON public.groups TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.groups TO authenticated;

-- Group members table permissions
GRANT ALL ON public.group_members TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;

-- Daily results table permissions
GRANT ALL ON public.daily_results TO postgres, service_role;
GRANT SELECT, INSERT ON public.daily_results TO authenticated;

-- Score adjustments table permissions
GRANT ALL ON public.score_adjustments TO postgres, service_role;
GRANT SELECT, INSERT ON public.score_adjustments TO authenticated;

-- ============================================
-- 4. FIX RLS POLICIES FOR GROUPS
-- ============================================

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Users can view groups they belong to" ON groups;
DROP POLICY IF EXISTS "Anyone can view group by invite code" ON groups;
DROP POLICY IF EXISTS "Authenticated users can create groups" ON groups;

-- Recreate with proper permissions
CREATE POLICY "Authenticated users can view groups by invite code"
  ON groups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anon users can view groups by invite code"
  ON groups FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated users can create groups"
  ON groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

-- ============================================
-- 5. FIX RLS POLICIES FOR GROUP MEMBERS
-- ============================================

DROP POLICY IF EXISTS "Users can view members of their groups" ON group_members;
DROP POLICY IF EXISTS "Users can join groups (insert own membership)" ON group_members;

-- Allow viewing group members
CREATE POLICY "Authenticated users can view group members"
  ON group_members FOR SELECT
  TO authenticated
  USING (true);

-- Allow joining groups
CREATE POLICY "Authenticated users can join groups"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 6. FIX RLS POLICIES FOR DAILY RESULTS
-- ============================================

DROP POLICY IF EXISTS "Users can view results in their groups" ON daily_results;
DROP POLICY IF EXISTS "Users can insert their own results" ON daily_results;

CREATE POLICY "Authenticated users can view results"
  ON daily_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = daily_results.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can insert own results"
  ON daily_results FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 7. VERIFY SETUP
-- ============================================

-- This should return your tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'groups', 'group_members', 'daily_results', 'score_adjustments');
