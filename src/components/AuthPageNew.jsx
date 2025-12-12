import { useState, useEffect } from 'react';
import SignupForm from './SignupForm';
import LoginForm from './LoginForm';
import { onAuthStateChange } from '../utils/authHelpers';
import '../styles/AuthForms.css';

export default function AuthPage({ onAuthSuccess }) {
  const [isSignupMode, setIsSignupMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is already logged in on mount
  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange((event, session) => {
      if (session?.user) {
        // User is logged in
        onAuthSuccess?.(session.user);
      }
      setIsLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, [onAuthSuccess]);

  if (isLoading) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1>Agent Pippy</h1>
          <p>AI-Powered Trading Analysis</p>
        </div>

        <div className="auth-tabs">
          <button
            className={`tab-button ${!isSignupMode ? 'active' : ''}`}
            onClick={() => setIsSignupMode(false)}
          >
            Log In
          </button>
          <button
            className={`tab-button ${isSignupMode ? 'active' : ''}`}
            onClick={() => setIsSignupMode(true)}
          >
            Sign Up
          </button>
        </div>

        {isSignupMode ? (
          <SignupForm
            onSuccess={onAuthSuccess}
            onSwitchToLogin={() => setIsSignupMode(false)}
          />
        ) : (
          <LoginForm
            onSuccess={onAuthSuccess}
            onSwitchToSignup={() => setIsSignupMode(true)}
          />
        )}
      </div>
    </div>
  );
}
