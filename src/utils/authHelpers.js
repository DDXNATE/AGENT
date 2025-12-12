import { supabase } from './supabase.js';

/**
 * Configuration flag for profile creation timing
 * true = create profile immediately on signup
 * false = create profile after email verification (on first login)
 */
const CREATE_PROFILE_ON_SIGNUP = true;

/**
 * Sign up a new user
 * Step 1: Create auth.users entry via supabase.auth.signUp()
 * Step 2: Insert into public.profiles (if CREATE_PROFILE_ON_SIGNUP = true)
 * Returns: { ok: boolean, error?: string, message?: string, user?: User }
 */
export const signUpUser = async (email, password, username) => {
  try {
    // Validate inputs
    if (!email || !password || !username) {
      return { ok: false, error: 'Email, password, and username are required' };
    }

    if (password.length < 6) {
      return { ok: false, error: 'Password must be at least 6 characters' };
    }

    if (username.length < 3) {
      return { ok: false, error: 'Username must be at least 3 characters' };
    }

    // Check username availability
    const isAvailable = await isUsernameAvailable(username);
    if (!isAvailable) {
      return { ok: false, error: 'Username already taken' };
    }

    // Step 1: Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password
    });

    if (authError) {
      return { ok: false, error: authError.message || 'Signup failed' };
    }

    const user = authData.user;
    if (!user?.id) {
      return { ok: false, error: 'Failed to create user account' };
    }

    // Step 2: Create profile (if enabled)
    if (CREATE_PROFILE_ON_SIGNUP) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{ id: user.id, email, username }]);

      if (profileError) {
        console.error('Profile insert error:', profileError);
        // Note: Profile creation failed but auth user exists
        // User can retry profile creation after email verification
        return {
          ok: false,
          error: 'Profile creation failed. Please try again after email verification.'
        };
      }
    }

    return {
      ok: true,
      message: 'Signup successful! Check your email to verify your account.',
      user
    };
  } catch (err) {
    console.error('Signup error:', err);
    return { ok: false, error: 'An unexpected error occurred' };
  }
};

/**
 * Sign in an existing user
 * Returns: { ok: boolean, error?: string, user?: User }
 */
export const signInUser = async (email, password) => {
  try {
    if (!email || !password) {
      return { ok: false, error: 'Email and password are required' };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return { ok: false, error: error.message || 'Invalid credentials' };
    }

    const user = data.user;
    if (!user) {
      return { ok: false, error: 'Login failed' };
    }

    // Check if email is verified
    if (!user.email_confirmed_at && !CREATE_PROFILE_ON_SIGNUP) {
      return {
        ok: false,
        error: 'Please verify your email before logging in. Check your inbox.'
      };
    }

    // Ensure profile exists (for post-verification flow)
    if (!CREATE_PROFILE_ON_SIGNUP) {
      await ensureProfile(user);
    }

    return { ok: true, user };
  } catch (err) {
    console.error('Sign in error:', err);
    return { ok: false, error: 'An unexpected error occurred' };
  }
};

/**
 * Sign out the current user
 * Returns: { ok: boolean, error?: string }
 */
export const signOutUser = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    console.error('Sign out error:', err);
    return { ok: false, error: 'An unexpected error occurred' };
  }
};

/**
 * Get current authenticated user
 * Returns: User object or null
 */
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.error('Get user error:', error);
      return null;
    }
    return user;
  } catch (err) {
    console.error('Get current user error:', err);
    return null;
  }
};

/**
 * Ensure a user has a profile entry
 * If profile doesn't exist, create it
 * Used for post-verification profile creation flow
 * Returns: { data?, error? }
 */
export const ensureProfile = async (user, username = '') => {
  if (!user?.id) {
    return { error: 'No user provided' };
  }

  try {
    // Check if profile exists
    const { data: existingProfile, error: selectError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .limit(1);

    if (selectError) {
      return { error: selectError.message };
    }

    // Profile already exists
    if (existingProfile?.length > 0) {
      return { data: existingProfile[0] };
    }

    // Create profile
    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert([{
        id: user.id,
        email: user.email,
        username: username || user.email.split('@')[0]
      }]);

    if (insertError) {
      return { error: insertError.message };
    }

    return { data: newProfile };
  } catch (err) {
    console.error('Ensure profile error:', err);
    return { error: 'Failed to ensure profile exists' };
  }
};

/**
 * Get the current user's profile
 * Returns: { data: Profile | null, error?: string }
 */
export const getMyProfile = async () => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { data: null, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Profile not found
        return { data: null, error: 'Profile not found' };
      }
      return { data: null, error: error.message };
    }

    return { data };
  } catch (err) {
    console.error('Get profile error:', err);
    return { data: null, error: 'Failed to fetch profile' };
  }
};

/**
 * Check if a username is available
 * Returns: true if available, false if taken
 */
export const isUsernameAvailable = async (username) => {
  try {
    if (!username || username.length < 3) {
      return false;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id', { count: 'exact' })
      .eq('username', username)
      .limit(1);

    if (error) {
      console.error('Username check error:', error);
      return false;
    }

    return (data?.length ?? 0) === 0;
  } catch (err) {
    console.error('Username availability check error:', err);
    return false;
  }
};

/**
 * Listen to auth state changes
 * Call callback with (event, session) whenever auth state changes
 */
export const onAuthStateChange = (callback) => {
  return supabase.auth.onAuthStateChange(callback);
};
