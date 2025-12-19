import type { LetterState } from '../lib/gameLogic';

interface TileProps {
  letter: string;
  state: LetterState;
  index?: number;
}

export function Tile({ letter, state, index = 0 }: TileProps) {
  const getFinalColor = () => {
    switch (state) {
      case 'correct': return 'var(--color-correct)';
      case 'present': return 'var(--color-present)';
      case 'absent': return 'var(--color-absent)';
      default: return 'transparent';
    }
  };

  const getBorderColor = () => {
    if (state !== 'initial') return getFinalColor();
    return letter ? 'var(--color-tile-active)' : 'var(--color-tile-border)';
  };

  const isRevealed = state !== 'initial';
  const animationDelay = `${index * 300}ms`; // Staggered delay

  const style = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    border: '2px solid',
    // If revealed, we want the animation to handle the color. 
    // We set the static style to match the 0% keyframe (transparent bg, border color)
    // so it looks correct during the animation delay.
    borderColor: isRevealed ? 'var(--color-tile-border)' : getBorderColor(),
    backgroundColor: isRevealed ? 'transparent' : 'transparent',
    fontSize: '2rem',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    userSelect: 'none' as const,
    // We use CSS variables to pass the color to the keyframe
    '--final-color': getFinalColor(),
    animation: isRevealed 
      ? `flip 0.6s ease forwards ${animationDelay}` // forwards is fine if we match 0% style
      : (letter ? 'pop 0.1s' : 'none'),
  } as React.CSSProperties;

  return <div style={style}>{letter}</div>;
}
