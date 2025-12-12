import { useState } from 'react';
import { signInUser } from '../utils/authHelpers';
import '../styles/AuthForms.css';

export default function LoginForm({ onSuccess, onSwitchToSignup }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validation
    if (!email || !password) {
      setError('Email and password are required');
      setLoading(false);
      return;
    }

    try {
      const result = await signInUser(email, password);

      if (!result.ok) {
        setError(result.error || 'Login failed');
      } else {
        // Clear form
        setEmail('');
        setPassword('');
        // Call parent callback
        if (onSuccess) {
          onSuccess(result.user);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form login-form">
      <h2>Log In</h2>

      {error && <div className="auth-error">{error}</div>}

      <div className="form-group">
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError('');
          }}
          disabled={loading}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError('');
          }}
          disabled={loading}
          required
        />
      </div>

      <div className="form-group checkbox">
        <input
          id="login-remember"
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          disabled={loading}
        />
        <label htmlFor="login-remember">Remember me</label>
      </div>

      <button type="submit" disabled={loading} className="auth-submit">
        {loading ? 'Logging In...' : 'Log In'}
      </button>

      <p className="auth-switch">
        Don't have an account?{' '}
        <button
          type="button"
          onClick={onSwitchToSignup}
          className="link-button"
          disabled={loading}
        >
          Sign up
        </button>
      </p>

      <p className="auth-help">
        <a href="#forgot">Forgot password?</a>
      </p>
    </form>
  );
}
