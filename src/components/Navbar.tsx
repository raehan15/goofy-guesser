import { useAuth } from '../contexts/AuthContext';
import './Navbar.css';

interface NavbarProps {
  onSignIn?: () => void;
  onBack?: () => void;
  showBack?: boolean;
}

export function Navbar({ onSignIn, onBack, showBack = false }: NavbarProps) {
  const { user, signOut, isSupabaseConfigured } = useAuth();

  // Get username from user metadata or email
  const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'User';

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <div className="navbar-brand">
          {showBack && onBack && (
            <button className="navbar-btn navbar-back" onClick={onBack}>
              ←
            </button>
          )}
          <h1>GOOFY GUESSER</h1>
        </div>

        <div className="navbar-actions">
          {user ? (
            <div className="navbar-user">
              <span className="navbar-username">{username}</span>
              <button className="navbar-btn navbar-btn-ghost" onClick={signOut}>
                Logout
              </button>
            </div>
          ) : isSupabaseConfigured && onSignIn ? (
            <button className="navbar-btn navbar-btn-primary" onClick={onSignIn}>
              Sign In
            </button>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
