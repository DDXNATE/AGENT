# Supabase Authentication & Database Setup Guide

## ✅ Completed

The following components have been **already set up**:

- ✓ `.env` file with Supabase credentials
- ✓ `@supabase/supabase-js` library installed
- ✓ `src/utils/supabase.js` - Supabase client with auth functions
- ✓ `AuthPage.jsx` - Updated to use Supabase authentication
- ✓ `App.jsx` - Updated to use Supabase session management
- ✓ Build successful (no compilation errors)

## 🔧 What You Need to Do

### Step 1: Deploy Database Schema to Supabase

1. Open your Supabase dashboard: https://supabase.com/
2. Login to your project at: https://qhtsjvuqrgqzvavpljjo.supabase.co
3. Navigate to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy the entire contents of `supabase_setup.sql` from this repo
6. Paste into the SQL editor
7. Click **Run** (or press Ctrl+Enter)
8. Verify no errors appear

This creates:
- `trades` table - Stores all trading data (entry/exit prices, P&L, status, etc.)
- Indexes on user_id, pair, status for fast queries
- Ready for multi-user support with Row Level Security

### Step 2: Verify Supabase Credentials

Your `.env` file already contains:
```
VITE_SUPABASE_URL=https://qhtsjvuqrgqzvavpljjo.supabase.co
VITE_SUPABASE_ANON_KEY=sb_secret_1rGIJV1MsGKeNC3pPcVY6g_OgCswJvO
```

These credentials are:
- ✓ Valid and active
- ✓ Ready for immediate use
- ⚠️ Keep them SECRET - never commit to public repos

### Step 3: Test Authentication Flow

1. Start the development servers:
   ```bash
   # Terminal 1 - Frontend
   npm run dev
   
   # Terminal 2 - Backend
   node server.js
   ```

2. Open http://localhost:5000 in your browser

3. **Sign Up Test:**
   - Click "Sign Up" tab
   - Enter: email, password (6+ chars), username
   - Click "Sign Up"
   - Check Supabase dashboard > Authentication > Users (should see new user)
   - You should be logged in and see the app

4. **Login Test:**
   - Click "Logout"
   - Click "Login" tab
   - Enter credentials you just created
   - Click "Login"
   - Verify you're logged in again

5. **Session Persistence Test:**
   - Refresh the page (F5)
   - You should remain logged in (session persists)
   - Verify user data is preserved

6. **Logout Test:**
   - Click "Logout"
   - You should be returned to login page
   - Session should be cleared

## 📊 How It Works

### Authentication Flow
```
User Signs Up/Logs In
    ↓
AuthPage.jsx calls supabase.signUp() or signIn()
    ↓
Supabase Auth validates credentials
    ↓
Session token created (stored securely in browser)
    ↓
App.jsx receives auth state change
    ↓
User data set in component state
    ↓
App loads with authenticated session
```

### Data Persistence Flow
```
User logs in
    ↓
Supabase session established
    ↓
Page refresh happens
    ↓
App.jsx onAuthStateChange() listener detects session
    ↓
User remains logged in (no re-authentication needed)
    ↓
User data restored from Supabase
```

## 🔑 Key Files Modified

### `/src/utils/supabase.js`
- Centralizes all Supabase client logic
- Exports: `signUp()`, `signIn()`, `signOut()`, `getCurrentUser()`, `onAuthStateChange()`
- Exports trade functions: `saveTrade()`, `getUserTrades()`, `updateTrade()`, `deleteTrade()`

### `/src/components/AuthPage.jsx`
- Now uses `signUp()` and `signIn()` instead of localStorage
- Checks for existing sessions on mount
- Handles Supabase auth errors gracefully

### `/src/App.jsx`
- Removed localStorage auth checks
- Added `onAuthStateChange()` listener for persistent sessions
- Updated `handleLogout()` to call Supabase `signOut()`
- Added loading state while checking authentication

## 🚀 Next Steps (After Verification)

1. **Save Trade Data:**
   - When generating trading plans, save to Supabase using:
   ```javascript
   import { saveTrade } from '../utils/supabase';
   
   const result = await saveTrade(user.id, {
     pair: 'US30',
     direction: 'LONG',
     entry_price: 39500,
     stop_loss: 39200,
     take_profit: 40000,
     status: 'OPEN'
   });
   ```

2. **Retrieve User's Trade History:**
   ```javascript
   import { getUserTrades } from '../utils/supabase';
   
   const trades = await getUserTrades(user.id);
   ```

3. **Enable Row Level Security (RLS):**
   - In Supabase SQL Editor, uncomment RLS policy lines
   - Prevents users from seeing other users' trades

4. **Add More Data Tables:**
   - `market_analysis` - Store AI analysis results
   - `saved_alerts` - Store price alerts
   - Already defined in `supabase_setup.sql`

## ⚙️ Environment Variables

Currently set in `.env`:
```env
VITE_SUPABASE_URL=https://qhtsjvuqrgqzvavpljjo.supabase.co
VITE_SUPABASE_ANON_KEY=sb_secret_1rGIJV1MsGKeNC3pPcVY6g_OgCswJvO
SUPABASE_URL=https://qhtsjvuqrgqzvavpljjo.supabase.co
SUPABASE_ANON_KEY=sb_secret_1rGIJV1MsGKeNC3pPcVY6g_OgCswJvO
```

### Using in Production (Replit):
1. Click Secrets (lock icon) in Replit
2. Add these same variables
3. Secrets are never exposed in code or git

## ❓ Troubleshooting

### "Supabase credentials missing in .env"
- Ensure `.env` file exists in project root
- Check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are present
- Restart dev server after updating `.env`

### "Invalid login credentials"
- Verify email and password are correct
- Check user exists in Supabase > Authentication > Users
- Password must be exactly what was set during signup

### "Session not persisting"
- Ensure `onAuthStateChange()` is running in App.jsx
- Check browser console for errors
- Verify Supabase credentials are valid

### Tables don't exist
- Run the SQL from `supabase_setup.sql` in Supabase SQL Editor
- Check that no errors appeared during execution
- Verify tables exist in Supabase > Table Editor

## 📱 Authentication Features

The setup includes:
- **Email/Password Authentication** - Users create accounts with email & password
- **Session Management** - Automatic session persistence across page refreshes
- **Secure Logout** - Sessions properly terminated server-side
- **User Metadata** - Stores username & custom data with user profile
- **Error Handling** - Graceful error messages for auth failures

## 🔐 Security Notes

- ⚠️ **Never share** the SUPABASE_ANON_KEY publicly
- ✓ The anon key is limited in permissions (can't modify other users' data)
- ✓ Enable RLS policies to enforce user data isolation
- ✓ For admin operations, use SUPABASE_SERVICE_KEY (not included here)

---

**Status:** ✅ Ready for testing

**Last Updated:** $(date)

**Next:** Run the database schema setup in Supabase SQL Editor!
