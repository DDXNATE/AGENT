const STORAGE_KEY_SESSION = 'pippy_session';
const STORAGE_KEY_TRADES = 'pippy_trades';

const getLocalData = (key, defaultVal) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultVal;
  } catch (e) {
    return defaultVal;
  }
};

const setLocalData = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error('Error saving to localStorage', e);
  }
};

export const onAuthStateChange = (callback) => {
  const session = getLocalData(STORAGE_KEY_SESSION, null);

  setTimeout(() => {
    callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
  }, 100);

  const storageListener = () => {
    const currentSession = getLocalData(STORAGE_KEY_SESSION, null);
    callback(currentSession ? 'SIGNED_IN' : 'SIGNED_OUT', currentSession);
  };

  window.addEventListener('storage', storageListener);
  window.addEventListener('auth-change', storageListener);

  return {
    data: {
      subscription: {
        unsubscribe: () => {
          window.removeEventListener('storage', storageListener);
          window.removeEventListener('auth-change', storageListener);
        }
      }
    }
  };
};

export const signUp = async (email, password, username) => {
  await new Promise(r => setTimeout(r, 800));

  const user = {
    id: 'user-' + Math.random().toString(36).substr(2, 9),
    email,
    user_metadata: { username }
  };

  const session = { user, access_token: 'session-token' };
  setLocalData(STORAGE_KEY_SESSION, session);
  window.dispatchEvent(new Event('auth-change'));

  return { data: { user, session }, error: null };
};

export const signIn = async (email, password) => {
  await new Promise(r => setTimeout(r, 600));

  const user = {
    id: 'user-main',
    email,
    user_metadata: { username: email.split('@')[0] }
  };

  const session = { user, access_token: 'session-token' };
  setLocalData(STORAGE_KEY_SESSION, session);
  window.dispatchEvent(new Event('auth-change'));

  return { data: { user, session }, error: null };
};

export const signOut = async () => {
  await new Promise(r => setTimeout(r, 300));
  localStorage.removeItem(STORAGE_KEY_SESSION);
  window.dispatchEvent(new Event('auth-change'));
  return { error: null };
};

export const getCurrentUser = async () => {
  const session = getLocalData(STORAGE_KEY_SESSION, null);
  return session ? session.user : null;
};

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
    insert: async (data) => saveTrade('user', data),
  })
};
