# Supabase Auth Integration Guide

## 🎯 Overview

This guide implements **production-ready signup & login** using Supabase Auth with the existing `public.profiles` table and RLS policies.

**Key Files:**
- `src/utils/supabaseClient.js` - Supabase client initialization
- `src/utils/authHelpers.js` - Core auth functions (signup, login, logout)
- `src/components/SignupForm.jsx` - Signup form component
- `src/components/LoginForm.jsx` - Login form component
- `src/components/AuthPageNew.jsx` - Combined auth page
- `src/utils/sessionHandler.js` - Session management utilities
- `src/styles/AuthForms.css` - Auth form styles

---

## ⚙️ Setup & Configuration

### 1. Environment Variables (Already Set)

Your `.env` file already contains:
```env
VITE_SUPABASE_URL=https://qhtsjvuqrgqzvavpljjo.supabase.co
VITE_SUPABASE_ANON_KEY=sb_secret_1rGIJV1MsGKeNC3pPcVY6g_OgCswJvO
```

**DO NOT expose the ANON_KEY in version control.**

### 2. Database Schema

The `public.profiles` table is already created with:
```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS Policies (already configured):**
- `profiles_insert_own` → Users can INSERT only their own profile
- `profiles_select_own` → Users can SELECT only their own profile
- `profiles_update_own` → Users can UPDATE only their own profile

### 3. Email Verification Setup (Supabase Dashboard)

In Supabase dashboard:
1. Go to **Authentication > Providers > Email**
2. Check: "Confirm email"
3. Users receive verification email after signup
4. Must verify before accessing app (configurable)

---

## 📋 Integration into Existing App

### Option 1: Replace Existing AuthPage (Recommended)

**Current AuthPage:**
```bash
src/components/AuthPage.jsx  (old implementation)
```

**New Implementation:**
- Keep existing `AuthPageNew.jsx`
- Or rename to `AuthPage.jsx` to replace the old one
- Update `src/App.jsx` to import from correct location

### Option 2: Use as Modal Dialog

```jsx
import { useState } from 'react';
import AuthPageNew from './components/AuthPageNew';

export default function MyApp() {
  const [showAuth, setShowAuth] = useState(false);

  return (
    <>
      {showAuth && (
        <AuthPageNew onAuthSuccess={(user) => {
          console.log('Logged in as:', user);
          setShowAuth(false);
        }} />
      )}
      <button onClick={() => setShowAuth(true)}>Login</button>
    </>
  );
}
```

### Option 3: Separate Routes

```jsx
// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AuthPageNew from './components/AuthPageNew';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPageNew onAuthSuccess={...} />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
```

---

## 🔑 Core Functions

### Authentication

**1. Sign Up**
```javascript
import { signUpUser, isUsernameAvailable } from '@/utils/authHelpers';

const result = await signUpUser('user@example.com', 'password123', 'username');
// Returns: { ok: true, message: '...', user: {...} } or { ok: false, error: '...' }
```

**2. Log In**
```javascript
import { signInUser } from '@/utils/authHelpers';

const result = await signInUser('user@example.com', 'password123');
// Returns: { ok: true, user: {...} } or { ok: false, error: '...' }
```

**3. Log Out**
```javascript
import { signOutUser } from '@/utils/authHelpers';

const result = await signOutUser();
// Returns: { ok: true } or { ok: false, error: '...' }
```

**4. Get Current User**
```javascript
import { getCurrentUser } from '@/utils/authHelpers';

const user = await getCurrentUser();
// Returns: User object or null
```

### Profile Management

**5. Get User Profile**
```javascript
import { getMyProfile } from '@/utils/authHelpers';

const { data: profile, error } = await getMyProfile();
// Returns: { data: { id, email, username, created_at, ... }, error?: string }
```

**6. Ensure Profile Exists**
```javascript
import { ensureProfile } from '@/utils/authHelpers';

// Used when creating profile after email verification
const user = await getCurrentUser();
await ensureProfile(user, 'optional_username');
```

**7. Check Username Availability**
```javascript
import { isUsernameAvailable } from '@/utils/authHelpers';

const available = await isUsernameAvailable('desired_username');
// Returns: boolean
```

### Session Management

**8. Listen to Auth Changes**
```javascript
import { onAuthStateChange } from '@/utils/authHelpers';

const { data: { subscription } } = onAuthStateChange((event, session) => {
  if (session) {
    console.log('User logged in:', session.user);
  } else {
    console.log('User logged out');
  }
});

// Cleanup
subscription.unsubscribe();
```

**9. Initialize Session Handler (in App.jsx)**
```javascript
import { initializeSessionHandler } from '@/utils/sessionHandler';

