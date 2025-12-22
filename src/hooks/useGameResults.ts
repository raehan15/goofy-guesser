import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { GroupWithMembership } from './useGroups';
import type { LetterState } from '../lib/gameLogic';

interface SubmitResultParams {
  guessCount: number;
  solved: boolean;
}

export function useGameResults() {
  const { user } = useAuth();

  // Calculate day_index: days since user joined the group
  const calculateDayIndex = (joinedAt: string): number => {
    const joinDate = new Date(joinedAt);
    const today = new Date();
    
    // Reset to start of day in local timezone
    joinDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    const diffMs = today.getTime() - joinDate.getTime();
    return Math.floor(diffMs / (24 * 60 * 60 * 1000));
  };

  // Get current local date in YYYY-MM-DD format (ACTUAL local, not UTC!)
  const getLocalDate = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get timezone offset in minutes
  const getTimezoneOffset = (): number => {
    return new Date().getTimezoneOffset();
  };

  // Submit result to all groups the user is in
  const submitResult = useCallback(async (
    groups: GroupWithMembership[],
    params: SubmitResultParams
  ): Promise<{ success: boolean; submitted: number; errors: string[] }> => {
    if (!supabase || !user) {
      return { success: false, submitted: 0, errors: ['Not authenticated'] };
    }
    
    // If user has no groups, submit a personal play
    if (groups.length === 0) {
      const result = await submitPersonalResult(params);
      return { 
        success: result.success, 
        submitted: result.success ? 1 : 0, 
        errors: result.error ? [result.error] : [] 
      };
    }

    const { guessCount, solved } = params;
    const localDate = getLocalDate();
    const timezoneOffset = getTimezoneOffset();
    const errors: string[] = [];
    let submitted = 0;

    for (const group of groups) {
      const dayIndex = calculateDayIndex(group.joined_at);

      // Check if already submitted for this day
      const { data: existing } = await supabase
        .from('daily_results')
        .select('id')
        .eq('user_id', user.id)
        .eq('group_id', group.id)
        .eq('day_index', dayIndex)
        .maybeSingle();

      if (existing) {
        // Already submitted for this day
        continue;
      }

      const insertData = {
        user_id: user.id,
        group_id: group.id,
        day_index: dayIndex,
        guess_count: guessCount,
        solved,
        local_date: localDate,
        timezone_offset: timezoneOffset
      };
      
      console.log('Inserting to daily_results:', insertData);

      const { error } = await supabase
        .from('daily_results')
        .insert(insertData);

      if (error) {
        console.error('Supabase INSERT error:', error);
        errors.push(`Failed for ${group.name}: ${error.message}`);
      } else {
        submitted++;
      }
    }

    return {
      success: errors.length === 0,
      submitted,
      errors
    };
  }, [user]);

  // Check if user has already submitted for today in a specific group
  const hasSubmittedToday = useCallback(async (group: GroupWithMembership): Promise<boolean> => {
    if (!supabase || !user) return false;

    const localDate = getLocalDate(); // Today's date in YYYY-MM-DD format

    const { data } = await supabase
      .from('daily_results')
      .select('id')
      .eq('user_id', user.id)
      .eq('group_id', group.id)
      .eq('local_date', localDate)
      .maybeSingle();

    return !!data;
  }, [user]);

  // Submit a personal result (for users with no groups)
  const submitPersonalResult = useCallback(async (
    params: SubmitResultParams
  ): Promise<{ success: boolean; error?: string }> => {
    if (!supabase || !user) {
      return { success: false, error: 'Not authenticated' };
    }

    const localDate = getLocalDate();
    const timezoneOffset = getTimezoneOffset();

    // Check if already submitted personal play today
    const { data: existing } = await supabase
      .from('daily_results')
      .select('id')
      .eq('user_id', user.id)
      .is('group_id', null)
      .eq('local_date', localDate)
      .maybeSingle();

    if (existing) {
      return { success: true }; // Already submitted
    }

    const insertData = {
      user_id: user.id,
      group_id: null, // Personal play - no group
      day_index: 0, // Not applicable for personal plays
      guess_count: params.guessCount,
      solved: params.solved,
      local_date: localDate,
      timezone_offset: timezoneOffset
    };

    console.log('Inserting personal play:', insertData);

    const { error } = await supabase
      .from('daily_results')
      .insert(insertData);

    if (error) {
      console.error('Personal play INSERT error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  }, [user]);

  // Check if user has played today (personal play, no groups)
  const hasPlayedTodayPersonal = useCallback(async (): Promise<boolean> => {
    if (!supabase || !user) return false;

    const localDate = getLocalDate();

    const { data } = await supabase
      .from('daily_results')
      .select('id')
      .eq('user_id', user.id)
      .is('group_id', null)
      .eq('local_date', localDate)
      .maybeSingle();

    return !!data;
  }, [user]);

  // ============================================
  // DATABASE GAME PROGRESS (for authenticated users)
  // ============================================

  interface DBGameProgress {
    guesses: string[];
    guessStates: LetterState[][];
    turn: number;
    isGameOver: boolean;
    isGameWon: boolean;
    usedKeys: { [key: string]: LetterState };
  }

  // Save game progress to database
  const saveGameProgressDB = useCallback(async (progress: DBGameProgress): Promise<boolean> => {
    if (!supabase || !user) return false;

    const localDate = getLocalDate();

    // Upsert: insert or update if exists
    const { error } = await supabase
      .from('user_game_progress')
      .upsert({
        user_id: user.id,
        local_date: localDate,
        guesses: progress.guesses,
        guess_states: progress.guessStates,
        turn: progress.turn,
        is_game_over: progress.isGameOver,
        is_game_won: progress.isGameWon,
        used_keys: progress.usedKeys,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,local_date'
      });

    if (error) {
      console.error('Failed to save game progress:', error);
      return false;
    }
    return true;
  }, [user]);

  // Load game progress from database
  const loadGameProgressDB = useCallback(async (): Promise<DBGameProgress | null> => {
    if (!supabase || !user) return null;

    const localDate = getLocalDate();

    // First, cleanup old records (runs the DB function)
    await supabase.rpc('cleanup_old_game_progress');

    // Then fetch today's progress
    const { data, error } = await supabase
      .from('user_game_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('local_date', localDate)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      guesses: data.guesses,
      guessStates: data.guess_states,
      turn: data.turn,
      isGameOver: data.is_game_over,
      isGameWon: data.is_game_won,
      usedKeys: data.used_keys
    };
  }, [user]);

  return {
    submitResult,
    submitPersonalResult,
    hasSubmittedToday,
    hasPlayedTodayPersonal,
    saveGameProgressDB,
    loadGameProgressDB,
    calculateDayIndex,
    getLocalDate,
    getTimezoneOffset
  };
}

