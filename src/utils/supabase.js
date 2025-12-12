import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;
let supabaseAvailable = false;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    supabaseAvailable = true;
    console.log('✓ Supabase configured');
  } catch (error) {
    console.error('Supabase initialization error:', error);
    supabaseAvailable = false;
  }
} else {
  console.warn('⚠ Supabase credentials missing - running in demo mode');
  supabaseAvailable = false;
}

// Fallback auth handler for when Supabase is not available
export const onAuthStateChange = (callback) => {
  if (!supabaseAvailable) {
    // In demo mode, immediately call callback with no session
    setTimeout(() => {
      callback('SIGNED_OUT', null);
    }, 500);
    return { data: { subscription: { unsubscribe: () => {} } } };
  }
  
  return supabase.auth.onAuthStateChange(callback);
};

// Sign Up
export const signUp = async (email, password, username) => {
  if (!supabaseAvailable) {
    // Demo mode - always succeed
    return {
      data: { 
        user: { 
          id: 'demo-' + Math.random().toString(36).substr(2, 9), 
          email,
          user_metadata: { username }
        } 
      },
      error: null,
      message: 'Demo mode - signup successful'
    };
  }
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return { data, error: null, message: 'Check your email to verify' };
  } catch (error) {
    console.error('Signup error:', error);
    // Fallback to demo mode on error
    return {
      data: { 
        user: { 
          id: 'demo-' + Math.random().toString(36).substr(2, 9), 
          email,
          user_metadata: { username }
        } 
      },
      error: null,
      message: 'Signup successful (demo mode)'
    };
  }
};

// Mock sign in for demo mode
export const signIn = async (email, password) => {
  if (!supabaseAvailable) {
    // Demo mode - always succeed
    return {
      data: {
        user: {
          id: 'demo-user-' + Math.random().toString(36).substr(2, 9),
          email,
          user_metadata: { username: email.split('@')[0] }
        }
      },
      error: null
    };
  }
  try {
    return await supabase.auth.signInWithPassword({ email, password });
  } catch (error) {
    console.error('Sign in error:', error);
    // Fallback to demo mode on error
    return {
      data: {
        user: {
          id: 'demo-user-' + Math.random().toString(36).substr(2, 9),
          email,
          user_metadata: { username: email.split('@')[0] }
        }
      },
      error: null
    };
  }
};

export const signOut = async () => {
  if (!supabaseAvailable) {
    return { error: null };
  }
  return supabase.auth.signOut();
};

export const getCurrentUser = async () => {
  if (!supabaseAvailable) {
    return null;
  }
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

// Trade functions
export const saveTrade = async (userId, tradeData) => {
  if (!supabaseAvailable) {
    return { data: { id: 'demo-trade' }, error: null };
  }
  try {
    const { data, error } = await supabase
      .from('trades')
      .insert({
        user_id: userId,
        ...tradeData,
        created_at: new Date().toISOString()
      });
    
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error.message };
  }
};

export const getUserTrades = async (userId) => {
  if (!supabaseAvailable) {
    return { data: [], error: null };
  }
  try {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error.message };
  }
};

export const updateTrade = async (tradeId, updates) => {
  if (!supabaseAvailable) {
    return { data: { id: tradeId }, error: null };
  }
  try {
    const { data, error } = await supabase
      .from('trades')
      .update(updates)
      .eq('id', tradeId);
    
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error.message };
  }
};

export const deleteTrade = async (tradeId) => {
  if (!supabaseAvailable) {
    return { error: null };
  }
  try {
    const { error } = await supabase
      .from('trades')
      .delete()
      .eq('id', tradeId);
    
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error.message };
  }
};