useEffect(() => {
  const unsubscribe = initializeSessionHandler(
    (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
      }
    },
    (error) => console.error('Auth error:', error)
  );

  return unsubscribe;
}, []);
```

---

## 🔐 Configuration Options

### Email Verification Timing

In `src/utils/authHelpers.js`:

```javascript
// CREATE_PROFILE_ON_SIGNUP = true (default)
// Profile created immediately on signup
// User can access app before email verification
// Risk: Unverified accounts can use app

// CREATE_PROFILE_ON_SIGNUP = false
// Profile created only after email verification
// User must verify email before first login
// More secure, slower onboarding
```

To change:
```javascript
const CREATE_PROFILE_ON_SIGNUP = false; // Change to false for strict verification
```

---

## 📱 Component Usage

### SignupForm

Standalone signup form:
```jsx
import SignupForm from '@/components/SignupForm';

<SignupForm
  onSuccess={(user) => console.log('Signup success:', user)}
  onSwitchToLogin={() => setMode('login')}
/>
```

**Props:**
- `onSuccess(user)` - Called after successful signup
- `onSwitchToLogin()` - Called when user clicks "Log in" link

**Features:**
- Email validation
- Password strength (6+ chars)
- Username availability check
- Real-time validation feedback
- Loading states

### LoginForm

Standalone login form:
```jsx
import LoginForm from '@/components/LoginForm';

<LoginForm
  onSuccess={(user) => console.log('Login success:', user)}
  onSwitchToSignup={() => setMode('signup')}
/>
```

**Props:**
- `onSuccess(user)` - Called after successful login
- `onSwitchToSignup()` - Called when user clicks "Sign up" link

**Features:**
- Email/password validation
- Error messages
- Remember me option (for future use)
- Loading states

### AuthPageNew

Combined auth page with mode switching:
```jsx
import AuthPageNew from '@/components/AuthPageNew';

<AuthPageNew
  onAuthSuccess={(user) => {
    console.log('User authenticated:', user);
    // Redirect to dashboard, etc.
  }}
/>
```

**Props:**
- `onAuthSuccess(user)` - Called after login/signup success

**Features:**
- Toggles between signup and login
- Auto-detects existing sessions
- Beautiful UI
- Full responsive design

---

## 🛡️ Security Best Practices

### 1. Never Expose Service Role Key

✅ Good: Only use ANON_KEY on client
```javascript
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);
```

❌ Bad: Never use service role key on client
```javascript
// DO NOT DO THIS
const supabase = createClient(url, SERVICE_ROLE_KEY);
```

### 2. Validate on Both Client & Server

```javascript
// Client validation (UX)
if (password.length < 6) {
  throw new Error('Password too short');
}

// Server validation (Security)
// Supabase Auth automatically validates all signups/signins
```

### 3. Use HTTPS Always

- Ensure your app uses HTTPS in production
- Supabase requires HTTPS for production apps

### 4. Respect RLS Policies

All database queries automatically enforce RLS:
```javascript
// User can only SELECT their own profile (RLS enforces this)
const { data } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', user.id)
  .single();

// Trying to access another user's profile returns empty (RLS blocks it)
const { data } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', 'other_user_id'); // RLS prevents this
```

### 5. Handle Errors Gracefully

```javascript
const result = await signUpUser(email, password, username);
if (!result.ok) {
  // Show user-friendly error message
  setError(result.error); // Not a technical error, just info
}
```

---

## 🧪 Testing Checklist

### Local Testing

- [ ] Run `npm run dev` (frontend on port 5000)
- [ ] Run `node server.js` (backend on port 3001)
- [ ] Open http://localhost:5000

### Signup Flow
- [ ] Fill signup form with valid email
- [ ] Choose username (test availability check)
- [ ] Submit and see success message
- [ ] Check Supabase dashboard > Authentication > Users (user appears)
- [ ] Check database > profiles table (profile row exists with correct id, email, username)

### Email Verification
- [ ] Check email inbox for verification link
- [ ] Click verification link
- [ ] Email is marked verified in Supabase dashboard

### Login Flow
- [ ] Try login with unverified email (if using strict mode)
- [ ] Verify email
- [ ] Login with correct credentials
- [ ] User redirected to app
- [ ] Can call `getMyProfile()` and get data

### Session Persistence
- [ ] Log in
- [ ] Refresh page (F5)
- [ ] User remains logged in (session restored)
- [ ] Profile data still accessible

### Logout Flow
- [ ] Click logout
- [ ] User redirected to login page
- [ ] Session cleared (calling `getCurrentUser()` returns null)

### Error Handling
- [ ] Signup with existing username → Shows error
- [ ] Signup with weak password → Shows error
- [ ] Login with wrong password → Shows error
- [ ] All errors are user-friendly (not technical jargon)

### RLS Testing
- [ ] Login as user A, can see own profile
- [ ] Login as user B, cannot see user A's profile
- [ ] Profile table blocks cross-user access

---

## 🐛 Troubleshooting

### "Supabase credentials missing in .env"

**Cause:** Environment variables not loaded

**Fix:**
```bash
# 1. Check .env file exists in project root
ls -la .env

