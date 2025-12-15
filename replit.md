# Agent Pippy

## Architecture Overview

Agent Pippy is a production-ready AI trading assistant with a **website-first architecture**:

- **Static Frontend**: React + Vite (deployed to CDN)
- **Serverless Backend**: Cloudflare Workers Functions
- **No Express server** - runs 24/7 without local runtime dependency

### Deployment Target
- **Cloudflare Pages** with Functions
- Static frontend + serverless API endpoints

---

## Quick Setup (2 minutes)

### For Cloudflare Pages Deployment:

1. Connect GitHub repository to Cloudflare Pages
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Add environment variables:
   - `GROQ_API_KEY` - https://console.groq.com/keys
   - `ALPHA_VANTAGE_API_KEY` - https://www.alphavantage.co/support/#api-key

### For Replit Development:

1. Click the **Secrets** tab (lock icon)
2. Add these API keys:

| Secret Name | Where to Get It |
|------------|-----------------|
| `GROQ_API_KEY` | https://console.groq.com/keys |
| `ALPHA_VANTAGE_API_KEY` | https://www.alphavantage.co/support/#api-key |

3. Supabase is already configured for authentication

---

## Key Features

- **AI Market Intelligence**: Deep market analysis using Groq AI
- **Real-Time Stock Data**: Alpha Vantage integration for live prices
- **Market News**: Latest news affecting your trading pairs
- **3 Trading Pairs**: US30, NAS100, SPX500
- **Secure Authentication**: Supabase Auth integration

---

## Market Intelligence Cycle

The core AI system follows a 6-step deterministic cycle:

1. **Context Lock**: Lock analysis to selected instrument (US30/NAS100/SPX500)
2. **Data Ingestion**: Fetch structured data (price, breadth, session context)
3. **Signal Normalization**: Convert raw data to normalized signals:
   - Breadth: Strong / Mixed / Weak
   - Structure: Bullish / Neutral / Bearish
   - Volatility: Low / Normal / High
   - Macro: Risk-on / Risk-off / Neutral
4. **AI Reasoning**: Groq AI analyzes normalized signals (single model)
5. **Decision Output**: Structured JSON output with bias, confidence, drivers, levels
6. **UI Rendering**: Frontend renders JSON response

---

## Project Structure

```
/src                    # React frontend
  /components           # UI components
  /services             # API service clients
  /styles               # CSS styles
  /utils                # Utility functions
/functions              # Serverless API functions
  /api
    analyze.js          # Market intelligence endpoint
    market-data.js      # Stock data endpoint
    news.js             # News endpoint
    chat.js             # AI chat endpoint
/dist                   # Build output (static files)
```

---

## API Endpoints

All APIs are serverless functions at `/api/*`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analyze?instrument=US30` | GET | Full market intelligence analysis |
| `/api/market-data?instrument=US30` | GET | Stock prices and market data |
| `/api/news?instrument=US30` | GET | Latest news |
| `/api/chat` | POST | AI chat responses |

---

## Tech Stack

- **Frontend**: React 19 + Vite 7
- **Auth**: Supabase
- **AI**: Groq (Llama 3.1 70B)
- **Market Data**: Alpha Vantage
- **Deployment**: Cloudflare Pages + Functions

---

## Running Locally

```bash
# Install dependencies
npm install

# Development server (port 5000)
npm run dev

# Production build
npm run build
```

---

## Environment Variables

See `ENVIRONMENT_VARIABLES.md` for complete documentation.

### Required for Production:
- `GROQ_API_KEY` - Groq AI API key
- `ALPHA_VANTAGE_API_KEY` - Market data API key

---

## UI Components

- **Chat**: AI-powered trading assistant
- **Screener**: Real-time stock prices
- **Map**: Market heatmap visualization
- **Sectors**: Sector performance
- **Insider**: Insider trading data
- **News**: Latest market news
- **Planner**: AI trading plan generator

---

## Security

- API keys are **NEVER** in frontend code
- All API calls go through serverless functions
- Environment variables only accessible server-side
- Supabase handles authentication securely
