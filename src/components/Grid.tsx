import { Row } from './Row';
import type { LetterState } from '../lib/gameLogic';

interface GridProps {
  guesses: string[];
  currentGuess: string;
  guessStates: LetterState[][];
  turn: number;
  shakeRowIndex: number;
  isGameOver?: boolean;
  onShowStats?: () => void;
}

export function Grid({ 
  guesses, 
  currentGuess, 
  guessStates, 
  turn, 
  shakeRowIndex,
  isGameOver,
  onShowStats
}: GridProps) {
  const rows = [];
  for (let i = 0; i < 6; i++) {
    if (i < turn) {
      rows.push(<Row key={i} guess={guesses[i]} states={guessStates[i]} />);
    } else if (i === turn) {
      rows.push(<Row key={i} guess={currentGuess} isShaking={shakeRowIndex === i} />);
    } else {
      rows.push(<Row key={i} guess="" />);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <div style={{ display: 'grid', gridTemplateRows: 'repeat(6, 1fr)', gap: '8px', padding: '10px', width: '100%', maxWidth: '350px' }}>
        {rows}
      </div>
      {isGameOver && onShowStats && (
        <button 
          onClick={onShowStats}
          style={{
            marginTop: '15px',
            padding: '12px 24px',
            borderRadius: '25px',
            background: 'linear-gradient(135deg, #ffc425, #ffa500)',
            color: '#121213',
            fontWeight: 'bold',
            fontSize: '0.95rem',
            boxShadow: '0 4px 15px rgba(255, 196, 37, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            border: 'none',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            transition: 'all 0.2s ease',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.filter = 'brightness(1.1)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 196, 37, 0.5)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.filter = 'brightness(1)';
            e.currentTarget.style.boxShadow = '0 4px 15px rgba(255, 196, 37, 0.4)';
          }}
        >
          📊 View Stats & Share
        </button>
      )}
    </div>
  );
}
