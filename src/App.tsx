import { useState, useEffect, useCallback, useRef } from 'react';
import './index.css';
import { Grid } from './components/Grid';
import { Keyboard } from './components/Keyboard';
import { Modal } from './components/Modal';
import { EntryScreen } from './components/EntryScreen';
import { GroupsPanel } from './components/GroupsPanel';
import { Navbar } from './components/Navbar';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useGroups } from './hooks/useGroups';
import { useGameResults } from './hooks/useGameResults';
import { isValidGuess, checkGuess, getWordOfDay, type LetterState } from './lib/gameLogic';

type AppView = 'entry' | 'groups' | 'game';

function GameContent() {
  const { user, loading: authLoading } = useAuth();
  const { groups, loading: groupsLoading } = useGroups();
  const { submitResult, hasSubmittedToday } = useGameResults();

  const [view, setView] = useState<AppView>('entry');
  const [isGuest, setIsGuest] = useState(false);
  const [resultSubmitted, setResultSubmitted] = useState(false);
  // Explicit flag to track if we're still checking played status
  const [isCheckingPlayStatus, setIsCheckingPlayStatus] = useState(true);
  // true = played, false = not played (only valid when isCheckingPlayStatus is false)
  const [hasPlayedToday, setHasPlayedToday] = useState(false);
  
  // Store join code from URL to persist across auth flow
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    if (joinCode) {
      // Clean URL immediately
      window.history.replaceState({}, '', window.location.pathname);
    }
    return joinCode;
  });

  // Game state (unchanged from original)
  const [solution, setSolution] = useState('');
  const [guesses, setGuesses] = useState<string[]>(Array(6).fill(''));
  const [currentGuess, setCurrentGuess] = useState('');
  const [turn, setTurn] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isGameWon, setIsGameWon] = useState(false);
  const [guessStates, setGuessStates] = useState<LetterState[][]>(Array(6).fill(Array(5).fill('initial')));
  const [usedKeys, setUsedKeys] = useState<{ [key: string]: LetterState }>({});
  const [shakeRowIndex, setShakeRowIndex] = useState<number>(-1);
  
  // Ref to capture the final guess count (avoids stale closure issues)
  const finalGuessCountRef = useRef<number>(0);
  // Check if user has already played today on load
  useEffect(() => {
    let cancelled = false;
    
    // Reset checking status whenever dependencies change (e.g. groups load)
    setIsCheckingPlayStatus(true);

    const checkPlayedStatus = async () => {
      // Still loading auth or groups - wait (keep isCheckingPlayStatus true)
      if (authLoading || groupsLoading) {
        return;
      }
      
      // Not logged in - GroupsPanel won't show anyway, nothing to check
      if (!user) {
        if (!cancelled) {
          setHasPlayedToday(false);
          setIsCheckingPlayStatus(false);
        }
        return;
      }

      // User has no groups - they haven't played in any group
      if (groups.length === 0) {
        if (!cancelled) {
          setHasPlayedToday(false);
          setIsCheckingPlayStatus(false);
        }
        return;
      }

      // Check if user has submitted to any group today
      let played = false;
      for (const group of groups) {
        if (cancelled) return;
        const hasPlayed = await hasSubmittedToday(group);
        if (hasPlayed) {
          played = true;
          break;
        }
      }
      if (!cancelled) {
        setHasPlayedToday(played);
        setIsCheckingPlayStatus(false);
      }
    };

    checkPlayedStatus();

    return () => { cancelled = true; };
  }, [user, authLoading, groups, groupsLoading, hasSubmittedToday]);

  // Determine view based on auth state
  useEffect(() => {
    if (authLoading) return;
    
    if (user && !isGuest) {
      // Logged in user - show groups by default
      if (view === 'entry') {
        setView('groups');
      }
    } else if (!user && !isGuest) {
      // Not logged in and not guest - show entry
      setView('entry');
    }
  }, [user, authLoading, isGuest, view]);

  useEffect(() => {
    setSolution(getWordOfDay());
  }, []);

  useEffect(() => {
    if (view !== 'game') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isGameOver) return;

      const key = e.key.toUpperCase();
      if (key === 'ENTER') handleEnter();
      else if (key === 'BACKSPACE') handleDelete();
      else if (/^[A-Z]$/.test(key)) handleChar(key);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentGuess, isGameOver, turn, view]);

  const handleChar = (char: string) => {
    if (currentGuess.length < 5) {
      setCurrentGuess((prev) => prev + char);
    }
  };

  const handleDelete = () => {
    setCurrentGuess((prev) => prev.slice(0, -1));
  };

  const handleEnter = () => {
    if (currentGuess.length !== 5) return;
    if (!isValidGuess(currentGuess)) {
      setShakeRowIndex(turn);
      setTimeout(() => setShakeRowIndex(-1), 600);
      return;
    }

    const newGuesses = [...guesses];
    newGuesses[turn] = currentGuess;
    setGuesses(newGuesses);

    const result = checkGuess(currentGuess, solution);
    const newGuessStates = [...guessStates];
    newGuessStates[turn] = result;
    setGuessStates(newGuessStates);

    // Update used keys after animation
    setTimeout(() => {
      const newUsedKeys = { ...usedKeys };
      currentGuess.split('').forEach((char, i) => {
        const currentState = newUsedKeys[char];
        const newState = result[i];
        
        if (newState === 'correct') {
          newUsedKeys[char] = 'correct';
        } else if (newState === 'present' && currentState !== 'correct') {
          newUsedKeys[char] = 'present';
        } else if (newState === 'absent' && currentState !== 'correct' && currentState !== 'present') {
          newUsedKeys[char] = 'absent';
        }
      });
      setUsedKeys(newUsedKeys);
    }, 1800);

    if (currentGuess === solution) {
      const guessCount = turn + 1;
      finalGuessCountRef.current = guessCount;
      setTurn(guessCount);
      setCurrentGuess('');
      setTimeout(() => {
        setIsGameWon(true);
        setIsGameOver(true);
      }, 2500);
    } else if (turn === 5) {
      finalGuessCountRef.current = 6; // Failed after 6 guesses
      setTurn(6);  // Increment turn so the last row renders with states (animation)
      setCurrentGuess('');
      setTimeout(() => {
        setIsGameOver(true);
      }, 2000);
    } else {
      setTurn((prev) => prev + 1);
      setCurrentGuess('');
    }
  };

  // Submit result when game ends (for logged in users with groups)
  const handleGameEnd = useCallback(async () => {
    if (resultSubmitted || isGuest || !user || groups.length === 0) return;
    
    const result = await submitResult(groups, {
      guessCount: finalGuessCountRef.current,
      solved: isGameWon
    });
    
    setResultSubmitted(true);
    setHasPlayedToday(true);
    
    if (result.submitted > 0) {
      console.log(`Submitted results to ${result.submitted} groups`);
    }
  }, [resultSubmitted, isGuest, user, groups, turn, isGameWon, submitResult]);

  useEffect(() => {
    if (isGameOver) {
      handleGameEnd();
    }
  }, [isGameOver, handleGameEnd]);

  const resetGame = () => {
    setIsGameOver(false);
    setIsGameWon(false);
    setTurn(0);
    setGuesses(Array(6).fill(''));
    setGuessStates(Array(6).fill(Array(5).fill('initial')));
    setUsedKeys({});
    setSolution(getWordOfDay());
    setCurrentGuess('');
    setResultSubmitted(false);
  };

  const handlePlayAsGuest = () => {
    setIsGuest(true);
    setView('game');
  };

  if (authLoading) {
    return (
      <div className="App" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100dvh' }}>
        <p>Loading...</p>
      </div>
    );
  }

  // Entry Screen
  if (view === 'entry') {
    return <EntryScreen onPlayAsGuest={handlePlayAsGuest} />;
  }

  // Groups Panel (for logged-in users)
  if (view === 'groups' && user) {
    // Final played status: null while checking, true if played (or just submitted), false if not played
    const playedTodayStatus = (isCheckingPlayStatus || groupsLoading || authLoading)
      ? null 
      : (hasPlayedToday || resultSubmitted ? true : false);
    
    return (
      <div style={{ minHeight: '100dvh', background: 'linear-gradient(165deg, #0a0f0f 0%, #0d1717 30%, #0f1a1a 60%, #0a1212 100%)' }}>
        <Navbar />
        <GroupsPanel 
          onPlayGame={() => setView('game')} 
          hasPlayedToday={playedTodayStatus}
          pendingJoinCode={pendingJoinCode}
          onJoinComplete={() => setPendingJoinCode(null)}
        />
      </div>
    );
  }

  // Game View
  return (
    <div className="game-wrapper">
      <Navbar
        showBack={true}
        onBack={() => {
          if (user) {
            setView('groups');
          } else {
            setIsGuest(false);
            setView('entry');
          }
        }}
        onSignIn={() => {
          setIsGuest(false);
          setView('entry');
        }}
      />
      <div className="App">
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '20px' }}>
        <Grid 
          guesses={guesses} 
          currentGuess={currentGuess} 
          guessStates={guessStates} 
          turn={turn} 
          shakeRowIndex={shakeRowIndex}
        />
        <Keyboard 
          onChar={handleChar} 
          onDelete={handleDelete} 
          onEnter={handleEnter} 
          usedKeys={usedKeys} 
        />
        <Modal 
          isOpen={isGameOver} 
          isWin={isGameWon} 
          solution={solution} 
          turn={turn}
          guessStates={guessStates}
          onClose={resetGame}
          onBackToGroups={() => setView('groups')}
          groupCount={!isGuest && user ? groups.length : 0}
          isAuthenticated={!isGuest && !!user}
        />
      </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <GameContent />
    </AuthProvider>
  );
}

export default App;
