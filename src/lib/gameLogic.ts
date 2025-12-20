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
// GUEST LOCAL STORAGE HELPERS
// ============================================
// For non-logged-in users (guests) only

const GUEST_STORAGE_KEY = 'goofy_guesser_guest_play';

interface GuestPlayStatus {
  date: string;
  played: boolean;
  guessCount?: number;
  solved?: boolean;
}

export const saveGuestPlayStatus = (status: Omit<GuestPlayStatus, 'date' | 'played'>): void => {
  try {
    const data: GuestPlayStatus = {
      date: getLocalDateString(),
      played: true,
      ...status
    };
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save guest play status:', e);
  }
};

export const hasGuestPlayedToday = (): boolean => {
  try {
    const stored = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!stored) return false;
    
    const data: GuestPlayStatus = JSON.parse(stored);
    return data.date === getLocalDateString() && data.played === true;
  } catch {
    return false;
  }
};
