import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { LeaderboardEntry } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { GroupWithMembership } from '../hooks/useGroups';
import './Leaderboard.css';

interface LeaderboardProps {
  group: GroupWithMembership;
  onClose: () => void;
}

// Extended entry with today's guess info
interface LeaderboardEntryWithGuess extends LeaderboardEntry {
  todayGuess?: string; // e.g. "3/6", "Lost", or undefined if not played
}

// Get current local date in YYYY-MM-DD format
const getLocalDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function Leaderboard({ group, onClose }: LeaderboardProps) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntryWithGuess[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjustmentAmount, setAdjustmentAmount] = useState<{ [userId: string]: number }>({});
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    if (!supabase) return;

    setLoading(true);
    
    // Fetch leaderboard scores
    const { data: leaderboardData, error: leaderboardError } = await supabase
      .from('leaderboard_scores')
      .select('*')
      .eq('group_id', group.id)
      .order('total_score', { ascending: false });

    // Fetch today's results for all users in this group
    const todayDate = getLocalDate();
    const { data: todayResults, error: todayError } = await supabase
      .from('daily_results')
      .select('user_id, guess_count, solved')
      .eq('group_id', group.id)
      .eq('local_date', todayDate);

    if (!leaderboardError && leaderboardData) {
      // Create a map of user_id to today's result
      const todayResultsMap: { [userId: string]: { guess_count: number; solved: boolean } } = {};
      if (!todayError && todayResults) {
        todayResults.forEach((result: { user_id: string; guess_count: number; solved: boolean }) => {
          todayResultsMap[result.user_id] = {
            guess_count: result.guess_count,
            solved: result.solved
          };
        });
      }

      // Merge leaderboard data with today's guess info
      const entriesWithGuess: LeaderboardEntryWithGuess[] = leaderboardData.map(entry => {
        const todayResult = todayResultsMap[entry.user_id];
        let todayGuess: string | undefined;
        
        if (todayResult) {
          if (todayResult.solved) {
            todayGuess = `${todayResult.guess_count}/6`;
          } else {
            todayGuess = 'Lost';
          }
        }
        
        return {
          ...entry,
          todayGuess
        };
      });

      setEntries(entriesWithGuess);
    }
    setLoading(false);
  }, [group.id]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const handleAdjustScore = async (targetUserId: string, adjustment: number) => {
    if (!supabase || !user || adjustment === 0) return;

    await supabase.from('score_adjustments').insert({
      user_id: targetUserId,
      group_id: group.id,
      adjustment,
      adjusted_by: user.id,
      reason: adjustment > 0 ? 'Manual increase' : 'Manual decrease'
    });

    setAdjustmentAmount(prev => ({ ...prev, [targetUserId]: 0 }));
    fetchLeaderboard();
  };

  const handleResetScores = async () => {
    if (!supabase || !user) return;

    // Delete all daily results for this group
    await supabase
      .from('daily_results')
      .delete()
      .eq('group_id', group.id);

    // Delete all score adjustments for this group
    await supabase
      .from('score_adjustments')
      .delete()
      .eq('group_id', group.id);

    setShowConfirmReset(false);
    fetchLeaderboard();
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}?join=${group.invite_code}`;
    navigator.clipboard.writeText(link);
    alert('Invite link copied!');
  };

  return (
    <div className="leaderboard-overlay">
      <div className="leaderboard-modal">
        <div className="leaderboard-header">
          <h2>{group.name}</h2>
          <button className="leaderboard-close" onClick={onClose}>×</button>
        </div>

        <div className="leaderboard-actions">
          <button className="lb-btn lb-btn-secondary" onClick={copyInviteLink}>
            📋 Copy Invite Link
          </button>
        </div>

        {loading ? (
          <p className="leaderboard-loading">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="leaderboard-empty">No scores yet. Play today's game!</p>
        ) : (
          <div className="leaderboard-table-wrapper">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>Score</th>
                  <th>Wins</th>
                  {group.is_admin && <th>Adjust</th>}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr
                    key={entry.user_id}
                    className={entry.user_id === user?.id ? 'current-user' : ''}
                  >
                    <td className="rank">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                    </td>
                    <td className="username">
                      {entry.username}
                      {entry.todayGuess && (
                        <span className={`today-guess ${entry.todayGuess === 'Lost' ? 'lost' : 'solved'}`}>
                          {entry.todayGuess}
                        </span>
                      )}
                    </td>
                    <td className="score">{entry.total_score}</td>
                    <td className="wins">{entry.games_won}</td>
                    {group.is_admin && (
                      <td className="adjust-cell">
                        <div className="adjust-controls">
                          <button
                            className="adjust-btn"
                            onClick={() => handleAdjustScore(entry.user_id, -1)}
                          >
                            −
                          </button>
                          <span className="adjust-value">
                            {adjustmentAmount[entry.user_id] || 0}
                          </span>
                          <button
                            className="adjust-btn"
                            onClick={() => handleAdjustScore(entry.user_id, 1)}
                          >
                            +
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {group.is_admin && (
          <div className="admin-controls">
            <h4>Admin Controls</h4>
            {!showConfirmReset ? (
              <button
                className="lb-btn lb-btn-danger"
                onClick={() => setShowConfirmReset(true)}
              >
                🗑️ Reset All Scores
              </button>
            ) : (
              <div className="confirm-reset">
                <p>Are you sure? This cannot be undone.</p>
                <div className="confirm-buttons">
                  <button
                    className="lb-btn lb-btn-danger"
                    onClick={handleResetScores}
                  >
                    Yes, Reset
                  </button>
                  <button
                    className="lb-btn lb-btn-secondary"
                    onClick={() => setShowConfirmReset(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
