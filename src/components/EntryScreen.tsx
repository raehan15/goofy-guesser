import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './EntryScreen.css';

interface EntryScreenProps {
  onPlayAsGuest: () => void;
}

export function EntryScreen({ onPlayAsGuest }: EntryScreenProps) {
  const { signIn, signUp, isSupabaseConfigured, resetPassword, updatePassword, isRecoveringPassword, setIsRecoveringPassword } = useAuth();
  const [mode, setMode] = useState<'menu' | 'signin' | 'signup' | 'forgot_password' | 'reset_password'>('menu');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isRecoveringPassword) {
      setMode('reset_password');
    }
  }, [isRecoveringPassword]);

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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await resetPassword(email);
    
    if (error) {
      setError(error.message);
    } else {
      setError('');
      alert('Password reset link sent! Please check your email.');
      setMode('signin');
    }
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await updatePassword(password);
    
    if (error) {
      setError(error.message);
    } else {
      setError('');
      alert('Password updated successfully!');
      setIsRecoveringPassword(false);
      setMode('menu');
    }
    setLoading(false);
  };

  const resetForm = () => {
    if (mode === 'reset_password') {
      setIsRecoveringPassword(false);
    }
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
          <h2>
            {mode === 'signin' ? 'Welcome back' : 
             mode === 'signup' ? 'Create account' : 
             mode === 'forgot_password' ? 'Reset Password' : 'Set New Password'}
          </h2>
          <p>
            {mode === 'signin' ? 'Sign in to your account' : 
             mode === 'signup' ? 'Join to compete in groups' : 
             mode === 'forgot_password' ? 'Enter your email to receive a reset link' : 'Enter your new password below'}
          </p>
        </div>
        
        <form onSubmit={
          mode === 'signin' ? handleSignIn : 
          mode === 'signup' ? handleSignUp : 
          mode === 'forgot_password' ? handleForgotPassword : handleResetPassword
        } className="auth-form">
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
          
          {mode !== 'reset_password' && (
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
          )}
          
          {mode !== 'forgot_password' && (
            <div className="auth-input-group">
              <label htmlFor="password" style={{ display: 'flex', justifyContent: 'space-between' }}>
                Password
                {mode === 'signin' && (
                  <button 
                    type="button" 
                    className="forgot-password-link" 
                    onClick={() => { setError(''); setMode('forgot_password'); }}
                  >
                    Forgot?
                  </button>
                )}
              </label>
              <div className="password-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
              </div>
            </div>
          )}
          
          {error && <p className="auth-error">{error}</p>}
          
          <button 
            type="submit" 
            className="entry-btn entry-btn-primary auth-submit"
            disabled={loading}
          >
            {loading ? 'Loading...' : 
             mode === 'signin' ? 'Sign In' : 
             mode === 'signup' ? 'Create Account' : 
             mode === 'forgot_password' ? 'Send Reset Link' : 'Update Password'}
          </button>
        </form>
        
        {mode !== 'reset_password' && mode !== 'forgot_password' && (
          <p className="auth-footer">
            {mode === 'signin' ? (
              <>Don't have an account? <button onClick={() => setMode('signup')}>Sign up</button></>
            ) : (
              <>Already have an account? <button onClick={() => setMode('signin')}>Sign in</button></>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
