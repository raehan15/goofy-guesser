import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './EntryScreen.css';

interface EntryScreenProps {
  onPlayAsGuest: () => void;
}

export function EntryScreen({ onPlayAsGuest }: EntryScreenProps) {
  const { signIn, signUp, isSupabaseConfigured } = useAuth();
  const [mode, setMode] = useState<'menu' | 'signin' | 'signup'>('menu');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signIn(email, password);
    
    if (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      setLoading(false);
      return;
    }

    const { error } = await signUp(email, password, username);
    
    if (error) {
      setError(error.message);
    } else {
      setError('');
      setMode('signin');
      alert('Account created! Please check your email to verify, then sign in.');
    }
    setLoading(false);
  };

  const resetForm = () => {
    setMode('menu');
    setError('');
    setEmail('');
    setPassword('');
    setUsername('');
  };

  if (mode === 'menu') {
    return (
      <div className="entry-screen">
        <div className="entry-content">
          <div className="entry-logo">
            <h1>GOOFY GUESSER</h1>
            <p>A daily word guessing game</p>
          </div>
          
          <div className="entry-actions">
            <button 
              className="entry-btn entry-btn-primary"
              onClick={onPlayAsGuest}
            >
              Play Now
            </button>
            
            {isSupabaseConfigured && (
              <>
                <div className="entry-divider">or</div>
                <button 
                  className="entry-btn entry-btn-secondary"
                  onClick={() => setMode('signin')}
                >
                  Sign in to compete
                </button>
              </>
            )}
          </div>
          
          {isSupabaseConfigured && (
            <p className="auth-footer">
              New here? <button onClick={() => setMode('signup')}>Create account</button>
            </p>
          )}
          
          {!isSupabaseConfigured && (
            <p style={{ color: '#737373', fontSize: '0.85rem', marginTop: '24px' }}>
              Backend not configured. Play as guest only.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="entry-screen">
      <div className="entry-content">
        <button className="back-link" onClick={resetForm}>
          ← Back
        </button>
        
        <div className="auth-form-header">
          <h2>{mode === 'signin' ? 'Welcome back' : 'Create account'}</h2>
          <p>{mode === 'signin' ? 'Sign in to your account' : 'Join to compete in groups'}</p>
        </div>
        
        <form onSubmit={mode === 'signin' ? handleSignIn : handleSignUp} className="auth-form">
          {mode === 'signup' && (
            <div className="auth-input-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="auth-input"
                required
                minLength={3}
              />
            </div>
          )}
          
          <div className="auth-input-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
              required
            />
          </div>
          
          <div className="auth-input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
              required
              minLength={6}
            />
          </div>
          
          {error && <p className="auth-error">{error}</p>}
          
          <button 
            type="submit" 
            className="entry-btn entry-btn-primary auth-submit"
            disabled={loading}
          >
            {loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        
        <p className="auth-footer">
          {mode === 'signin' ? (
            <>Don't have an account? <button onClick={() => setMode('signup')}>Sign up</button></>
          ) : (
            <>Already have an account? <button onClick={() => setMode('signin')}>Sign in</button></>
          )}
        </p>
      </div>
    </div>
  );
}
