import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'dist')));

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

const SYSTEM_PROMPT = `You are Agent Pippy (call yourself "Pippy"), a friendly and knowledgeable AI trading assistant specializing in SPX 500, NAS 100, and US30 index trading. 

You help users:
- Analyze their uploaded trading charts (15m, 1hr, 4hr, daily timeframes)
- Understand market movements and technical analysis
- Track major stocks that drive index movements
- Stay informed about relevant market news

When users ask you to analyze charts, you have access to their uploaded chart images. When they ask about major stocks or news, you can provide real-time data.

You speak in a professional yet approachable manner. You provide educational information but always remind users that trading involves risks. Never provide specific financial advice or guarantee returns.

Key trading pairs you specialize in:
- US30 (Dow Jones Industrial Average)
- NAS100 (NASDAQ 100)  
- SPX500 (S&P 500)`;

async function fetchStockQuote(symbol) {
  try {
    const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`);
    const data = await response.json();
    return {
      symbol,
      currentPrice: data.c,
      change: data.d,
      percentChange: data.dp,
      high: data.h,
      low: data.l,
      open: data.o,
      previousClose: data.pc,
      timestamp: data.t
    };
  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error);
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

app.get('/api/stocks/:pair', async (req, res) => {
  const { pair } = req.params;
  const pairInfo = TRADING_PAIRS[pair.toUpperCase()];
  
  if (!pairInfo) {
    return res.status(404).json({ error: 'Trading pair not found' });
  }
  
  try {
    const quotes = await Promise.all(
      pairInfo.majorStocks.map(async (stock) => {
        const quote = await fetchStockQuote(stock.symbol);
        if (!quote) {
          return { ...stock, currentPrice: null, change: null, percentChange: null };
        }
        return { ...stock, ...quote };
      })
    );
    
    res.json({
      pair: pair.toUpperCase(),
      pairName: pairInfo.name,
      stocks: quotes.filter(q => q.currentPrice !== null)
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

function getChartsContext(pair = null) {
  let context = '';
  const pairs = pair ? [pair.toUpperCase()] : Object.keys(chartStorage);
  
  for (const p of pairs) {
    if (chartStorage[p]) {
      for (const [timeframe, charts] of Object.entries(chartStorage[p])) {
        if (charts.length > 0) {
          const latest = charts[charts.length - 1];
          context += `\n- ${p} ${timeframe} chart: uploaded ${latest.uploadedAt}`;
        }
      }
    }
  }
  
  return context ? `\n\nUploaded Charts Available:${context}` : '';
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

async function chainOfDebate(userQuery) {
  const detectedPair = detectPairFromMessage(userQuery);
  const chartsContext = getChartsContext(detectedPair);
  const marketContext = detectedPair ? await getMarketContext(detectedPair) : '';
  
  const enhancedQuery = `${userQuery}${chartsContext}${marketContext}`;
  
  const geminiPrompt = `Analyze this trading question and provide your perspective concisely:\n\nUser Query: ${enhancedQuery}\n\nProvide a clear, focused analysis.`;
  const groqPrompt = `Analyze this trading question and provide your perspective concisely:\n\nUser Query: ${enhancedQuery}\n\nProvide a clear, focused analysis with any alternative viewpoints.`;

  const [geminiPerspective, groqPerspective] = await Promise.all([
    callGemini(geminiPrompt, `${SYSTEM_PROMPT}\n\nYou are AI1 (Gemini) providing the first perspective. Be concise but thorough.`),
    callGroq(groqPrompt, `${SYSTEM_PROMPT}\n\nYou are AI2 (Groq) providing an alternative perspective. Be concise but thorough.`)
  ]);

  const synthesisPrompt = `Synthesize these two AI perspectives into a unified, helpful answer:\n\nUser Query: ${userQuery}\n\nPerspective 1 (Gemini):\n${geminiPerspective}\n\nPerspective 2 (Groq):\n${groqPerspective}\n\nProvide a clear, comprehensive answer combining the best insights from both perspectives.`;
  
  const synthesis = await callGemini(synthesisPrompt, `${SYSTEM_PROMPT}\n\nSynthesize both perspectives into a clear, helpful final answer.`);

  const finalPrompt = `Review and refine this answer for the user:\n\nUser Query: ${userQuery}\n\nDraft Answer:\n${synthesis}\n\nProvide the final polished answer. Be clear, helpful, and actionable.`;
  
  const finalAnswer = await callGroq(finalPrompt, `${SYSTEM_PROMPT}\n\nProvide the final refined answer. Make it clear and user-friendly.`);
  
  return finalAnswer;
}

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
    const { message } = req.body;
    
    const reply = await chainOfDebate(message);

    res.json({ reply });
  } catch (error) {
    console.error('Chain of Debate error:', error);
    res.status(500).json({ 
      error: 'Failed to get response from Agent Pippy Chain of Debate system' 
    });
  }
});

app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Agent Pippy backend running on port ${PORT}`);
  console.log('Chain of Debate (CoD) - Optimized Multi-AI Architecture');
  console.log('Trading Pairs: US30, NAS100, SPX500');
  if (!geminiAI) console.log('Warning: GEMINI_API_KEY not set');
  if (!groqAI) console.log('Warning: GROQ_API_KEY not set');
  if (!FINNHUB_KEY) console.log('Warning: FINNHUB_API_KEY not set');
  if (!ALPHA_VANTAGE_KEY) console.log('Warning: ALPHA_VANTAGE_API_KEY not set');
  if (geminiAI && groqAI) console.log('Both Gemini and Groq AI ready!');
  if (FINNHUB_KEY) console.log('Finnhub API ready for real-time data!');
});
