import { getCurrentUser, onAuthStateChange, signOutUser } from './authHelpers';

/**
 * Initialize session management
 * Call this once on app startup to set up auth listeners
 * 
 * @param {Function} onUserChange - Callback when user logs in/out
 * @param {Function} onError - Callback for auth errors
 * @returns {Function} Unsubscribe function
 */
export const initializeSessionHandler = (onUserChange, onError) => {
  // Check for existing session on page load
  const checkExistingSession = async () => {
    const user = await getCurrentUser();
    if (user) {
      onUserChange?.(user);
    }
  };

  checkExistingSession();

  // Listen for auth state changes
  const { data: { subscription } } = onAuthStateChange((event, session) => {
    console.log('Auth event:', event);

    switch (event) {
      case 'SIGNED_IN':
        onUserChange?.(session?.user);
        break;

      case 'SIGNED_OUT':
        onUserChange?.(null);
        break;

      case 'USER_UPDATED':
        onUserChange?.(session?.user);
        break;

      case 'TOKEN_REFRESHED':
        console.log('Session token refreshed');
        break;

      case 'PASSWORD_RECOVERY':
        console.log('Password recovery email sent');
        break;

      default:
        break;
    }
  });

  // Return unsubscribe function
  return () => subscription?.unsubscribe();
};

/**
 * Protected route wrapper
 * Redirects to login if not authenticated
 * 
 * @param {Component} Component - React component to protect
 * @param {string} redirectPath - Path to redirect if not authenticated (default: '/login')
 * @returns {Component} Wrapped component
 */
export const withProtectedRoute = (Component, redirectPath = '/login') => {
  return function ProtectedComponent(props) {
    const [isAuthenticated, setIsAuthenticated] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
      const checkAuth = async () => {
        const user = await getCurrentUser();
        if (!user) {
          window.location.href = redirectPath;
        } else {
          setIsAuthenticated(true);
        }
        setIsLoading(false);
      };

      checkAuth();
    }, []);

    if (isLoading) {
      return <div className="loading"><div className="spinner"></div></div>;
    }

    return isAuthenticated ? <Component {...props} /> : null;
  };
};

/**
 * Auto-logout on inactivity
 * Logs out user after specified time of no activity
 * 
 * @param {number} inactivityTimeoutMs - Timeout in milliseconds (default: 30 minutes)
 */
export const setupInactivityLogout = (inactivityTimeoutMs = 30 * 60 * 1000) => {
  let inactivityTimer;

  const resetTimer = async () => {
    clearTimeout(inactivityTimer);

    const user = await getCurrentUser();
    if (user) {
      inactivityTimer = setTimeout(async () => {
        console.log('Logging out due to inactivity');
        await signOutUser();
        window.location.href = '/login';
      }, inactivityTimeoutMs);
    }
  };

  // Activity events to listen for
  const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

  events.forEach((event) => {
    document.addEventListener(event, resetTimer, true);
  });

  // Initial setup
  resetTimer();

  // Return cleanup function
  return () => {
    clearTimeout(inactivityTimer);
    events.forEach((event) => {
      document.removeEventListener(event, resetTimer, true);
    });
  };
};

/**
 * Handle session persistence
 * Automatically restore session on page reload
 */
export const restoreSessionOnPageLoad = async () => {
  const user = await getCurrentUser();
  return user;
};

/**
 * Redirect authenticated users away from auth pages
 * 
 * @param {string} redirectPath - Path to redirect authenticated users to (default: '/dashboard')
 */
export const redirectIfAuthenticated = async (redirectPath = '/dashboard') => {
  const user = await getCurrentUser();
  if (user) {
    window.location.href = redirectPath;
    return true;
  }
  return false;
};
