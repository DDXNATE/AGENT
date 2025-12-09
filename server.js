import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';
import { checkEnvironment, getEnvStatus } from './config/env.js';
import { initDatabase, createTrade, closeTrade, getTrades, getTradeStats, deleteTrade, updateTrade } from './config/database.js';
import { setupAuth, isAuthenticated } from './server/replitAuth.js';

checkEnvironment();

initDatabase().catch(err => console.error('Database init failed:', err));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

async function initAuth() {
  try {
    await setupAuth(app);
    console.log('✓ Authentication initialized');
  } catch (error) {
    console.error('Auth initialization error:', error);
  }
}

initAuth();

if (fs.existsSync(path.join(__dirname, 'dist'))) {
  app.use(express.static(path.join(__dirname, 'dist')));
}

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_PAIRS = ['US30', 'NAS100', 'SPX500'];
const ALLOWED_TIMEFRAMES = ['15m', '1hr', '4hr', 'daily'];

const upload = multer({ 
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.use('/uploads', express.static(uploadsDir));

let geminiAI = null;
let groqAI = null;

if (process.env.GEMINI_API_KEY) {
  geminiAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

if (process.env.GROQ_API_KEY) {
  groqAI = new Groq({ apiKey: process.env.GROQ_API_KEY });
}

const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

const TRADING_PAIRS = {
  'US30': {
    name: 'Dow Jones Industrial Average (US30)',
    symbol: 'DJI',
    finnhubSymbol: '^DJI',
    majorStocks: [
      { symbol: 'AAPL', name: 'Apple Inc.' },
      { symbol: 'MSFT', name: 'Microsoft Corp.' },
      { symbol: 'UNH', name: 'UnitedHealth Group' },
      { symbol: 'GS', name: 'Goldman Sachs' },
      { symbol: 'HD', name: 'Home Depot' },
      { symbol: 'MCD', name: "McDonald's" },
      { symbol: 'CAT', name: 'Caterpillar' },
      { symbol: 'AMGN', name: 'Amgen' },
      { symbol: 'V', name: 'Visa' },
      { symbol: 'BA', name: 'Boeing' }
    ]
  },
  'NAS100': {
    name: 'NASDAQ 100 (NAS100)',
    symbol: 'NDX',
    finnhubSymbol: '^NDX',
    majorStocks: [
      { symbol: 'AAPL', name: 'Apple Inc.' },
      { symbol: 'MSFT', name: 'Microsoft Corp.' },
      { symbol: 'NVDA', name: 'NVIDIA Corp.' },
      { symbol: 'AMZN', name: 'Amazon.com' },
      { symbol: 'META', name: 'Meta Platforms' },
      { symbol: 'GOOGL', name: 'Alphabet Inc.' },
      { symbol: 'TSLA', name: 'Tesla Inc.' },
      { symbol: 'AVGO', name: 'Broadcom Inc.' },
      { symbol: 'COST', name: 'Costco' },
      { symbol: 'NFLX', name: 'Netflix' }
    ]
  },
  'SPX500': {
    name: 'S&P 500 (SPX500)',
    symbol: 'SPX',
    finnhubSymbol: '^GSPC',
    majorStocks: [
      { symbol: 'AAPL', name: 'Apple Inc.' },
      { symbol: 'MSFT', name: 'Microsoft Corp.' },
      { symbol: 'NVDA', name: 'NVIDIA Corp.' },
      { symbol: 'AMZN', name: 'Amazon.com' },
      { symbol: 'META', name: 'Meta Platforms' },
      { symbol: 'GOOGL', name: 'Alphabet Inc.' },
      { symbol: 'BRK.B', name: 'Berkshire Hathaway' },
      { symbol: 'JPM', name: 'JPMorgan Chase' },
      { symbol: 'LLY', name: 'Eli Lilly' },
      { symbol: 'XOM', name: 'Exxon Mobil' }
    ]
  }
};

const chartStorage = {};

const stockCache = new Map();
const CACHE_TTL = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

function isMarketOpen() {
  const now = new Date();
  const nyTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = nyTime.getDay();
  const hours = nyTime.getHours();
  const minutes = nyTime.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  
  if (day === 0 || day === 6) return false;
  
  const marketOpen = 9 * 60 + 30;
  const marketClose = 16 * 60;
  
  return timeInMinutes >= marketOpen && timeInMinutes < marketClose;
}

function getMarketStatus() {
  const now = new Date();
  const nyTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = nyTime.getDay();
  const hours = nyTime.getHours();
  const minutes = nyTime.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  
  if (day === 0) {
    return { isOpen: false, status: 'Weekend - Market Closed', nextOpen: 'Monday 9:30 AM ET' };
  }
  
  if (day === 6) {
    return { isOpen: false, status: 'Weekend - Market Closed', nextOpen: 'Monday 9:30 AM ET' };
  }
  
  const marketOpen = 9 * 60 + 30;
  const marketClose = 16 * 60;
  const preMarketOpen = 4 * 60;
  const afterHoursClose = 20 * 60;
  
  const isFriday = day === 5;
  const nextOpenDay = isFriday ? 'Monday' : 'Tomorrow';
  
  if (timeInMinutes >= marketOpen && timeInMinutes < marketClose) {
    return { isOpen: true, status: 'Market Open', nextClose: '4:00 PM ET' };
  } else if (timeInMinutes >= preMarketOpen && timeInMinutes < marketOpen) {
    return { isOpen: false, status: 'Pre-Market', nextOpen: '9:30 AM ET' };
  } else if (timeInMinutes >= marketClose && timeInMinutes < afterHoursClose) {
    return { isOpen: false, status: 'After Hours', nextOpen: `${nextOpenDay} 9:30 AM ET` };
  } else {
    if (isFriday && timeInMinutes >= afterHoursClose) {
      return { isOpen: false, status: 'Market Closed', nextOpen: 'Monday 9:30 AM ET' };
    }
    return { isOpen: false, status: 'Market Closed', nextOpen: '9:30 AM ET' };
  }
}

function validateQuoteData(data) {
  if (!data || typeof data !== 'object') return null;
  
  const requiredFields = ['c', 'h', 'l', 'o', 'pc'];
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || data[field] === 0) {
      return null;
    }
  }
  
  if (data.c <= 0 || data.h < data.l) return null;
  
  return data;
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const SYSTEM_PROMPT = `You are Pippy, an expert AI trading analyst specializing in US30, NAS100, SPX500 technical analysis.

CORE EXPERTISE:
- Candlestick pattern recognition (doji, engulfing, hammer, shooting star, morning/evening star)
- Support/Resistance level identification
- Trend analysis (higher highs/lows, lower highs/lows)
- Chart pattern recognition (head & shoulders, double top/bottom, triangles, flags)
- Volume analysis and momentum indicators
- Fibonacci retracement levels
- Moving average analysis (20/50/100/200 EMA/SMA)

RESPONSE RULES:
- Be PRECISE and ACTIONABLE. No fluff.
- Max 2-3 short paragraphs unless asked for detail.
- Always provide specific price levels when possible.
- For stock data: ALWAYS use markdown tables.
- Give clear directional bias with reasoning.

FORMAT FOR CHART ANALYSIS:
**Trend:** [Bullish/Bearish/Neutral] - [reason]
**Key Levels:**
- Resistance: [price]
- Support: [price]
**Patterns:** [identified patterns]
**Bias:** [Long/Short/Wait] with [confidence %]
**Entry/SL/TP:** [specific levels if applicable]

Never say "Let me explain" - just deliver the analysis.`;

const CHART_ANALYSIS_PROMPT = `You are an expert technical analyst. Analyze this trading chart image with extreme precision.

REQUIRED ANALYSIS:
1. **Timeframe Assessment:** Identify the chart timeframe and context
2. **Trend Direction:** Current trend (bullish/bearish/ranging) with evidence
3. **Candlestick Patterns:** Identify any significant patterns (doji, engulfing, hammer, etc.)
4. **Support/Resistance:** Mark key price levels visible on the chart
5. **Chart Patterns:** Any formations (triangles, H&S, double tops, flags, wedges)
6. **Indicator Readings:** If visible (RSI, MACD, MAs, Bollinger Bands)
7. **Volume Analysis:** Volume trends if visible
8. **Trade Setup:** Specific entry, stop loss, and take profit levels
9. **Risk Assessment:** Confidence level and risk/reward ratio

Be SPECIFIC with price levels. Give exact numbers when visible.
Provide a clear BIAS: LONG, SHORT, or WAIT.`;

const FAST_ANALYSIS_PROMPT = `Quick technical analysis - be direct:
1. Trend direction
2. Key support/resistance levels (specific prices)
3. Current pattern forming
4. Trade bias (Long/Short/Wait)
5. Suggested entry & stop loss

Max 100 words. No intro. Just analysis.`;

async function fetchStockQuote(symbol, retryCount = 0) {
  const cacheKey = `quote_${symbol}`;
  const cached = stockCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL) {
    return { ...cached.data, fromCache: true, cacheAge: Date.now() - cached.fetchedAt };
  }
  
  try {
    const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`);
    
    if (!response.ok) {
      if (response.status === 429 && retryCount < MAX_RETRIES) {
        await delay(RETRY_DELAY * (retryCount + 1));
        return fetchStockQuote(symbol, retryCount + 1);
      }
      throw new Error(`API returned ${response.status}`);
    }
    
    const data = await response.json();
    const validatedData = validateQuoteData(data);
    
    if (!validatedData) {
      console.warn(`Invalid data received for ${symbol}:`, data);
      if (cached) {
        return { ...cached.data, fromCache: true, stale: true, cacheAge: Date.now() - cached.fetchedAt };
      }
      return null;
    }
    
    const quoteData = {
      symbol,
      currentPrice: parseFloat(validatedData.c.toFixed(2)),
      change: parseFloat((validatedData.d || 0).toFixed(2)),
      percentChange: parseFloat((validatedData.dp || 0).toFixed(2)),
      high: parseFloat(validatedData.h.toFixed(2)),
      low: parseFloat(validatedData.l.toFixed(2)),
      open: parseFloat(validatedData.o.toFixed(2)),
      previousClose: parseFloat(validatedData.pc.toFixed(2)),
      timestamp: validatedData.t,
      fetchedAt: Date.now(),
      marketStatus: getMarketStatus(),
      fromCache: false
    };
    
    stockCache.set(cacheKey, { data: quoteData, fetchedAt: Date.now() });
    
    return quoteData;
  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error.message);
    
    if (retryCount < MAX_RETRIES) {
      await delay(RETRY_DELAY * (retryCount + 1));
      return fetchStockQuote(symbol, retryCount + 1);
    }
    
    if (cached) {
      return { ...cached.data, fromCache: true, stale: true, error: error.message };
    }
    
    return null;
  }
}

async function fetchCompanyNews(symbol, daysBack = 7) {
  try {
    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setDate(fromDate.getDate() - daysBack);
    
    const from = fromDate.toISOString().split('T')[0];
    const to = today.toISOString().split('T')[0];
    
    const response = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${FINNHUB_KEY}`);
    const data = await response.json();
    return data.slice(0, 5).map(news => ({
      headline: news.headline,
      summary: news.summary,
      source: news.source,
      datetime: new Date(news.datetime * 1000).toLocaleString(),
      url: news.url,
      symbol
    }));
  } catch (error) {
    console.error(`Error fetching news for ${symbol}:`, error);
    return [];
  }
}

