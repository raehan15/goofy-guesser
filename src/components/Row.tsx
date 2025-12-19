import { Tile } from './Tile';
import type { LetterState } from '../lib/gameLogic';

interface RowProps {
  guess: string;
  states?: LetterState[];
  isShaking?: boolean;
}

export function Row({ guess, states, isShaking }: RowProps) {
  const tiles = [];
  for (let i = 0; i < 5; i++) {
    tiles.push(
      <div key={i} style={{ width: '52px', height: '52px', margin: '3px' }}>
        <Tile 
          letter={guess[i] || ''} 
          state={states ? states[i] : 'initial'} 
          index={i}
        />
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center',
      animation: isShaking ? 'shake 0.6s' : 'none'
    }}>
      {tiles}
    </div>
  );
}
