import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Group } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface GroupWithMembership extends Group {
  is_admin: boolean;
  joined_at: string;
  member_count?: number;
}

export function useGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<GroupWithMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    if (!supabase || !user) {
      setGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get all groups user is a member of
      const { data: memberships, error: memberError } = await supabase
        .from('group_members')
        .select(`
          group_id,
          is_admin,
          joined_at,
          groups (
            id,
            name,
            invite_code,
            creator_id,
            created_at
          )
        `)
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      const groupsWithMembership: GroupWithMembership[] = (memberships || []).map((m: any) => ({
        ...m.groups,
        is_admin: m.is_admin,
        joined_at: m.joined_at
      }));

      setGroups(groupsWithMembership);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch groups');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const createGroup = async (name: string): Promise<Group | null> => {
    if (!supabase || !user) return null;

    try {
      const { data, error } = await supabase
        .from('groups')
        .insert({ name, creator_id: user.id })
        .select()
        .single();

      if (error) throw error;
      
      // Refresh groups list
      await fetchGroups();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
      return null;
    }
  };

  const joinGroup = async (inviteCode: string): Promise<boolean> => {
    if (!supabase || !user) return false;

    try {
      // Find group by invite code
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('id')
        .eq('invite_code', inviteCode.toLowerCase().trim())
        .single();

      if (groupError || !group) {
        setError('Group not found. Check the invite code.');
        return false;
      }

      // Check if already a member
      const { data: existing } = await supabase
        .from('group_members')
        .select('id')
        .eq('user_id', user.id)
        .eq('group_id', group.id)
        .single();

      if (existing) {
        setError('You are already a member of this group.');
        return false;
      }

      // Join the group
      const { error: joinError } = await supabase
        .from('group_members')
        .insert({ user_id: user.id, group_id: group.id });

      if (joinError) throw joinError;

      await fetchGroups();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join group');
      return false;
    }
  };

  const leaveGroup = async (groupId: string): Promise<boolean> => {
    if (!supabase || !user) return false;

    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('user_id', user.id)
        .eq('group_id', groupId);

      if (error) throw error;

      await fetchGroups();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave group');
      return false;
    }
  };

  const getInviteLink = (inviteCode: string): string => {
    return `${window.location.origin}?join=${inviteCode}`;
  };

  return {
    groups,
    loading,
    error,
    createGroup,
    joinGroup,
    leaveGroup,
    getInviteLink,
    refreshGroups: fetchGroups,
    clearError: () => setError(null)
  };
}