async function fetchMarketNews() {
  try {
    const response = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`);
    const data = await response.json();
    return data.slice(0, 10).map(news => ({
      headline: news.headline,
      summary: news.summary,
      source: news.source,
      datetime: new Date(news.datetime * 1000).toLocaleString(),
      url: news.url
    }));
  } catch (error) {
    console.error('Error fetching market news:', error);
    return [];
  }
}

app.post('/api/upload-chart', upload.single('chart'), (req, res) => {
  try {
    const { pair, timeframe } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    if (!pair || !timeframe) {
      return res.status(400).json({ error: 'Pair and timeframe are required' });
    }
    
    const sanitizedPair = pair.toUpperCase();
    const sanitizedTimeframe = timeframe.toLowerCase();
    
    if (!ALLOWED_PAIRS.includes(sanitizedPair)) {
      return res.status(400).json({ error: 'Invalid trading pair. Must be US30, NAS100, or SPX500' });
    }
    
    if (!ALLOWED_TIMEFRAMES.includes(sanitizedTimeframe)) {
      return res.status(400).json({ error: 'Invalid timeframe. Must be 15m, 1hr, 4hr, or daily' });
    }
    
    const pairDir = path.join(uploadsDir, sanitizedPair, sanitizedTimeframe);
    fs.mkdirSync(pairDir, { recursive: true });
    
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}-${safeName}`;
    const filePath = path.join(pairDir, filename);
    
    fs.writeFileSync(filePath, file.buffer);
    
    if (!chartStorage[sanitizedPair]) {
      chartStorage[sanitizedPair] = {};
    }
    if (!chartStorage[sanitizedPair][sanitizedTimeframe]) {
      chartStorage[sanitizedPair][sanitizedTimeframe] = [];
    }
    
    const chartInfo = {
      filename: filename,
      originalName: file.originalname,
      path: `/uploads/${sanitizedPair}/${sanitizedTimeframe}/${filename}`,
      uploadedAt: new Date().toISOString(),
      pair: sanitizedPair,
      timeframe: sanitizedTimeframe
    };
    
    chartStorage[sanitizedPair][sanitizedTimeframe].push(chartInfo);
    
    if (chartStorage[sanitizedPair][sanitizedTimeframe].length > 10) {
      const removed = chartStorage[sanitizedPair][sanitizedTimeframe].shift();
      const oldPath = path.join(uploadsDir, sanitizedPair, sanitizedTimeframe, removed.filename);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }
    
    res.json({ 
      success: true, 
      message: `Chart uploaded for ${sanitizedPair} (${sanitizedTimeframe})`,
      chart: chartInfo
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload chart' });
  }
});

app.get('/api/charts/:pair', (req, res) => {
  const { pair } = req.params;
  const charts = chartStorage[pair] || {};
  res.json(charts);
});

app.get('/api/charts', (req, res) => {
  res.json(chartStorage);
});

app.get('/api/market-status', (req, res) => {
  res.json(getMarketStatus());
});

app.get('/api/stocks/:pair', async (req, res) => {
  const { pair } = req.params;
  const pairInfo = TRADING_PAIRS[pair.toUpperCase()];
  
  if (!pairInfo) {
    return res.status(404).json({ error: 'Trading pair not found' });
  }
  
  const startTime = Date.now();
  
  try {
    const quotes = await Promise.all(
      pairInfo.majorStocks.map(async (stock) => {
        const quote = await fetchStockQuote(stock.symbol);
        if (!quote) {
          return { ...stock, currentPrice: null, change: null, percentChange: null, dataStatus: 'unavailable' };
        }
        return { 
          ...stock, 
          ...quote,
          dataStatus: quote.stale ? 'stale' : (quote.fromCache ? 'cached' : 'live')
        };
      })
    );
    
    const validStocks = quotes.filter(q => q.currentPrice !== null);
    const fetchTime = Date.now() - startTime;
    
    res.json({
      pair: pair.toUpperCase(),
      pairName: pairInfo.name,
      stocks: validStocks,
      meta: {
        marketStatus: getMarketStatus(),
        lastUpdated: new Date().toISOString(),
        fetchTimeMs: fetchTime,
        totalStocks: pairInfo.majorStocks.length,
        availableStocks: validStocks.length,
        dataQuality: validStocks.filter(s => s.dataStatus === 'live').length === validStocks.length ? 'excellent' :
                     validStocks.filter(s => s.dataStatus === 'stale').length > 0 ? 'degraded' : 'good'
      }
    });
  } catch (error) {
    console.error('Error fetching stocks:', error);
    res.status(500).json({ error: 'Failed to fetch stock data' });
  }
});

app.get('/api/news/:pair', async (req, res) => {
  const { pair } = req.params;
  const pairInfo = TRADING_PAIRS[pair.toUpperCase()];
  
  if (!pairInfo) {
    return res.status(404).json({ error: 'Trading pair not found' });
  }
  
  try {
    const topStocks = pairInfo.majorStocks.slice(0, 5);
    const newsPromises = topStocks.map(stock => fetchCompanyNews(stock.symbol));
    const allNews = await Promise.all(newsPromises);
    
    const flatNews = allNews.flat().sort((a, b) => 
      new Date(b.datetime) - new Date(a.datetime)
    ).slice(0, 15);
    
    res.json({
      pair: pair.toUpperCase(),
      pairName: pairInfo.name,
      news: flatNews
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

app.get('/api/market-news', async (req, res) => {
  try {
    const news = await fetchMarketNews();
    res.json({ news });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch market news' });
  }
});

app.get('/api/trading-pairs', (req, res) => {
  const pairs = Object.entries(TRADING_PAIRS).map(([key, value]) => ({
    id: key,
    name: value.name,
    stockCount: value.majorStocks.length
  }));
  res.json(pairs);
});

async function callGemini(prompt, systemPrompt = '') {
  const response = await geminiAI.models.generateContent({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: systemPrompt || SYSTEM_PROMPT
    },
    contents: prompt
  });
  return response.text || '';
}

async function analyzeChartImage(imagePath, pair, timeframe, analysisType = 'full') {
  if (!geminiAI) {
    throw new Error('Gemini API not configured for image analysis');
  }
  
  const absolutePath = path.join(__dirname, imagePath.startsWith('/') ? imagePath.slice(1) : imagePath);
  
  if (!fs.existsSync(absolutePath)) {
    throw new Error('Chart image not found');
  }
  
  const imageBuffer = fs.readFileSync(absolutePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
  
  const contextPrompt = `
Trading Pair: ${pair}
Timeframe: ${timeframe}
Analysis Type: ${analysisType === 'quick' ? 'Quick scan' : 'Full detailed analysis'}

${analysisType === 'quick' ? FAST_ANALYSIS_PROMPT : CHART_ANALYSIS_PROMPT}`;

  try {
    const response = await geminiAI.models.generateContent({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: SYSTEM_PROMPT
      },
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Image
              }
            },
            {
              text: contextPrompt
            }
          ]
        }
      ]
    });
    
    return {
      analysis: response.text || '',
      pair,
      timeframe,
      analysisType,
      analyzedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Chart analysis error:', error);
    throw new Error('Failed to analyze chart image');
  }
}

const analysisCache = new Map();
const ANALYSIS_CACHE_TTL = 300000;

async function getSmartChartAnalysis(pair, timeframe = null) {
  const charts = chartStorage[pair];
  if (!charts || Object.keys(charts).length === 0) {
    return null;
  }
  
  const timeframes = timeframe ? [timeframe] : Object.keys(charts);
  const analyses = [];
  
  for (const tf of timeframes) {
    if (charts[tf] && charts[tf].length > 0) {
      const latestChart = charts[tf][charts[tf].length - 1];
      const cacheKey = `${pair}_${tf}_${latestChart.filename}`;
      
      const cached = analysisCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < ANALYSIS_CACHE_TTL) {
        analyses.push(cached.data);
        continue;
      }
      
      try {
        const analysis = await analyzeChartImage(latestChart.path, pair, tf, 'full');
        analysisCache.set(cacheKey, { data: analysis, timestamp: Date.now() });
        analyses.push(analysis);
      } catch (error) {
        console.error(`Failed to analyze ${pair} ${tf} chart:`, error.message);
      }
    }
  }
  
  return analyses.length > 0 ? analyses : null;
}

