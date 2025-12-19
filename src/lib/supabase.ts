import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Backend features will be disabled.');
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Type definitions for database tables
export interface Profile {
  id: string;
  username: string;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  invite_code: string;
  creator_id: string;
  created_at: string;
}

export interface GroupMember {
  id: string;
  user_id: string;
  group_id: string;
  joined_at: string;
  is_admin: boolean;
}

export interface DailyResult {
  id: string;
  user_id: string;
  group_id: string;
  day_index: number;
  guess_count: number;
  solved: boolean;
  submitted_at: string;
  local_date: string;
  timezone_offset: number;
}

export interface ScoreAdjustment {
  id: string;
  user_id: string;
  group_id: string;
  adjustment: number;
  reason: string | null;
  adjusted_by: string;
  created_at: string;
}

export interface LeaderboardEntry {
  group_id: string;
  user_id: string;
  username: string;
  total_score: number;
  games_won: number;
}
