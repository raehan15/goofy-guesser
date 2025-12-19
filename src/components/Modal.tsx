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
  isAuthenticated = false
}: ModalProps) {
  if (!isOpen) return null;

  const copyScore = () => {
    const score = isWin ? `${turn}/6` : 'X/6';
    navigator.clipboard.writeText(`Goofy Guesser ${score}`);
    alert('Score copied to clipboard!');
  };

  const copyGrid = () => {
    const score = isWin ? `${turn}/6` : 'X/6';
    let grid = `Goofy Guesser ${score}\n\n`;
    
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

  // Authenticated users with groups - show "Back to Groups" instead of "Play Again"
  const showBackToGroups = isAuthenticated && groupCount > 0;

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

        {showBackToGroups && (
          <p style={{
            fontSize: '0.8rem',
            color: '#9ca3af',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            Come back tomorrow for a new word!
          </p>
        )}
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          <button className="btn-secondary" onClick={copyScore}>
            Copy Score ({isWin ? turn : 'X'}/6)
          </button>
          <button className="btn-secondary" onClick={copyGrid}>
            Copy Grid
          </button>
        </div>

        {showBackToGroups ? (
          <button className="btn-primary" onClick={onBackToGroups}>
            ← Back to Groups
          </button>
        ) : (
          <button className="btn-primary" onClick={onClose}>
            Play Again
          </button>
        )}
      </div>
    </div>
  );
}
