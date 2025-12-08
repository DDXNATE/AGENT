import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';
import { checkEnvironment, getEnvStatus } from './config/env.js';

checkEnvironment();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

if (fs.existsSync(path.join(__dirname, 'dist'))) {
  app.use(express.static(path.join(__dirname, 'dist')));
}

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_PAIRS = ['US30', 'NAS100', 'SPX500'];
const ALLOWED_TIMEFRAMES = ['15m', '1hr', '4hr', 'daily'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const pair = (req.body.pair || '').toUpperCase();
    const timeframe = (req.body.timeframe || '').toLowerCase();
    
    if (!ALLOWED_PAIRS.includes(pair)) {
      return cb(new Error('Invalid trading pair'), null);
    }
    if (!ALLOWED_TIMEFRAMES.includes(timeframe)) {
      return cb(new Error('Invalid timeframe'), null);
    }
    
    const pairDir = path.join(uploadsDir, pair, timeframe);
    fs.mkdirSync(pairDir, { recursive: true });
    cb(null, pairDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}-${safeName}`);
  }
});

const upload = multer({ 
  storage,
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
    
    if (!chartStorage[sanitizedPair]) {
      chartStorage[sanitizedPair] = {};
    }
    if (!chartStorage[sanitizedPair][sanitizedTimeframe]) {
      chartStorage[sanitizedPair][sanitizedTimeframe] = [];
    }
    
    const chartInfo = {
      filename: file.filename,
      originalName: file.originalname,
      path: `/uploads/${sanitizedPair}/${sanitizedTimeframe}/${file.filename}`,
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

async function chainOfDebate(userQuery, requestedPair = null) {
  const detectedPair = requestedPair || detectPairFromMessage(userQuery);
  const isChartQuery = /chart|analyze|analysis|pattern|setup|trend|level/i.test(userQuery);
  
  const [chartsContext, marketContext] = await Promise.all([
    getChartsContext(detectedPair, isChartQuery),
    detectedPair ? getMarketContext(detectedPair) : Promise.resolve('')
  ]);
  
  const enhancedQuery = `${userQuery}${chartsContext}${marketContext}`;
  
  const technicalPrompt = isChartQuery 
    ? `Provide precise technical analysis. Include specific price levels, patterns, and actionable trade setups.`
    : `Answer briefly in 2-3 short paragraphs max. Use tables for any stock data.`;
  
  const geminiPrompt = `${enhancedQuery}\n\n${technicalPrompt}`;
  const groqPrompt = `${enhancedQuery}\n\n${technicalPrompt} Add risk considerations and alternative scenarios.`;

  const [geminiPerspective, groqPerspective] = await Promise.all([
    callGemini(geminiPrompt, SYSTEM_PROMPT),
    callGroq(groqPrompt, SYSTEM_PROMPT)
  ]);

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
  
  const finalAnswer = await callGemini(synthesisPrompt, SYSTEM_PROMPT);
  
  return finalAnswer;
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
  if (!geminiAI || !groqAI) {
    const missing = [];
    if (!geminiAI) missing.push('GEMINI_API_KEY');
    if (!groqAI) missing.push('GROQ_API_KEY');
    return res.status(503).json({ 
      error: `Missing API keys: ${missing.join(', ')}. Please add them to enable the Chain of Debate system.` 
    });
  }

  try {
    const { message, pair } = req.body;
    
    const reply = await chainOfDebate(message, pair);

    res.json({ reply });
  } catch (error) {
    console.error('Chain of Debate error:', error);
    res.status(500).json({ 
      error: 'Failed to get response from Agent Pippy Chain of Debate system' 
    });
  }
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