# 2. Verify VITE_ variables are set
cat .env | grep VITE_SUPABASE

# 3. Restart dev server
npm run dev
```

### "RLS policy violation: Users cannot insert profile"

**Cause:** RLS policy blocks insert, or wrong user ID

**Fix:**
```javascript
// Ensure you're inserting with correct id = auth.uid()
const user = await getCurrentUser();
const { error } = await supabase
  .from('profiles')
  .insert([{
    id: user.id, // Must match authenticated user
    email: user.email,
    username: username
  }]);
```

### "Duplicate username error"

**Cause:** Username already taken

**Fix:**
```javascript
// Check availability before inserting
const available = await isUsernameAvailable(username);
if (!available) {
  throw new Error('Username already taken');
}
```

### "Email verification email never arrives"

**Cause:** Supabase email not configured, or in spam

**Fix:**
```bash
# 1. Check Supabase dashboard > Email Templates
#    Verify confirmation email template is enabled

# 2. Check spam folder (Gmail, etc.)

# 3. For testing, use Supabase dashboard to view pending confirmations:
#    Authentication > Users > (click user) > User Details
```

### "Cannot login after email verification"

**Cause:** Session not restored, or profile not created

**Fix:**
```javascript
// Ensure CREATE_PROFILE_ON_SIGNUP config is correct
// If using post-verification creation, call ensureProfile after login:

const result = await signInUser(email, password);
if (result.ok) {
  await ensureProfile(result.user);
}
```

### "Profile returns null even though user is logged in"

**Cause:** Profile not created, or RLS blocking SELECT

**Fix:**
```javascript
// 1. Check if profile exists
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', user.id)
  .single();

if (error && error.code === 'PGRST116') {
  // Profile not found, create it
  await ensureProfile(user);
}

// 2. Check RLS policies in Supabase dashboard
// Ensure profiles_select_own policy exists
```

### "Cannot signup: Email already exists"

**Cause:** Account already registered with that email

**Fix:**
```javascript
// User should:
// 1. Try login instead
// 2. Use password reset if forgot password
// Or use different email for new account
```

### "Session lost after page refresh"

**Cause:** Auth state listener not set up properly

**Fix:**
```javascript
// In App.jsx, ensure this runs on mount:
useEffect(() => {
  const unsubscribe = initializeSessionHandler(
    (user) => setCurrentUser(user),
    (error) => console.error(error)
  );
  return unsubscribe;
}, []);
```

---

## 📚 File Structure

```
src/
├── components/
│   ├── AuthPageNew.jsx          ← Main auth page (signup + login)
│   ├── SignupForm.jsx            ← Signup form component
│   ├── LoginForm.jsx             ← Login form component
│   └── AuthPage.jsx              ← (old, can be replaced)
├── utils/
│   ├── supabase.js               ← Supabase client initialization
│   ├── authHelpers.js            ← Core auth functions
│   └── sessionHandler.js         ← Session management
├── styles/
│   └── AuthForms.css             ← Auth form styling
└── App.jsx                       ← (update imports here)
```

---

## 🚀 Production Checklist

Before deploying to production:

- [ ] Remove console.log statements
- [ ] Test all error scenarios
- [ ] Set up email templates in Supabase
- [ ] Enable RLS on all tables (already done)
- [ ] Use environment variables for secrets
- [ ] Set up CORS properly if using separate domain
- [ ] Test on mobile browsers
- [ ] Verify email verification flow works
- [ ] Set up password reset flow
- [ ] Add terms of service acceptance
- [ ] Add privacy policy link
- [ ] Set up analytics/logging
- [ ] Configure rate limiting (Supabase default: 5 requests/sec per IP)

---

## 🔗 Useful Links

- **Supabase Docs:** https://supabase.com/docs
- **Auth Guide:** https://supabase.com/docs/guides/auth
- **JavaScript Reference:** https://supabase.com/docs/reference/javascript/introduction
- **Row Level Security:** https://supabase.com/docs/guides/auth/row-level-security

---

**Ready to integrate!** Copy the files above into your project and follow the integration steps.