async function callGroq(prompt, systemPrompt = '') {
  const response = await groqAI.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: systemPrompt || SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ],
    max_tokens: 1200
  });
  return response.choices[0]?.message?.content || '';
}

async function getChartsContext(pair = null, includeAnalysis = true) {
  let context = '';
  const pairs = pair ? [pair.toUpperCase()] : Object.keys(chartStorage);
  
  for (const p of pairs) {
    if (chartStorage[p]) {
      for (const [timeframe, charts] of Object.entries(chartStorage[p])) {
        if (charts.length > 0) {
          const latest = charts[charts.length - 1];
          context += `\n- ${p} ${timeframe} chart: uploaded ${latest.uploadedAt}`;
          
          if (includeAnalysis && geminiAI) {
            try {
              const analysis = await getSmartChartAnalysis(p, timeframe);
              if (analysis && analysis.length > 0) {
                context += `\n  Analysis: ${analysis[0].analysis.substring(0, 500)}...`;
              }
            } catch (e) {
              console.log('Skipping chart analysis in context');
            }
          }
        }
      }
    }
  }
  
  return context ? `\n\nUploaded Charts with AI Analysis:${context}` : '';
}

async function getMarketContext(pair) {
  let context = '';
  const pairInfo = TRADING_PAIRS[pair?.toUpperCase()];
  
  if (pairInfo && FINNHUB_KEY) {
    try {
      const topStocks = pairInfo.majorStocks.slice(0, 5);
      const quotes = await Promise.all(topStocks.map(s => fetchStockQuote(s.symbol)));
      
      context += `\n\nReal-time ${pairInfo.name} Major Stocks:`;
      for (const quote of quotes) {
        if (quote && quote.currentPrice) {
          const changeSymbol = quote.change >= 0 ? '+' : '';
          context += `\n- ${quote.symbol}: $${quote.currentPrice.toFixed(2)} (${changeSymbol}${quote.percentChange?.toFixed(2)}%)`;
        }
      }
    } catch (error) {
      console.error('Error getting market context:', error);
    }
  }
  
  return context;
}

