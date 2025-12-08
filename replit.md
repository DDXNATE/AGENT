# Agent Pippy

## Overview
Agent Pippy is an AI-powered trading assistant using a Chain of Debate (CoD) multi-AI architecture. It specializes in analyzing SPX 500, NAS 100, and US30 indices with real-time stock data, news integration, and chart analysis capabilities.

## Key Features
- **Chart Upload & Analysis**: Upload trading charts (15m, 1hr, 4hr, daily) for AI analysis
- **Real-Time Stock Screener**: Live prices for major stocks driving index movements
- **Market News Integration**: Latest news affecting your trading pairs
- **Chain of Debate AI**: Multi-AI architecture for comprehensive analysis
- **AI Trade Journaling**: Tell Pippy to log trades via chat - automatically parses pair, direction, P&L
- **Trade Journal**: Full trade tracking with stats, win rate, P&L tracking, and edit capabilities
- **AI Trading Planner**: Comprehensive daily trading plan combining charts, stocks, news & economic calendar
- **Economic Calendar**: Live red/orange folder high-impact news from Forex Factory
- **3 Trading Pairs**: US30, NAS100, SPX500

## AI Trade Journaling (NEW)

### How to Use:
Simply tell Pippy in the chat to log your trades. Examples:
- "Log my US30 long, made $150"
- "Journal: NAS100 short, lost $80"
- "Took a trade on SPX500 long, entry 5800, exit 5850, profit $200"
- "Update trade #1 pnl to $300"

### Features:
- **Auto-parsing**: AI extracts pair, direction, P&L, entry/exit prices from natural language
- **Edit trades**: Update P&L, status, or any field via chat or manual edit button
- **Quick Log**: Fast P&L-only logging via the "Quick Log (P&L)" button
- **Full Entry**: Detailed trade entry with all fields (entry, exit, SL, TP, position size, notes)
- **Stats Dashboard**: Win rate, total P&L, average win/loss, current streak

## Chain of Debate (CoD) System

### Process Flow:
1. **User Input** → Query received through chat interface
2. **AI1 + AI2 (Parallel)** → Gemini and Groq analyze query simultaneously
3. **Synthesis (Gemini)** → Combines both perspectives into unified analysis
4. **Final Refinement (Groq)** → Polishes and delivers the final answer

The system automatically includes uploaded chart context and real-time market data when analyzing queries.

## AI Trading Planner (NEW)

### Overview:
The Planner is an intelligent trading plan generator that synthesizes multiple data sources to create a comprehensive daily trading plan. It combines:
1. **Chart Analysis**: Technical analysis of your uploaded charts
2. **Stock Trends**: Performance of major component stocks
3. **Market News**: Recent news affecting the markets
4. **Economic Calendar**: High-impact (red folder) and medium-impact (orange folder) events from Forex Factory

### How to Use:
1. Go to the **Planner** tab
2. Upload your charts first (optional but recommended)
3. Click "Generate Today's Plan"
4. Wait 10-30 seconds for the AI to analyze all data sources
5. Review your personalized trading plan with entry/exit levels, risk warnings, and session timing

### Plan Output Includes:
- **Overall Bias**: BULLISH / BEARISH / NEUTRAL
- **Confidence Level**: LOW / MEDIUM / HIGH
- **Key Factors**: Technical, sentiment, fundamentals, events summary
- **Action Plan**: Primary direction, entry zone, stop loss, take profit levels
- **Risk Warnings**: Events that could invalidate the plan
- **Session Timing**: Best times to trade based on events

### Economic Calendar Features:
- Live data from Forex Factory
- Filters for HIGH (red folder) and MEDIUM (orange folder) impact events
- Today's events and upcoming week events
- Forecast vs previous values displayed

## AI Vision Chart Analysis (NEW)

### Technical Analysis Capabilities:
- **Candlestick Pattern Recognition**: Doji, engulfing, hammer, shooting star, morning/evening star
- **Support/Resistance Identification**: Key price levels with specific prices
- **Trend Analysis**: Higher highs/lows, lower highs/lows detection
- **Chart Pattern Recognition**: Head & shoulders, double top/bottom, triangles, flags, wedges
- **Indicator Reading**: RSI, MACD, MAs, Bollinger Bands when visible
- **Volume Analysis**: Volume trends and momentum indicators
- **Fibonacci Levels**: Retracement level identification

### Analysis Types:
- **Full Analysis**: Comprehensive multi-factor technical analysis with entry/SL/TP levels
- **Quick Analysis**: Rapid 5-point scan (trend, levels, pattern, bias, entry/stop)

### Optimizations:
- **5-minute analysis caching**: Prevents redundant API calls for same charts
- **Parallel processing**: Multiple timeframes analyzed simultaneously
- **Smart context injection**: Chart analysis results automatically included in chat responses

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
  - Body: `{ message: string, pair?: string }`
  - Response: `{ reply: string }`

### Charts & AI Analysis
- `POST /api/upload-chart` - Upload a chart image
  - Body: FormData with `chart` (file), `pair`, `timeframe`
- `GET /api/charts/:pair` - Get all charts for a trading pair
- `GET /api/charts` - Get all uploaded charts
- `POST /api/analyze-chart` - Full AI vision analysis of uploaded charts
  - Body: `{ pair: string, timeframe?: string }`
  - Response: `{ success: boolean, analyses: [...], meta: { processingTimeMs, chartsAnalyzed } }`
- `POST /api/quick-analysis` - Fast AI scan of a specific chart
  - Body: `{ pair: string, timeframe: string }`
  - Response: `{ success: boolean, analysis: string, processingTimeMs }`

### Stocks
- `GET /api/stocks/:pair` - Get real-time quotes for major stocks in a pair
- `GET /api/trading-pairs` - Get list of available trading pairs

### News
- `GET /api/news/:pair` - Get latest news for stocks in a trading pair
- `GET /api/market-news` - Get general market news

### Planner & Economic Calendar
- `GET /api/economic-calendar` - Get high-impact economic events from Forex Factory
  - Response: `{ today: [...], upcoming: [...], allHighImpact: [...], lastUpdated }`
- `POST /api/planner/generate` - Generate AI trading plan for a pair
  - Body: `{ pair: string }`
  - Response: `{ success, pair, plan, dataSources, economicEvents, meta }`
- `GET /api/planner/status/:pair` - Check planner data sources status
  - Response: `{ pair, status: { charts, geminiAI, finnhub }, requirements }`

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
