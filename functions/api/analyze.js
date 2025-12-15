const INSTRUMENT_MAPPINGS = {
  US30: {
    name: 'Dow Jones Industrial Average',
    alphaVantageSymbol: 'DJI',
    components: ['AAPL', 'MSFT', 'UNH', 'GS', 'HD', 'MCD', 'V', 'BA', 'CAT', 'JPM']
  },
  NAS100: {
    name: 'NASDAQ 100',
    alphaVantageSymbol: 'NDX',
    components: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AVGO', 'COST', 'PEP']
  },
  SPX500: {
    name: 'S&P 500',
    alphaVantageSymbol: 'SPX',
    components: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'BRK.B', 'JNJ', 'XOM', 'PG', 'MA']
  }
};

function getCurrentSession() {
  const now = new Date();
  const utcHour = now.getUTCHours();
  
  if (utcHour >= 0 && utcHour < 8) return 'Asia';
  if (utcHour >= 8 && utcHour < 13) return 'London';
  return 'New York';
}

function normalizeSignals(marketData) {
  const { breadth, priceAction, volatility, macroTone } = marketData;
  
  const breadthSignal = breadth.advancers > breadth.decliners * 1.5 ? 'Strong' :
    breadth.decliners > breadth.advancers * 1.5 ? 'Weak' : 'Mixed';
  
  const structureSignal = priceAction.currentPrice > priceAction.sessionHigh * 0.98 ? 'Bullish' :
    priceAction.currentPrice < priceAction.sessionLow * 1.02 ? 'Bearish' : 'Neutral';
  
  const volatilitySignal = volatility > 25 ? 'High' :
    volatility < 15 ? 'Low' : 'Normal';
  
  const momentumSignal = priceAction.change > 0.5 ? 'Expanding' :
    priceAction.change < -0.5 ? 'Contracting' : 'Stable';
  
  const macroSignal = macroTone > 0.3 ? 'Risk-on' :
    macroTone < -0.3 ? 'Risk-off' : 'Neutral';

  return {
    breadth: breadthSignal,
    structure: structureSignal,
    volatility: volatilitySignal,
    momentum: momentumSignal,
    macro: macroSignal
  };
}

async function fetchMarketData(instrument, env) {
  const config = INSTRUMENT_MAPPINGS[instrument];
  if (!config) throw new Error('Invalid instrument');

  const apiKey = env.ALPHA_VANTAGE_API_KEY;
  const stocks = [];
  let advancers = 0;
  let decliners = 0;
  let totalChange = 0;

  for (const symbol of config.components.slice(0, 5)) {
    try {
      const response = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`
      );
      const data = await response.json();
      
      if (data['Global Quote']) {
        const quote = data['Global Quote'];
        const change = parseFloat(quote['10. change percent']?.replace('%', '') || '0');
        
        stocks.push({
          symbol,
          price: parseFloat(quote['05. price'] || 0),
          change,
          high: parseFloat(quote['03. high'] || 0),
          low: parseFloat(quote['04. low'] || 0)
        });
        
        if (change > 0) advancers++;
        else if (change < 0) decliners++;
        totalChange += change;
      }
    } catch (error) {
      console.error(`Failed to fetch ${symbol}:`, error);
    }
  }

  const avgPrice = stocks.length > 0 
    ? stocks.reduce((acc, s) => acc + s.price, 0) / stocks.length 
    : 0;
  const avgHigh = stocks.length > 0 
    ? stocks.reduce((acc, s) => acc + s.high, 0) / stocks.length 
    : 0;
  const avgLow = stocks.length > 0 
    ? stocks.reduce((acc, s) => acc + s.low, 0) / stocks.length 
    : 0;

  return {
    instrument,
    stocks,
    breadth: { advancers, decliners, total: stocks.length },
    priceAction: {
      currentPrice: avgPrice,
      sessionHigh: avgHigh,
      sessionLow: avgLow,
      change: totalChange / Math.max(stocks.length, 1)
    },
    volatility: Math.abs(avgHigh - avgLow) / avgPrice * 100,
    macroTone: totalChange / Math.max(stocks.length, 1) / 2
  };
}

async function callGroqAI(signals, instrument, session, env) {
  const apiKey = env.GROQ_API_KEY;
  
  const prompt = `You are a professional market analyst. Analyze the following normalized market signals for ${instrument} during the ${session} session.

NORMALIZED SIGNALS:
- Market Breadth: ${signals.breadth}
- Price Structure: ${signals.structure}  
- Volatility: ${signals.volatility}
- Momentum: ${signals.momentum}
- Macro Tone: ${signals.macro}

TASK:
Weigh these signals, resolve any conflicts, and produce a coherent market view.
Return ONLY valid JSON with this exact schema (no markdown, no code blocks):

{
  "instrument": "${instrument}",
  "bias": "Bullish" or "Bearish" or "Neutral",
  "confidence": "Low" or "Medium" or "High",
  "drivers": ["max 5 concise driver points"],
  "levels": {
    "support": [array of key support levels],
    "resistance": [array of key resistance levels],
    "extension": [array of extension targets]
  },
  "invalidation": "single clear invalidation rule",
  "session": "${session}",
  "summary": "concise professional conclusion"
}`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a professional market analyst. Return ONLY valid JSON, no markdown formatting.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1000
    })
  });

  const data = await response.json();
  
  if (data.choices && data.choices[0]?.message?.content) {
    let content = data.choices[0].message.content.trim();
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    try {
      return JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      throw new Error('AI response was not valid JSON');
    }
  }
  
  throw new Error('Failed to get AI response');
}

export async function onRequest(context) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const instrument = url.searchParams.get('instrument') || 'US30';
    
    if (!INSTRUMENT_MAPPINGS[instrument]) {
      return new Response(
        JSON.stringify({ error: 'Invalid instrument. Use US30, NAS100, or SPX500' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const session = getCurrentSession();
    const marketData = await fetchMarketData(instrument, env);
    const normalizedSignals = normalizeSignals(marketData);
    const aiAnalysis = await callGroqAI(normalizedSignals, instrument, session, env);

    return new Response(
      JSON.stringify({
        success: true,
        analysis: aiAnalysis,
        signals: normalizedSignals,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Analysis error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Analysis failed', 
        message: error.message 
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
