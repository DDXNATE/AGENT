# 🚀 Supabase Setup - Quick Start

## Status: ✅ Code Complete, ⏳ Database Setup Pending

---

## What's Done

✅ Supabase credentials in `.env`
✅ `@supabase/supabase-js` library installed
✅ `src/utils/supabase.js` - Auth & trade functions ready
✅ `AuthPage.jsx` - Signup/login with Supabase
✅ `App.jsx` - Session persistence via Supabase
✅ Build successful - No errors

---

## What You Need to Do (5 minutes)

### 1. Deploy Database Schema

1. Go to: https://qhtsjvuqrgqzvavpljjo.supabase.co
2. Login to your Supabase account
3. Click **SQL Editor** in left sidebar
4. Click **New Query**
5. Open file: `supabase_setup.sql` in this repo
6. Copy ALL the SQL code
7. Paste into Supabase SQL editor
8. Click **Run** button
9. Wait for ✓ Success message

### 2. Test Authentication

1. Run frontend: `npm run dev` (port 5000)
2. Run backend: `node server.js` (port 3001)
3. Open http://localhost:5000

**Test Signup:**
- Click "Sign Up" tab
- Enter: email, password (6+ chars), username
- Click "Sign Up"
- ✓ Should log you in automatically

**Test Login:**
- Click "Logout"
- Click "Login" tab
- Enter same email & password
- Click "Login"
- ✓ Should log you in

**Test Session Persistence:**
- Refresh the page (F5)
- ✓ Should still be logged in

**Test Logout:**
- Click "Logout"
- ✓ Should return to login page

---

## Your Supabase Project

- **URL:** https://qhtsjvuqrgqzvavpljjo.supabase.co
- **Status:** ✅ Active
- **Tables:** trades (pending setup)
- **Users:** Will appear after signup

---

## File Locations

| What | Where |
|------|-------|
| Supabase client | `/src/utils/supabase.js` |
| Login/Signup form | `/src/components/AuthPage.jsx` |
| App auth logic | `/src/App.jsx` |
| Database schema | `supabase_setup.sql` |
| Setup instructions | `SUPABASE_SETUP_GUIDE.md` |
| Changes summary | `SUPABASE_CHANGES.md` |

---

## Key Functions Available

### Authentication
```javascript
import { signUp, signIn, signOut, getCurrentUser } from '../utils/supabase';

// Sign up new user
const result = await signUp('user@example.com', 'password123', 'username');

// Log in
const result = await signIn('user@example.com', 'password123');

// Log out
await signOut();

// Get current user
const user = await getCurrentUser();
```

### Trade Data
```javascript
import { saveTrade, getUserTrades, updateTrade, deleteTrade } from '../utils/supabase';

// Save a trade
await saveTrade(user.id, {
  pair: 'US30',
  direction: 'LONG',
  entry_price: 39500,
  status: 'OPEN'
});

// Get user's trades
const trades = await getUserTrades(user.id);

// Update trade
await updateTrade(tradeId, { status: 'WIN', exit_price: 40000 });

// Delete trade
await deleteTrade(tradeId);
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Supabase credentials missing" | Ensure `.env` exists and has credentials |
| "Database error" | Run SQL from `supabase_setup.sql` in Supabase |
| "Auth not working" | Restart dev servers after .env changes |
| "Session not persisting" | Check browser console for errors |

---

## Next Steps (After Testing)

1. Create a trades journal UI to display user's trades
2. Wire up trading plan generator to save trades
3. Add trade filters (pair, status, date range)
4. Implement trade statistics dashboard
5. Enable RLS policies for multi-user isolation

---

**Ready to go! Start with Step 1 above.** 🎯
