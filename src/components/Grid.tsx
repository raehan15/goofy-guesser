import { Row } from './Row';
import type { LetterState } from '../lib/gameLogic';

interface GridProps {
  guesses: string[];
  currentGuess: string;
  guessStates: LetterState[][];
  turn: number;
  shakeRowIndex: number;
}

export function Grid({ guesses, currentGuess, guessStates, turn, shakeRowIndex }: GridProps) {
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
    <div style={{ display: 'grid', gridTemplateRows: 'repeat(6, 1fr)', gap: '8px', padding: '10px' }}>
      {rows}
    </div>
  );
}
