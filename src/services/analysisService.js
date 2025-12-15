const ANALYSIS_PATTERNS = {
  bullish: [
    'The technical setup shows bullish momentum with prices holding above key moving averages.',
    'Current price action suggests accumulation with higher lows forming.',
    'Volume profile indicates institutional buying interest at current levels.',
    'Support levels are holding firm with buyers stepping in on dips.'
  ],
  bearish: [
    'Technical indicators suggest caution with prices testing support levels.',
    'Momentum appears to be weakening with lower highs forming on the chart.',
    'Volume analysis shows distribution pattern developing.',
    'Key resistance levels continue to cap upside attempts.'
  ],
  neutral: [
    'Price action is consolidating within a defined range.',
    'The market is awaiting a catalyst for directional movement.',
    'Current setup suggests a wait-and-see approach is prudent.',
    'Technical indicators are mixed, suggesting range-bound trading.'
  ]
};

const TRADING_STRATEGIES = {
  US30: {
    keyLevels: { support: 38500, resistance: 39500, pivot: 39000 },
    volatility: 'moderate',
    trend: 'bullish'
  },
  NAS100: {
    keyLevels: { support: 17800, resistance: 18500, pivot: 18150 },
    volatility: 'elevated',
    trend: 'bullish'
  },
  SPX500: {
    keyLevels: { support: 5050, resistance: 5150, pivot: 5100 },
    volatility: 'low',
    trend: 'neutral'
  }
};

const selectRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const generateAnalysis = (pair, context = '') => {
  const strategy = TRADING_STRATEGIES[pair] || TRADING_STRATEGIES.US30;
  const bias = strategy.trend;
  const patterns = ANALYSIS_PATTERNS[bias] || ANALYSIS_PATTERNS.neutral;
  
  return {
    summary: selectRandom(patterns),
    keyLevels: strategy.keyLevels,
    volatility: strategy.volatility,
    trend: bias,
    recommendation: bias === 'bullish' 
      ? 'Look for buying opportunities on pullbacks to support levels.'
      : bias === 'bearish'
      ? 'Consider defensive positioning and tight risk management.'
      : 'Wait for clear breakout or breakdown before taking positions.'
  };
};

export const generateTradingPlan = async (pair, stocksData, newsData) => {
  await new Promise(r => setTimeout(r, 1500));
  
  const strategy = TRADING_STRATEGIES[pair] || TRADING_STRATEGIES.US30;
  const analysis = generateAnalysis(pair);
  
  const gainers = stocksData?.stocks?.filter(s => s.percentChange > 0) || [];
  const losers = stocksData?.stocks?.filter(s => s.percentChange < 0) || [];
  
  const topGainers = gainers.slice(0, 3).map(s => s.symbol).join(', ') || 'N/A';
  const topLosers = losers.slice(0, 3).map(s => s.symbol).join(', ') || 'N/A';

  return {
    success: true,
    pair,
    generatedAt: new Date().toISOString(),
    marketBias: analysis.trend,
    plan: {
      overview: `${pair} is showing ${analysis.trend} tendencies with ${analysis.volatility} volatility.`,
      keyLevels: analysis.keyLevels,
      topMovers: { gainers: topGainers, losers: topLosers },
      strategy: analysis.recommendation,
      riskManagement: 'Use position sizing of 1-2% per trade. Set stop losses at key technical levels.',
      timeframe: 'Intraday to swing trading opportunities available.',
      watchPoints: [
        `Monitor ${strategy.keyLevels.support} support level`,
        `Watch for breakout above ${strategy.keyLevels.resistance}`,
        'Track volume for confirmation of moves',
        'Be aware of upcoming economic data releases'
      ]
    }
  };
};

export const generateChatResponse = async (message, pair, history = []) => {
  await new Promise(r => setTimeout(r, 800));
  
  const lowerMessage = message.toLowerCase();
  const analysis = generateAnalysis(pair);
  const strategy = TRADING_STRATEGIES[pair] || TRADING_STRATEGIES.US30;

  if (lowerMessage.includes('stock') || lowerMessage.includes('major')) {
    return {
      reply: `For ${pair}, I'm tracking key constituents. The current market shows ${analysis.trend} tendencies. Top sectors showing strength include Technology and Healthcare. ${analysis.summary} Key support is at ${strategy.keyLevels.support} with resistance at ${strategy.keyLevels.resistance}.`
    };
  }

  if (lowerMessage.includes('news') || lowerMessage.includes('update')) {
    return {
      reply: `Here's the latest on ${pair}: ${analysis.summary} Market volatility is ${analysis.volatility}. ${analysis.recommendation}`
    };
  }

  if (lowerMessage.includes('overview') || lowerMessage.includes('market')) {
    return {
      reply: `${pair} Market Overview:\n\n${analysis.summary}\n\nKey Levels:\n• Support: ${strategy.keyLevels.support}\n• Resistance: ${strategy.keyLevels.resistance}\n• Pivot: ${strategy.keyLevels.pivot}\n\nVolatility: ${analysis.volatility}\nTrend Bias: ${analysis.trend}\n\n${analysis.recommendation}`
    };
  }

  if (lowerMessage.includes('help') || lowerMessage.includes('what can')) {
    return {
      reply: `I can help you with:\n\n• Market overview and analysis for ${pair}\n• Major stock updates and sector performance\n• News affecting the market\n• Technical levels and trading strategy\n• Risk management guidance\n\nJust ask me about any of these topics!`
    };
  }

  return {
    reply: `Regarding ${pair}: ${analysis.summary} The current trend bias is ${analysis.trend} with ${analysis.volatility} volatility. ${analysis.recommendation}\n\nWould you like more details on specific stocks, news, or technical levels?`
  };
};
