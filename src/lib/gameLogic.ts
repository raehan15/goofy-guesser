import { WORDS, VALID_GUESSES } from './words';

export type LetterState = 'correct' | 'present' | 'absent' | 'initial';

export const isValidGuess = (guess: string): boolean => {
  return VALID_GUESSES.includes(guess);
};

// Simple hash function for consistent word selection based on date string
const hashDateString = (dateStr: string): number => {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    const char = dateStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};

// Get the local date string in YYYY-MM-DD format
export const getLocalDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Word of the day based on LOCAL date string
// This ensures all users on the same local date see the same word
// and word changes at LOCAL midnight for everyone
export const getWordOfDay = (): string => {
  const localDate = getLocalDateString();
  const hash = hashDateString(localDate);
  const index = hash % WORDS.length;
  return WORDS[index];
};

export const checkGuess = (guess: string, solution: string): LetterState[] => {
  const result: LetterState[] = Array(5).fill('absent');
  const solutionChars = solution.split('');
  const guessChars = guess.split('');

  // First pass: Check for correct letters
  guessChars.forEach((char, i) => {
    if (char === solutionChars[i]) {
      result[i] = 'correct';
      solutionChars[i] = ''; // Mark as used
    }
  });

  // Second pass: Check for present letters
  guessChars.forEach((char, i) => {
    if (result[i] !== 'correct') {
      const index = solutionChars.indexOf(char);
      if (index !== -1) {
        result[i] = 'present';
        solutionChars[index] = ''; // Mark as used
      }
    }
  });

  return result;
};

// ============================================
// GAME PROGRESS PERSISTENCE (LocalStorage)
// ============================================
// Saves in-progress and completed games for all users

const PROGRESS_STORAGE_KEY = 'goofy_guesser_progress';

export interface GameProgress {
  date: string;
  guesses: string[];
  guessStates: LetterState[][];
  turn: number;
  isGameOver: boolean;
  isGameWon: boolean;
  usedKeys: { [key: string]: LetterState };
}

export const saveGameProgress = (progress: Omit<GameProgress, 'date'>): void => {
  try {
    const data: GameProgress = {
      date: getLocalDateString(),
      ...progress
    };
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save game progress:', e);
  }
};

export const loadGameProgress = (): GameProgress | null => {
  try {
    const stored = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!stored) return null;
    
    const data: GameProgress = JSON.parse(stored);
    
    // Only return if it's from today
    if (data.date !== getLocalDateString()) {
      clearGameProgress();
      return null;
    }
    
    return data;
  } catch {
    return null;
  }
};

export const clearGameProgress = (): void => {
  try {
    localStorage.removeItem(PROGRESS_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear game progress:', e);
  }
};

// Check if there's a completed game for today
export const hasCompletedGameToday = (): boolean => {
  const progress = loadGameProgress();
  return progress !== null && progress.isGameOver === true;
};

// Legacy guest helpers (now use the unified progress system)
export const saveGuestPlayStatus = (status: { guessCount?: number; solved?: boolean }): void => {
  // Guest play status is now stored as part of game progress
  // This function is called at game end, progress should already be saved
  // Just ensure the game is marked as over
  const existing = loadGameProgress();
  if (existing) {
    saveGameProgress({
      ...existing,
      isGameOver: true,
      isGameWon: status.solved ?? false
    });
  }
};

export const hasGuestPlayedToday = (): boolean => {
  return hasCompletedGameToday();
};