function detectPairFromMessage(message) {
  const msg = message.toUpperCase();
  if (msg.includes('US30') || msg.includes('US 30') || msg.includes('DOW')) return 'US30';
  if (msg.includes('NAS100') || msg.includes('NAS 100') || msg.includes('NASDAQ')) return 'NAS100';
  if (msg.includes('SPX') || msg.includes('SPX500') || msg.includes('SPX 500') || msg.includes('S&P')) return 'SPX500';
  return null;
}

// Trade journaling helpers
function isTradeJournalCommand(message) {
  const lowerMsg = message.toLowerCase();
  const journalKeywords = [
    'journal', 'log trade', 'log my trade', 'record trade', 'add trade',
    'i made', 'i lost', 'won', 'profit', 'loss', 'pnl', 'p&l',
    'closed', 'entered', 'exited', 'took a trade', 'took trade',
    'update trade', 'edit trade', 'change trade', 'modify trade', 'redo',
    'fix trade', 'correct trade'
  ];
  return journalKeywords.some(kw => lowerMsg.includes(kw));
}

function isEditTradeCommand(message) {
  const lowerMsg = message.toLowerCase();
  const editKeywords = ['update', 'edit', 'change', 'modify', 'redo', 'fix', 'correct'];
  return editKeywords.some(kw => lowerMsg.includes(kw)) && 
         (lowerMsg.includes('trade') || lowerMsg.includes('pnl') || lowerMsg.includes('journal'));
}

