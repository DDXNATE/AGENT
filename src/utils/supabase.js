/**
 * MOCK SUPABASE CLIENT - DEMO MODE
 * This replaces the real Supabase client to allow the app to function
 * without valid API keys. It persists data to localStorage.
 */

const STORAGE_KEY_SESSION = 'demo_session';
const STORAGE_KEY_TRADES = 'demo_trades';

// Helper to get local storage data safely
const getLocalData = (key, defaultVal) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultVal;
  } catch (e) {
    return defaultVal;
  }
};

// Helper to set local storage data safely
const setLocalData = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error('Error saving to localStorage', e);
  }
};

// --- AUTH MOCK ---

export const onAuthStateChange = (callback) => {
  // Check for existing session on init
  const session = getLocalData(STORAGE_KEY_SESSION, null);

  // Need to delay slightly to simulate async behavior
  setTimeout(() => {
    callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
  }, 100);

  // Listen for storage events (basic cross-tab sync) or custom events
  const storageListener = () => {
    const currentSession = getLocalData(STORAGE_KEY_SESSION, null);
    callback(currentSession ? 'SIGNED_IN' : 'SIGNED_OUT', currentSession);
  };

  window.addEventListener('storage', storageListener);
  // Custom event for same-tab updates
  window.addEventListener('demo-auth-change', storageListener);

  return {
    data: {
      subscription: {
        unsubscribe: () => {
          window.removeEventListener('storage', storageListener);
          window.removeEventListener('demo-auth-change', storageListener);
        }
      }
    }
  };
};

export const signUp = async (email, password, username) => {
  await new Promise(r => setTimeout(r, 800)); // Simulate net lag

  const user = {
    id: 'demo-user-' + Math.random().toString(36).substr(2, 9),
    email,
    user_metadata: { username }
  };

  const session = { user, access_token: 'mock-token' };
  setLocalData(STORAGE_KEY_SESSION, session);
  window.dispatchEvent(new Event('demo-auth-change'));

  return { data: { user, session }, error: null };
};

export const signIn = async (email, password) => {
  await new Promise(r => setTimeout(r, 600)); // Simulate net lag

  const user = {
    id: 'demo-user-123', // Consistent ID for demo
    email,
    user_metadata: { username: email.split('@')[0] }
  };

  const session = { user, access_token: 'mock-token' };
  setLocalData(STORAGE_KEY_SESSION, session);
  window.dispatchEvent(new Event('demo-auth-change'));

  return { data: { user, session }, error: null };
};

export const signOut = async () => {
  await new Promise(r => setTimeout(r, 300));
  localStorage.removeItem(STORAGE_KEY_SESSION);
  window.dispatchEvent(new Event('demo-auth-change'));
  return { error: null };
};

export const getCurrentUser = async () => {
  const session = getLocalData(STORAGE_KEY_SESSION, null);
  return session ? session.user : null;
};


// --- DATABASE MOCK (TRADES) ---

export const saveTrade = async (userId, tradeData) => {
  await new Promise(r => setTimeout(r, 400));

  const trades = getLocalData(STORAGE_KEY_TRADES, []);
  const newTrade = {
    id: Date.now(),
    user_id: userId,
    ...tradeData,
    created_at: new Date().toISOString()
  };

  trades.unshift(newTrade);
  setLocalData(STORAGE_KEY_TRADES, trades);

  return { data: [newTrade], error: null };
};

export const getUserTrades = async (userId) => {
  await new Promise(r => setTimeout(r, 300));
  const trades = getLocalData(STORAGE_KEY_TRADES, []);
  return { data: trades, error: null };
};

export const updateTrade = async (tradeId, updates) => {
  await new Promise(r => setTimeout(r, 300));

  let trades = getLocalData(STORAGE_KEY_TRADES, []);
  let updatedTrade = null;

  trades = trades.map(t => {
    if (t.id === tradeId) {
      updatedTrade = { ...t, ...updates };
      return updatedTrade;
    }
    return t;
  });

  setLocalData(STORAGE_KEY_TRADES, trades);

  return { data: [updatedTrade], error: null };
};

export const deleteTrade = async (tradeId) => {
  await new Promise(r => setTimeout(r, 300));

  let trades = getLocalData(STORAGE_KEY_TRADES, []);
  trades = trades.filter(t => t.id !== tradeId);
  setLocalData(STORAGE_KEY_TRADES, trades);

  return { error: null };
};

// Export a dummy object for compatibility if code imports 'supabase' directly
export const supabase = {
  auth: {
    onAuthStateChange,
    signUp: (opts) => signUp(opts.email, opts.password, opts.options?.data?.username),
    signInWithPassword: (opts) => signIn(opts.email, opts.password),
    signOut,
    getUser: async () => ({ data: { user: await getCurrentUser() } })
  },
  from: () => ({
    select: () => ({ eq: () => ({ order: async () => ({ data: getLocalData(STORAGE_KEY_TRADES, []), error: null }) }) }),
    insert: async (data) => saveTrade('demo', data),
    // ... basic mocks for fluent API if needed, but we mostly use the helpers above
  })
};
