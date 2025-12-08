# Agent Pippy

## Overview
Agent Pippy is an AI-powered trading assistant using a Chain of Debate (CoD) multi-AI architecture. It specializes in analyzing SPX 500, NAS 100, and US30 indices with real-time stock data, news integration, and chart analysis capabilities.

## Key Features
- **Chart Upload & Analysis**: Upload trading charts (15m, 1hr, 4hr, daily) for AI analysis
- **Real-Time Stock Screener**: Live prices for major stocks driving index movements
- **Market News Integration**: Latest news affecting your trading pairs
- **Chain of Debate AI**: Multi-AI architecture for comprehensive analysis
- **3 Trading Pairs**: US30, NAS100, SPX500

## Chain of Debate (CoD) System

### Process Flow:
1. **User Input** → Query received through chat interface
2. **AI1 + AI2 (Parallel)** → Gemini and Groq analyze query simultaneously
3. **Synthesis (Gemini)** → Combines both perspectives into unified analysis
4. **Final Refinement (Groq)** → Polishes and delivers the final answer

The system automatically includes uploaded chart context and real-time market data when analyzing queries.

## Project Structure
- `server.js` - Express backend with multi-AI, stock data, news, and chart upload APIs
- `src/App.jsx` - Main React dashboard with Chat, Charts, Screener, and News tabs
- `src/App.css` - Ice blue theme styling
- `src/index.css` - Global CSS variables and base styles
- `uploads/` - Stored chart images organized by pair and timeframe
- `vite.config.js` - Vite configuration with proxy to backend

## Tech Stack
- **Frontend**: React + Vite
- **Backend**: Express.js with Multer for file uploads
- **AI Models**: 
  - Gemini 2.5 Flash (Google)
  - Llama 3.1 8B Instant (Groq)
- **Market Data**: Finnhub API (real-time quotes and news)
- **Theme**: Custom Ice Blue color palette

## Color Palette
- Frost Glow Blue: #4DBBFF
- Neon Sky Blue: #77D4FF
- Misty Light Blue: #D2F2FF
- Frost White: #F3FAFF
- Deep Ice Base: #002B40

## Running the Project
The project uses a concurrent setup:
- Frontend runs on port 5000 (Vite dev server)
- Backend runs on port 3001 (Express API server)

Start with: `npm run dev`

## Environment Variables & Secrets

### Required API Keys
Store these in Replit Secrets (lock icon in left panel):
- `GEMINI_API_KEY` - Google Gemini AI (https://aistudio.google.com/apikey)
- `GROQ_API_KEY` - Groq AI (https://console.groq.com/keys)
- `FINNHUB_API_KEY` - Real-time stock data (https://finnhub.io/)
- `ALPHA_VANTAGE_API_KEY` - Financial data (https://www.alphavantage.co/support/#api-key)

### Why Secrets Persist Through GitHub Updates
Replit Secrets are stored separately from your code in Replit's secure vault. When you:
- Pull updates from GitHub
- Import/fork the repository again
- Reset or rollback your code

Your secrets remain intact because they are tied to your Replit account/project, NOT to the code files. GitHub never sees your secrets - they only exist in Replit's encrypted storage.

### Setup for New Users
1. Import this repository into Replit
2. Click the "Secrets" tab (lock icon) in the left panel
3. Add your API keys (see `.env.example` for reference)
4. Run the project - the environment check will confirm your keys are loaded

### Files for Secret Management
- `config/env.js` - Centralized environment validation and status checking
- `.env.example` - Template showing required variables (safe to commit)
- `.gitignore` - Includes `.env` to prevent accidental commits

## API Endpoints

### Chat
- `POST /api/chat` - Send a message through the Chain of Debate system
  - Body: `{ message: string }`
  - Response: `{ reply: string }`

### Charts
- `POST /api/upload-chart` - Upload a chart image
  - Body: FormData with `chart` (file), `pair`, `timeframe`
- `GET /api/charts/:pair` - Get all charts for a trading pair
- `GET /api/charts` - Get all uploaded charts

### Stocks
- `GET /api/stocks/:pair` - Get real-time quotes for major stocks in a pair
- `GET /api/trading-pairs` - Get list of available trading pairs

### News
- `GET /api/news/:pair` - Get latest news for stocks in a trading pair
- `GET /api/market-news` - Get general market news

## Data Accuracy Features
- **Quote Validation**: All stock data validated for valid OHLC values and proper formatting
- **Smart Caching**: 30-second cache with stale data fallback prevents rate limiting
- **Retry Logic**: Up to 3 retries with exponential backoff for failed API requests
- **Market Hours Detection**: Real-time market status (open, pre-market, after-hours, closed)
- **Data Quality Indicators**: 
  - Per-stock status: live, cached, or stale
  - Overall quality: excellent, good, or degraded
- **Auto-Refresh**: Optional 30-second auto-refresh with toggle control

## User Preferences
- Trading focus: SPX 500, NAS 100, US30
- Chart timeframes: 15m, 1hr, 4hr, daily
- Real-time data priority
- Data accuracy with freshness indicators
