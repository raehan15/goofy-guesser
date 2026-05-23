interface ModalProps {
  isOpen: boolean;
  isWin: boolean;
  solution: string;
  turn: number;
  guessStates: any[][];
  onClose: () => void;
  onBackToGroups?: () => void;
  groupCount?: number;
  isAuthenticated?: boolean;
  onBackToGrid?: () => void;
}

export function Modal({ 
  isOpen, 
  isWin, 
  solution, 
  turn, 
  guessStates, 
  onClose, 
  onBackToGroups,
  groupCount = 0,
  isAuthenticated = false,
  onBackToGrid
}: ModalProps) {
  if (!isOpen) return null;

  // Get formatted local date (e.g., "30th Dec")
  const getFormattedDate = () => {
    const now = new Date();
    const day = now.getDate();
    const month = now.toLocaleString('default', { month: 'short' });
    
    // Add ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
    const suffix = 
      day === 1 || day === 21 || day === 31 ? 'st' :
      day === 2 || day === 22 ? 'nd' :
      day === 3 || day === 23 ? 'rd' : 'th';
    
    return `${day}${suffix} ${month}`;
  };

  const copyScore = () => {
    const score = isWin ? `${turn}/6` : 'X/6';
    const dateStr = getFormattedDate();
    navigator.clipboard.writeText(`Goofy Guesser ${score} - ${dateStr}`);
    alert('Score copied to clipboard!');
  };

  const copyGrid = () => {
    const score = isWin ? `${turn}/6` : 'X/6';
    const dateStr = getFormattedDate();
    let grid = `Goofy Guesser ${score} - ${dateStr}\n\n`;
    
    const limit = isWin ? turn : turn + 1;
    for (let i = 0; i < limit; i++) {
      const row = guessStates[i];
      if (!row || row[0] === 'initial') continue;

      grid += row.map((state: string) => {
        if (state === 'correct') return '🟩';
        if (state === 'present') return '🟨';
        return '⬛';
      }).join('') + '\n';
    }

    navigator.clipboard.writeText(grid);
    alert('Grid copied to clipboard!');
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="modal-title">{isWin ? 'You Won!' : 'Game Over'}</h2>
        
        <div className="modal-solution">
          {solution}
        </div>

        <p className="modal-stat">
          {isWin ? `Guessed in ${turn} ${turn === 1 ? 'try' : 'tries'}` : 'Better luck next time!'}
        </p>

        {groupCount > 0 && (
          <p className="modal-submitted" style={{
            fontSize: '0.875rem',
            color: '#6ee7b7',
            background: 'rgba(110, 231, 183, 0.1)',
            padding: '8px 12px',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            ✓ Result submitted to {groupCount} group{groupCount > 1 ? 's' : ''}
          </p>
        )}

        {/* Always show "come back tomorrow" message */}
        <p style={{
          fontSize: '0.8rem',
          color: '#9ca3af',
          marginBottom: '16px',
          textAlign: 'center'
        }}>
          Come back tomorrow for a new word!
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          <button className="btn-secondary" onClick={copyScore}>
            Copy Score ({isWin ? turn : 'X'}/6)
          </button>
          <button className="btn-secondary" onClick={copyGrid}>
            Copy Grid
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {onBackToGrid && (
            <button 
              className="btn-primary" 
              onClick={onBackToGrid}
              style={{
                background: 'linear-gradient(135deg, #00b8a3, #00d1b8)',
                color: '#ffffff',
                boxShadow: '0 4px 15px rgba(0, 184, 163, 0.3)'
              }}
            >
              Back to Grid
            </button>
          )}
          {isAuthenticated ? (
            <button className="btn-primary" onClick={onBackToGroups}>
              ← Back to Groups
            </button>
          ) : (
            <button className="btn-primary" onClick={onClose}>
              ← Back to Home
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
