import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { GroupWithMembership } from './useGroups';

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

  // Get current local date in YYYY-MM-DD format
  const getLocalDate = (): string => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  };

  // Get timezone offset in minutes
  const getTimezoneOffset = (): number => {
    return new Date().getTimezoneOffset();
  };

  // Get current UTC date in YYYY-MM-DD format
  // This is the date used for scoring (UTC-based, not local)
  const getUtcDate = (): string => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  };

  // Submit result to all groups the user is in
  const submitResult = useCallback(async (
    groups: GroupWithMembership[],
    params: SubmitResultParams
  ): Promise<{ success: boolean; submitted: number; errors: string[] }> => {
    if (!supabase || !user || groups.length === 0) {
      return { success: false, submitted: 0, errors: ['Not authenticated or no groups'] };
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
        .single();

      if (existing) {
        // Already submitted for this day
        continue;
      }

      const { error } = await supabase
        .from('daily_results')
        .insert({
          user_id: user.id,
          group_id: group.id,
          day_index: dayIndex,
          guess_count: guessCount,
          solved,
          local_date: localDate,
          timezone_offset: timezoneOffset,
          utc_date: getUtcDate()
        });

      if (error) {
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
      .single();

    return !!data;
  }, [user]);

  return {
    submitResult,
    hasSubmittedToday,
    calculateDayIndex,
    getLocalDate,
    getTimezoneOffset
  };
}
