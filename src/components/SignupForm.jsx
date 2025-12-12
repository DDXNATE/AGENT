import { useState } from 'react';
import { signUpUser, isUsernameAvailable } from '../utils/authHelpers';
import '../styles/AuthForms.css';

export default function SignupForm({ onSuccess, onSwitchToLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState('');

  const handleUsernameBlur = async () => {
    if (!username || username.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      return;
    }

    setCheckingUsername(true);
    setUsernameError('');

    const available = await isUsernameAvailable(username);
    if (!available) {
      setUsernameError('Username is already taken');
    }

    setCheckingUsername(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Validation
    if (!email || !password || !username || !confirmPassword) {
      setError('All fields are required');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (usernameError) {
      setError(usernameError);
      setLoading(false);
      return;
    }

    try {
      const result = await signUpUser(email, password, username);

      if (!result.ok) {
        setError(result.error || 'Signup failed');
      } else {
        setSuccess(result.message || 'Signup successful! Check your email to verify.');
        // Clear form
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setUsername('');
        // Call parent callback
        if (onSuccess) {
          setTimeout(() => onSuccess(result.user), 2000);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Signup error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form signup-form">
      <h2>Create Account</h2>

      {error && <div className="auth-error">{error}</div>}
      {success && <div className="auth-success">{success}</div>}

      <div className="form-group">
        <label htmlFor="signup-email">Email</label>
        <input
          id="signup-email"
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
        <label htmlFor="signup-username">
          Username
          {checkingUsername && <span className="spinner-small">...</span>}
        </label>
        <input
          id="signup-username"
          type="text"
          placeholder="Choose a username"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setUsernameError('');
            setError('');
          }}
          onBlur={handleUsernameBlur}
          disabled={loading}
          required
          minLength="3"
        />
        {usernameError && <div className="field-error">{usernameError}</div>}
      </div>

      <div className="form-group">
        <label htmlFor="signup-password">Password</label>
        <input
          id="signup-password"
          type="password"
          placeholder="Min 6 characters"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError('');
          }}
          disabled={loading}
          required
          minLength="6"
        />
      </div>

      <div className="form-group">
        <label htmlFor="signup-confirm">Confirm Password</label>
        <input
          id="signup-confirm"
          type="password"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            setError('');
          }}
          disabled={loading}
          required
          minLength="6"
        />
      </div>

      <button type="submit" disabled={loading || checkingUsername} className="auth-submit">
        {loading ? 'Creating Account...' : 'Sign Up'}
      </button>

      <p className="auth-switch">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="link-button"
          disabled={loading}
        >
          Log in
        </button>
      </p>
    </form>
  );
}
