import { useState, useEffect } from 'react';
import { useGroups } from '../hooks/useGroups';
import type { GroupWithMembership } from '../hooks/useGroups';
import { Leaderboard } from './Leaderboard';
import './GroupsPanel.css';

interface GroupsPanelProps {
  onPlayGame: () => void;
  // null = still checking, true = played, false = not played
  hasPlayedToday?: boolean | null;
  pendingJoinCode?: string | null;
  onJoinComplete?: () => void;
}

export function GroupsPanel({ 
  onPlayGame, 
  hasPlayedToday = null,
  pendingJoinCode,
  onJoinComplete
}: GroupsPanelProps) {
  const { 
    groups, 
    loading, 
    error, 
    createGroup, 
    joinGroup, 
    leaveGroup,
    getInviteLink,
    clearError 
  } = useGroups();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupWithMembership | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Handle pending join code from URL (passed from App.tsx)
  useEffect(() => {
    if (pendingJoinCode) {
      setInviteCode(pendingJoinCode);
      setShowJoinModal(true);
      onJoinComplete?.();
    }
  }, [pendingJoinCode, onJoinComplete]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setActionLoading(true);
    clearError();
    
    const group = await createGroup(newGroupName.trim());
    if (group) {
      setShowCreateModal(false);
      setNewGroupName('');
    }
    setActionLoading(false);
  };

  const handleJoinGroup = async () => {
    if (!inviteCode.trim()) return;
    setActionLoading(true);
    clearError();
    
    const success = await joinGroup(inviteCode.trim());
    if (success) {
      setShowJoinModal(false);
      setInviteCode('');
    }
    setActionLoading(false);
  };

  const handleLeaveGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to leave this group?')) return;
    await leaveGroup(groupId);
  };

  const copyInviteLink = (inviteCode: string) => {
    navigator.clipboard.writeText(getInviteLink(inviteCode));
    alert('Invite link copied to clipboard!');
  };

  return (
    <div className="groups-panel">
      <div className="groups-header">
        <h2>My Groups</h2>
        {loading || hasPlayedToday === null ? (
          <div className="played-today-badge" style={{ opacity: 0.6 }}>
            Checking...
          </div>
        ) : hasPlayedToday === true ? (
          <div className="played-today-badge">
            ✓ Played Today
          </div>
        ) : (
          <button className="gp-btn gp-btn-play" onClick={onPlayGame}>
            ▶ Play Today's Game
          </button>
        )}
      </div>

      <div className="groups-actions">
        <button 
          className="gp-btn gp-btn-primary" 
          onClick={() => setShowCreateModal(true)}
        >
          + Create Group
        </button>
        <button 
          className="gp-btn gp-btn-secondary"
          onClick={() => setShowJoinModal(true)}
        >
          🔗 Join Group
        </button>
      </div>

      {error && (
        <div className="groups-error">
          {error}
          <button onClick={clearError}>×</button>
        </div>
      )}

      {loading ? (
        <p className="groups-loading">Loading groups...</p>
      ) : groups.length === 0 ? (
        <div className="groups-empty">
          <p>You're not in any groups yet.</p>
          <p>Create a group or join one with an invite link!</p>
        </div>
      ) : (
        <div className="groups-list">
          {groups.map(group => (
            <div key={group.id} className="group-card">
              <div className="group-info">
                <h3>{group.name}</h3>
                <span className="group-badge">
                  {group.is_admin ? '👑 Admin' : '👤 Member'}
                </span>
              </div>
              <div className="group-actions">
                <button
                  className="gp-btn gp-btn-small"
                  onClick={() => setSelectedGroup(group)}
                >
                  📊 Leaderboard
                </button>
                <button
                  className="gp-btn gp-btn-small gp-btn-secondary"
                  onClick={() => copyInviteLink(group.invite_code)}
                >
                  📋 Invite
                </button>
                {!group.is_admin && (
                  <button
                    className="gp-btn gp-btn-small gp-btn-danger"
                    onClick={() => handleLeaveGroup(group.id)}
                  >
                    Leave
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="gp-modal-overlay">
          <div className="gp-modal">
            <h3>Create New Group</h3>
            <input
              type="text"
              placeholder="Group name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="gp-input"
              maxLength={50}
            />
            <div className="gp-modal-actions">
              <button
                className="gp-btn gp-btn-primary"
                onClick={handleCreateGroup}
                disabled={actionLoading || !newGroupName.trim()}
              >
                {actionLoading ? 'Creating...' : 'Create'}
              </button>
              <button
                className="gp-btn gp-btn-secondary"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewGroupName('');
                  clearError();
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Group Modal */}
      {showJoinModal && (
        <div className="gp-modal-overlay">
          <div className="gp-modal">
            <h3>Join a Group</h3>
            <input
              type="text"
              placeholder="Enter invite code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="gp-input"
            />
            <p className="gp-hint">
              Paste the invite code or link from your friend
            </p>
            <div className="gp-modal-actions">
              <button
                className="gp-btn gp-btn-primary"
                onClick={handleJoinGroup}
                disabled={actionLoading || !inviteCode.trim()}
              >
                {actionLoading ? 'Joining...' : 'Join'}
              </button>
              <button
                className="gp-btn gp-btn-secondary"
                onClick={() => {
                  setShowJoinModal(false);
                  setInviteCode('');
                  clearError();
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Modal */}
      {selectedGroup && (
        <Leaderboard
          group={selectedGroup}
          onClose={() => setSelectedGroup(null)}
        />
      )}
    </div>
  );
}