async function parseTradeFromAI(message, pair) {
  if (!geminiAI) return null;
  
  const parsePrompt = `You are a trade data parser. Extract trade details from this message and return ONLY valid JSON.

User message: "${message}"
Default pair if not mentioned: ${pair || 'US30'}

Extract and return this exact JSON format (no markdown, no explanation):
{
  "action": "create" or "update" or "close",
  "trade_id": null or number (if updating/editing specific trade),
  "pair": "US30" or "NAS100" or "SPX500",
  "direction": "LONG" or "SHORT" or null,
  "entry_price": number or null,
  "exit_price": number or null,
  "stop_loss": number or null,
  "take_profit": number or null,
  "pnl": number or null (positive for profit, negative for loss),
  "status": "OPEN" or "WIN" or "LOSS" or "BREAKEVEN" or null,
  "position_size": number or null,
  "notes": string or null,
  "setup_type": string or null,
  "timeframe": "15m" or "1hr" or "4hr" or "daily" or null
}

Rules:
- If user says "made $50" or "+50", pnl is 50 and status is WIN
- If user says "lost $30" or "-30", pnl is -30 and status is LOSS
- If user mentions entry/exit prices, calculate pnl if not given
- If editing, set action to "update" and try to identify which trade
- Return ONLY the JSON object, nothing else`;

  try {
    const model = geminiAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
    const result = await model.generateContent(parsePrompt);
    const responseText = result.response.text().trim();
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (error) {
    console.error('Error parsing trade from AI:', error);
    return null;
  }
}

async function handleTradeJournaling(message, pair) {
  const tradeData = await parseTradeFromAI(message, pair);
  
  if (!tradeData) {
    return { success: false, message: "I couldn't understand the trade details. Please tell me: the pair (US30/NAS100/SPX500), direction (long/short), and the P&L or entry/exit prices." };
  }
  
  try {
    if (tradeData.action === 'update' && tradeData.trade_id) {
      // Update existing trade
      const updateData = {};
      if (tradeData.pnl !== null) updateData.pnl = tradeData.pnl;
      if (tradeData.exit_price !== null) updateData.exit_price = tradeData.exit_price;
      if (tradeData.status !== null) updateData.status = tradeData.status;
      if (tradeData.notes !== null) updateData.notes = tradeData.notes;
      if (tradeData.entry_price !== null) updateData.entry_price = tradeData.entry_price;
      if (tradeData.stop_loss !== null) updateData.stop_loss = tradeData.stop_loss;
      if (tradeData.take_profit !== null) updateData.take_profit = tradeData.take_profit;
      
      const updatedTrade = await updateTrade(tradeData.trade_id, updateData);
      return {
        success: true,
        action: 'updated',
        trade: updatedTrade,
        message: `Trade #${tradeData.trade_id} updated! ${tradeData.pnl !== null ? `P&L: $${tradeData.pnl}` : ''}`
      };
    } else if (tradeData.action === 'close' && tradeData.trade_id) {
      // Close a trade
      const closeData = {
        exit_price: tradeData.exit_price || 0,
        status: tradeData.status || (tradeData.pnl >= 0 ? 'WIN' : 'LOSS'),
        notes: tradeData.notes
      };
      const closedTrade = await closeTrade(tradeData.trade_id, closeData);
      return {
        success: true,
        action: 'closed',
        trade: closedTrade,
        message: `Trade #${tradeData.trade_id} closed! Status: ${closeData.status}`
      };
    } else {
      // Create new trade - handle completed trades (with P&L) vs open trades
      const isCompletedTrade = tradeData.pnl !== null || tradeData.status === 'WIN' || tradeData.status === 'LOSS' || tradeData.status === 'BREAKEVEN';
      
      const newTradeData = {
        pair: tradeData.pair || pair || 'US30',
        direction: tradeData.direction || 'LONG',
        entry_price: tradeData.entry_price || 0,
        stop_loss: tradeData.stop_loss || null,
        take_profit: tradeData.take_profit || null,
        position_size: tradeData.position_size || 1,
        timeframe: tradeData.timeframe || 'daily',
        setup_type: tradeData.setup_type || null,
        notes: tradeData.notes || null
      };
      
      const createdTrade = await createTrade(newTradeData);
      
      // If it's a completed trade, immediately close it with the P&L
      if (isCompletedTrade) {
        const closeData = {
          exit_price: tradeData.exit_price || tradeData.entry_price || 0,
          status: tradeData.status || (tradeData.pnl >= 0 ? 'WIN' : 'LOSS'),
          pnl: tradeData.pnl
        };
        
        // Update the trade with P&L and status
        await updateTrade(createdTrade.id, {
          exit_price: closeData.exit_price,
          status: closeData.status,
          pnl: tradeData.pnl,
          exit_date: new Date()
        });
        
        const pnlDisplay = tradeData.pnl >= 0 ? `+$${tradeData.pnl}` : `-$${Math.abs(tradeData.pnl)}`;
        return {
          success: true,
          action: 'logged',
          trade: createdTrade,
          message: `Trade logged! ${newTradeData.pair} ${newTradeData.direction} | P&L: ${pnlDisplay} | Status: ${closeData.status}`
        };
      }
      
      return {
        success: true,
        action: 'created',
        trade: createdTrade,
        message: `New trade opened! ${newTradeData.pair} ${newTradeData.direction} at entry ${newTradeData.entry_price || 'pending'}`
      };
    }
  } catch (error) {
    console.error('Trade journaling error:', error);
    return { success: false, message: `Failed to log trade: ${error.message}` };
  }
}

async function chainOfDebate(userQuery, requestedPair = null) {
  const detectedPair = requestedPair || detectPairFromMessage(userQuery);
  const isChartQuery = /chart|analyze|analysis|pattern|setup|trend|level/i.test(userQuery);
  
  const [chartsContext, marketContext] = await Promise.all([
    getChartsContext(detectedPair, isChartQuery).catch(() => ''),
    detectedPair ? getMarketContext(detectedPair) : Promise.resolve('')
  ]);
  
  const enhancedQuery = `${userQuery}${chartsContext}${marketContext}`;
  
  const technicalPrompt = isChartQuery 
    ? `Provide precise technical analysis. Include specific price levels, patterns, and actionable trade setups.`
    : `Answer briefly in 2-3 short paragraphs max. Use tables for any stock data.`;
  
  const geminiPrompt = `${enhancedQuery}\n\n${technicalPrompt}`;
  const groqPrompt = `${enhancedQuery}\n\n${technicalPrompt} Add risk considerations and alternative scenarios.`;

  let geminiPerspective = null;
  let groqPerspective = null;
  let geminiAvailable = true;

  const results = await Promise.allSettled([
    callGemini(geminiPrompt, SYSTEM_PROMPT),
    callGroq(groqPrompt, SYSTEM_PROMPT)
  ]);

  if (results[0].status === 'fulfilled') {
    geminiPerspective = results[0].value;
  } else {
    geminiAvailable = false;
    console.log('Gemini unavailable, using Groq-only mode');
  }

  if (results[1].status === 'fulfilled') {
    groqPerspective = results[1].value;
  }

  if (!geminiPerspective && !groqPerspective) {
    throw new Error('Both AI services are unavailable. Please try again later.');
  }

  if (!geminiAvailable && groqPerspective) {
    const groqSynthesisPrompt = isChartQuery
      ? `Provide a professional technical analysis report (max 200 words). Include:
- Clear trend direction
- Key support/resistance levels  
- Pattern identification
- Trade bias with entry/SL/TP if applicable
- Risk/Reward assessment

Query: ${userQuery}

Analysis:
${groqPerspective}`
      : `Provide a concise answer (max 150 words). Use tables for data. No intro phrases.

Query: ${userQuery}

Analysis:
${groqPerspective}`;
    
    const fallbackAnswer = await callGroq(groqSynthesisPrompt, SYSTEM_PROMPT);
    return `${fallbackAnswer}\n\n_Note: Running in Groq-only mode (Gemini quota exceeded)_`;
  }

  const synthesisPrompt = isChartQuery
    ? `Synthesize into a professional technical analysis report (max 200 words). Include:
- Clear trend direction
- Key support/resistance levels
- Pattern identification
- Trade bias with entry/SL/TP if applicable
- Risk/Reward assessment

Query: ${userQuery}

Technical View 1:
${geminiPerspective}

Risk-Aware View 2:
${groqPerspective}`
    : `Combine into ONE concise answer (max 150 words). Use tables for data. No intro phrases.

Query: ${userQuery}

View 1:
${geminiPerspective}

View 2:
${groqPerspective}`;
  
  try {
    const finalAnswer = await callGemini(synthesisPrompt, SYSTEM_PROMPT);
    return finalAnswer;
  } catch (error) {
    if (groqPerspective) {
      return `${groqPerspective}\n\n_Note: Using Groq response (Gemini synthesis unavailable)_`;
    }
    throw error;
  }
}

app.post('/api/analyze-chart', async (req, res) => {
  if (!geminiAI) {
    return res.status(503).json({ 
      error: 'GEMINI_API_KEY is required for chart analysis. Please add it to enable AI vision analysis.' 
    });
  }

  try {
    const { pair, timeframe, analysisType = 'full' } = req.body;
    
    if (!pair || !TRADING_PAIRS[pair.toUpperCase()]) {
      return res.status(400).json({ error: 'Invalid trading pair' });
    }
    
    const normalizedPair = pair.toUpperCase();
    const charts = chartStorage[normalizedPair];
    
    if (!charts || Object.keys(charts).length === 0) {
      return res.status(404).json({ 
        error: `No charts uploaded for ${normalizedPair}. Please upload a chart first.` 
      });
    }
    
    const tf = timeframe?.toLowerCase();
    if (tf && !charts[tf]) {
      return res.status(404).json({ 
        error: `No ${tf} chart found for ${normalizedPair}.` 
      });
    }
    
    const startTime = Date.now();
    const analyses = await getSmartChartAnalysis(normalizedPair, tf);
    const processingTime = Date.now() - startTime;
    
    if (!analyses || analyses.length === 0) {
      return res.status(500).json({ error: 'Failed to analyze charts' });
    }
    
    res.json({
      success: true,
      pair: normalizedPair,
      analyses,
      meta: {
        processingTimeMs: processingTime,
        chartsAnalyzed: analyses.length,
        analyzedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Chart analysis error:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze chart' });
  }
});

app.post('/api/quick-analysis', async (req, res) => {
  if (!geminiAI) {
    return res.status(503).json({ error: 'GEMINI_API_KEY required for analysis' });
  }

  try {
    const { pair, timeframe } = req.body;
    const normalizedPair = pair?.toUpperCase() || 'US30';
    const tf = timeframe?.toLowerCase() || 'daily';
    
    const charts = chartStorage[normalizedPair]?.[tf];
    if (!charts || charts.length === 0) {
      return res.status(404).json({ error: 'No chart available for quick analysis' });
    }
    
    const latestChart = charts[charts.length - 1];
    const startTime = Date.now();
    const analysis = await analyzeChartImage(latestChart.path, normalizedPair, tf, 'quick');
    
    res.json({
      success: true,
      analysis: analysis.analysis,
      pair: normalizedPair,
      timeframe: tf,
      processingTimeMs: Date.now() - startTime
    });
  } catch (error) {
    console.error('Quick analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, pair } = req.body;
    
    // Check if this is a trade journal command
    if (isTradeJournalCommand(message)) {
      if (!geminiAI) {
        return res.status(503).json({ 
          error: 'GEMINI_API_KEY is required for AI trade journaling. Please add it in Secrets.' 
        });
      }
      
      const journalResult = await handleTradeJournaling(message, pair);
      
      if (journalResult.success) {
        // Return success with trade action info
        return res.json({ 
          reply: `**Trade Journaled!**\n\n${journalResult.message}\n\n*Tip: Say "update trade #${journalResult.trade?.id} pnl to $X" to edit, or check the Journal tab to see all your trades.*`,
          tradeAction: journalResult
        });
      } else {
        return res.json({ 
          reply: journalResult.message + "\n\n**Examples:**\n- \"Log my US30 long, made $150\"\n- \"Journal: NAS100 short, lost $80\"\n- \"Took a trade on SPX500 long, entry 5800, exit 5850, profit $200\"",
          tradeAction: journalResult
        });
      }
    }
    
    // Regular chat - needs both AI models
    if (!geminiAI || !groqAI) {
      const missing = [];
      if (!geminiAI) missing.push('GEMINI_API_KEY');
      if (!groqAI) missing.push('GROQ_API_KEY');
      return res.status(503).json({ 
        error: `Missing API keys: ${missing.join(', ')}. Please add them to enable the Chain of Debate system.` 
      });
    }
    
    const reply = await chainOfDebate(message, pair);

    res.json({ reply });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Failed to get response from Agent Pippy' 
    });
  }
});

app.post('/api/trades', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    const trade = await createTrade(req.body, userId);
    res.json({ success: true, trade });
  } catch (error) {
    console.error('Create trade error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/trades', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    const { pair, status, limit, offset } = req.query;
    const trades = await getTrades({ pair, status, limit: parseInt(limit) || 50, offset: parseInt(offset) || 0 }, userId);
    res.json({ trades });
  } catch (error) {
    console.error('Get trades error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/trades/stats', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    const { pair } = req.query;
    const stats = await getTradeStats(pair, userId);
    res.json({ stats });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/trades/:id/close', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    const { id } = req.params;
    const trade = await closeTrade(id, req.body, userId);
    res.json({ success: true, trade });
  } catch (error) {
    console.error('Close trade error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/trades/:id', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    const { id } = req.params;
    const trade = await updateTrade(id, req.body, userId);
    res.json({ success: true, trade });
  } catch (error) {
    console.error('Update trade error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/trades/:id', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    const { id } = req.params;
    const trade = await deleteTrade(id, userId);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    res.json({ success: true, trade });
  } catch (error) {
    console.error('Delete trade error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// FOREX FACTORY ECONOMIC CALENDAR SCRAPER
// ============================================================

async function fetchForexFactoryCalendar() {
  try {
    const response = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.xml');
    const xmlText = await response.text();
    
    const events = [];
    const eventRegex = /<event>([\s\S]*?)<\/event>/g;
    let match;
    
    while ((match = eventRegex.exec(xmlText)) !== null) {
      const eventXml = match[1];
      
      const getTagValue = (tag) => {
        // Match CDATA content: <tag><![CDATA[value]]></tag>
        const cdataMatch = eventXml.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`));
        if (cdataMatch) return cdataMatch[1].trim();
        // Match simple content: <tag>value</tag>
        const simpleMatch = eventXml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
        if (simpleMatch) return simpleMatch[1].trim();
        // Match empty tags: <tag />
        return '';
      };
      
      const impact = getTagValue('impact');
      
      // Only include High (red) and Medium (orange) impact events
      if (impact === 'High' || impact === 'Medium') {
        const event = {
          title: getTagValue('title'),
          country: getTagValue('country'),
          date: getTagValue('date'),
          time: getTagValue('time'),
          impact: impact,
          impactColor: impact === 'High' ? 'red' : 'orange',
          forecast: getTagValue('forecast'),
          previous: getTagValue('previous'),
          actual: getTagValue('actual')
        };
        events.push(event);
      }
    }
    
    // Sort by date and time
    events.sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.time || '00:00'}`);
      const dateB = new Date(`${b.date} ${b.time || '00:00'}`);
      return dateA - dateB;
    });
    
    // Filter for today and upcoming events
    const now = new Date();
    
    const todayEvents = events.filter(e => {
      // Parse date in MM-DD-YYYY format
      const parts = e.date.split('-');
      if (parts.length === 3) {
        const eventDate = new Date(parts[2], parseInt(parts[0]) - 1, parts[1]);
        return eventDate.toDateString() === now.toDateString();
      }
      return false;
    });
    
    const upcomingEvents = events.filter(e => {
      const parts = e.date.split('-');
      if (parts.length === 3) {
        const eventDate = new Date(parts[2], parseInt(parts[0]) - 1, parts[1]);
        return eventDate > now && eventDate <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
      return false;
    });
    
    return {
      today: todayEvents,
      upcoming: upcomingEvents.slice(0, 15),
      allHighImpact: events,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching Forex Factory calendar:', error);
    return { today: [], upcoming: [], allHighImpact: [], error: error.message };
  }
}

// API endpoint for economic calendar
app.get('/api/economic-calendar', async (req, res) => {
  try {
    const calendar = await fetchForexFactoryCalendar();
    res.json(calendar);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch economic calendar' });
  }
});

// ============================================================
// PLANNER - INTELLIGENT TRADING PLAN GENERATOR
// ============================================================

const PLANNER_PROMPT = `You are an expert trading planner for indices (US30, NAS100, SPX500). Your job is to synthesize multiple data sources into a clear, actionable trading plan for today.

Given the following information:
1. CHART ANALYSIS - Technical analysis of uploaded charts
2. STOCK TRENDS - How major component stocks are performing
3. MARKET NEWS - Recent news affecting the markets
4. ECONOMIC CALENDAR - High-impact economic events (red/orange folder news from Forex Factory)

Create a comprehensive but concise trading plan with the following structure:

## TODAY'S TRADING PLAN - [PAIR]
**Date:** [Today's date]
**Overall Bias:** [BULLISH / BEARISH / NEUTRAL]
**Confidence:** [LOW / MEDIUM / HIGH]

### SUMMARY
[2-3 sentences summarizing the overall market outlook]

### KEY FACTORS
1. **Technical:** [Brief summary of chart analysis]
2. **Sentiment:** [Stock performance summary]
3. **Fundamentals:** [News impact summary]
4. **Events:** [High-impact events to watch]

### ACTION PLAN
- **Primary Direction:** [LONG / SHORT / WAIT]
- **Key Levels to Watch:**
  - Entry Zone: [price range]
  - Stop Loss: [price]
  - Take Profit 1: [price]
  - Take Profit 2: [price]

### RISK WARNINGS
[List any major risks or events that could invalidate the plan]

### SESSION TIMING
[Best times to trade based on events and volatility]

Be specific, actionable, and conservative with risk management.`;

async function generateTradingPlan(pair) {
  if (!geminiAI) {
    throw new Error('GEMINI_API_KEY is required for the Planner');
  }
  
  const normalizedPair = pair.toUpperCase();
  const pairInfo = TRADING_PAIRS[normalizedPair];
  
  if (!pairInfo) {
    throw new Error('Invalid trading pair');
  }
  
  // Step 1: Gather all data sources in parallel
  const startTime = Date.now();
  
  const [chartAnalyses, stockData, newsData, economicCalendar] = await Promise.all([
    // Chart analysis
    (async () => {
      try {
        const charts = chartStorage[normalizedPair];
        if (!charts || Object.keys(charts).length === 0) {
          return { status: 'no_charts', message: 'No charts uploaded for analysis' };
        }
        const analyses = await getSmartChartAnalysis(normalizedPair);
        return { status: 'success', analyses };
      } catch (e) {
        return { status: 'error', message: e.message };
      }
    })(),
    
    // Stock data
    (async () => {
      try {
        if (!FINNHUB_KEY) {
          return { status: 'no_api_key', message: 'FINNHUB_API_KEY not configured' };
        }
        const quotes = await Promise.all(
          pairInfo.majorStocks.slice(0, 5).map(stock => fetchStockQuote(stock.symbol))
        );
        const validQuotes = quotes.filter(q => q !== null);
        const gainers = validQuotes.filter(q => q.percentChange > 0).length;
        const losers = validQuotes.filter(q => q.percentChange < 0).length;
        return { 
          status: 'success', 
          quotes: validQuotes,
          summary: { gainers, losers, total: validQuotes.length }
        };
      } catch (e) {
        return { status: 'error', message: e.message };
      }
    })(),
    
    // News data
    (async () => {
      try {
        if (!FINNHUB_KEY) {
          return { status: 'no_api_key', message: 'FINNHUB_API_KEY not configured' };
        }
        const topStock = pairInfo.majorStocks[0];
        const news = await fetchCompanyNews(topStock.symbol, 3);
        return { status: 'success', news: news.slice(0, 5) };
      } catch (e) {
        return { status: 'error', message: e.message };
      }
    })(),
    
    // Economic calendar
    fetchForexFactoryCalendar()
  ]);
  
  // Step 2: Build context for AI
  let context = `Trading Pair: ${normalizedPair} (${pairInfo.name})\nDate: ${new Date().toLocaleDateString()}\n\n`;
  
  // Chart analysis context
  context += '=== CHART ANALYSIS ===\n';
  if (chartAnalyses.status === 'success' && chartAnalyses.analyses) {
    chartAnalyses.analyses.forEach(a => {
      context += `[${a.timeframe}] ${a.analysis.substring(0, 500)}...\n\n`;
    });
  } else {
    context += `${chartAnalyses.message || 'No chart data available'}\n\n`;
  }
  
  // Stock trends context
  context += '=== MAJOR STOCKS PERFORMANCE ===\n';
  if (stockData.status === 'success') {
    context += `Summary: ${stockData.summary.gainers} gainers, ${stockData.summary.losers} losers out of ${stockData.summary.total} stocks\n`;
    stockData.quotes.forEach(q => {
      context += `- ${q.symbol}: $${q.currentPrice} (${q.percentChange >= 0 ? '+' : ''}${q.percentChange}%)\n`;
    });
  } else {
    context += `${stockData.message || 'Stock data unavailable'}\n`;
  }
  context += '\n';
  
  // News context
  context += '=== RECENT NEWS ===\n';
  if (newsData.status === 'success' && newsData.news.length > 0) {
    newsData.news.forEach(n => {
      context += `- ${n.headline} (${n.source})\n`;
    });
  } else {
    context += 'No recent news available\n';
  }
  context += '\n';
  
  // Economic calendar context
  context += '=== ECONOMIC CALENDAR (HIGH IMPACT EVENTS) ===\n';
  if (economicCalendar.today && economicCalendar.today.length > 0) {
    context += 'TODAY:\n';
    economicCalendar.today.forEach(e => {
      context += `- [${e.impactColor.toUpperCase()}] ${e.time || 'All Day'} - ${e.country} - ${e.title}`;
      if (e.forecast) context += ` (Forecast: ${e.forecast}, Previous: ${e.previous})`;
      context += '\n';
    });
  } else {
    context += 'No high-impact events today\n';
  }
  
  if (economicCalendar.upcoming && economicCalendar.upcoming.length > 0) {
    context += '\nUPCOMING THIS WEEK:\n';
    economicCalendar.upcoming.slice(0, 5).forEach(e => {
      context += `- [${e.impactColor.toUpperCase()}] ${e.date} ${e.time || ''} - ${e.country} - ${e.title}\n`;
    });
  }
  
  // Step 3: Generate plan with AI
  try {
    const response = await geminiAI.models.generateContent({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: PLANNER_PROMPT
      },
      contents: context
    });
    
    const processingTime = Date.now() - startTime;
    
    return {
      success: true,
      pair: normalizedPair,
      plan: response.text || '',
      dataSources: {
        chartAnalysis: chartAnalyses.status,
        stockData: stockData.status,
        news: newsData.status,
        economicCalendar: economicCalendar.today?.length > 0 || economicCalendar.upcoming?.length > 0 ? 'success' : 'no_events'
      },
      economicEvents: {
        today: economicCalendar.today || [],
        upcoming: (economicCalendar.upcoming || []).slice(0, 5)
      },
      meta: {
        processingTimeMs: processingTime,
        generatedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Plan generation error:', error);
    throw new Error('Failed to generate trading plan');
  }
}

// Planner API endpoint
app.post('/api/planner/generate', async (req, res) => {
  try {
    const { pair } = req.body;
    
    if (!pair || !TRADING_PAIRS[pair.toUpperCase()]) {
      return res.status(400).json({ error: 'Invalid trading pair' });
    }
    
    const plan = await generateTradingPlan(pair);
    res.json(plan);
  } catch (error) {
    console.error('Planner error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate plan' });
  }
});

// Get planner data sources status
app.get('/api/planner/status/:pair', async (req, res) => {
  const { pair } = req.params;
  const normalizedPair = pair.toUpperCase();
  const pairInfo = TRADING_PAIRS[normalizedPair];
  
  if (!pairInfo) {
    return res.status(404).json({ error: 'Invalid trading pair' });
  }
  
  const charts = chartStorage[normalizedPair] || {};
  const chartCount = Object.values(charts).reduce((acc, arr) => acc + arr.length, 0);
  
  res.json({
    pair: normalizedPair,
    status: {
      charts: chartCount > 0 ? 'ready' : 'missing',
      chartCount,
      geminiAI: geminiAI ? 'ready' : 'missing',
      finnhub: FINNHUB_KEY ? 'ready' : 'missing'
    },
    requirements: {
      charts: 'Upload at least one chart for the selected pair',
      geminiAI: 'Add GEMINI_API_KEY in Secrets for AI analysis',
      finnhub: 'Add FINNHUB_API_KEY in Secrets for stock data'
    }
  });
});

const distPath = path.join(__dirname, 'dist', 'index.html');
if (fs.existsSync(distPath)) {
  app.get('/{*path}', (req, res) => {
    res.sendFile(distPath);
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\nAgent Pippy backend running on port ${PORT}`);
  console.log('Chain of Debate (CoD) - Optimized Multi-AI Architecture');
  console.log('Trading Pairs: US30, NAS100, SPX500\n');
  
  const status = getEnvStatus();
  if (status.geminiReady && status.groqReady) {
    console.log('✓ AI Services: Both Gemini and Groq ready!');
  }
  if (status.finnhubReady) {
    console.log('✓ Market Data: Finnhub API ready!');
  }
  if (status.alphaVantageReady) {
    console.log('✓ Financial Data: Alpha Vantage ready!');
  }
  console.log('');
});
