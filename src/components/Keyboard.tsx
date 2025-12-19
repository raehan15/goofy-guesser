import type { LetterState } from '../lib/gameLogic';

interface KeyboardProps {
  onChar: (char: string) => void;
  onDelete: () => void;
  onEnter: () => void;
  usedKeys: { [key: string]: LetterState };
}

export function Keyboard({ onChar, onDelete, onEnter, usedKeys }: KeyboardProps) {
  const keys = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL']
  ];

  const getKeyStyle = (key: string) => {
    const state = usedKeys[key];
    let bg = 'var(--color-key-bg)';
    if (state === 'correct') bg = 'var(--color-correct)';
    else if (state === 'present') bg = 'var(--color-present)';
    else if (state === 'absent') bg = 'var(--color-absent)';

    return {
      backgroundColor: bg,
      flex: key === 'ENTER' || key === 'DEL' ? 1.5 : 1,
    };
  };

  return (
    <div style={{ width: '100%', maxWidth: '500px', padding: '0 8px' }}>
      {keys.map((row, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
          {row.map((key) => (
            <button
              key={key}
              className="keyboard-key"
              style={getKeyStyle(key)}
              onClick={() => {
                if (key === 'ENTER') onEnter();
                else if (key === 'DEL') onDelete();
                else onChar(key);
              }}
            >
              {key === 'DEL' ? '⌫' : key}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
