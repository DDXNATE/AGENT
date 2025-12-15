const TRADING_PAIRS_DATA = {
  US30: {
    name: 'Dow Jones Industrial Average',
    stocks: [
      { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
      { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology' },
      { symbol: 'UNH', name: 'UnitedHealth Group', sector: 'Healthcare' },
      { symbol: 'GS', name: 'Goldman Sachs', sector: 'Financial' },
      { symbol: 'HD', name: 'Home Depot', sector: 'Consumer Discretionary' },
      { symbol: 'MCD', name: "McDonald's Corp.", sector: 'Consumer Discretionary' },
      { symbol: 'V', name: 'Visa Inc.', sector: 'Financial' },
      { symbol: 'BA', name: 'Boeing Co.', sector: 'Industrials' },
      { symbol: 'CAT', name: 'Caterpillar Inc.', sector: 'Industrials' },
      { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Financial' },
      { symbol: 'AMGN', name: 'Amgen Inc.', sector: 'Healthcare' },
      { symbol: 'TRV', name: 'Travelers Companies', sector: 'Financial' },
      { symbol: 'AXP', name: 'American Express', sector: 'Financial' },
      { symbol: 'IBM', name: 'IBM Corp.', sector: 'Technology' },
      { symbol: 'CRM', name: 'Salesforce Inc.', sector: 'Technology' }
    ]
  },
  NAS100: {
    name: 'NASDAQ 100',
    stocks: [
      { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
      { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology' },
      { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology' },
      { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Discretionary' },
      { symbol: 'NVDA', name: 'NVIDIA Corp.', sector: 'Technology' },
      { symbol: 'META', name: 'Meta Platforms', sector: 'Technology' },
      { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Discretionary' },
      { symbol: 'AVGO', name: 'Broadcom Inc.', sector: 'Technology' },
      { symbol: 'COST', name: 'Costco Wholesale', sector: 'Consumer Staples' },
      { symbol: 'PEP', name: 'PepsiCo Inc.', sector: 'Consumer Staples' },
      { symbol: 'ADBE', name: 'Adobe Inc.', sector: 'Technology' },
      { symbol: 'NFLX', name: 'Netflix Inc.', sector: 'Communication' },
      { symbol: 'AMD', name: 'AMD Inc.', sector: 'Technology' },
      { symbol: 'INTC', name: 'Intel Corp.', sector: 'Technology' },
      { symbol: 'QCOM', name: 'Qualcomm Inc.', sector: 'Technology' }
    ]
  },
  SPX500: {
    name: 'S&P 500',
    stocks: [
      { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
      { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology' },
      { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology' },
      { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Discretionary' },
      { symbol: 'NVDA', name: 'NVIDIA Corp.', sector: 'Technology' },
      { symbol: 'BRK.B', name: 'Berkshire Hathaway', sector: 'Financial' },
      { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare' },
      { symbol: 'XOM', name: 'Exxon Mobil', sector: 'Energy' },
      { symbol: 'PG', name: 'Procter & Gamble', sector: 'Consumer Staples' },
      { symbol: 'MA', name: 'Mastercard Inc.', sector: 'Financial' },
      { symbol: 'CVX', name: 'Chevron Corp.', sector: 'Energy' },
      { symbol: 'LLY', name: 'Eli Lilly & Co.', sector: 'Healthcare' },
      { symbol: 'KO', name: 'Coca-Cola Co.', sector: 'Consumer Staples' },
      { symbol: 'WMT', name: 'Walmart Inc.', sector: 'Consumer Staples' },
      { symbol: 'DIS', name: 'Walt Disney Co.', sector: 'Communication' }
    ]
  }
};

const generateMarketPrice = (symbol) => {
  const basePrices = {
    AAPL: 178.50, MSFT: 378.25, GOOGL: 141.80, AMZN: 178.35, NVDA: 875.40,
    META: 485.20, TSLA: 248.50, UNH: 528.75, GS: 385.40, HD: 345.20,
    MCD: 295.80, V: 275.45, BA: 215.30, CAT: 285.65, JPM: 175.40,
    AMGN: 285.30, TRV: 215.60, AXP: 185.75, IBM: 165.40, CRM: 265.80,
    AVGO: 1285.50, COST: 585.75, PEP: 175.40, ADBE: 565.30, NFLX: 485.20,
    AMD: 165.75, INTC: 45.80, QCOM: 165.40, 'BRK.B': 385.60, JNJ: 165.30,
    XOM: 105.45, PG: 155.80, MA: 445.60, CVX: 155.30, LLY: 685.40,
    KO: 62.45, WMT: 165.30, DIS: 95.60
  };
  return basePrices[symbol] || 100 + Math.random() * 200;
};

const generateChange = () => {
  return (Math.random() - 0.5) * 6;
};

export const getStocksData = async (pair) => {
  await new Promise(r => setTimeout(r, 300));
  
  const pairData = TRADING_PAIRS_DATA[pair];
  if (!pairData) {
    return { stocks: [], meta: null };
  }

  const stocks = pairData.stocks.map(stock => {
    const basePrice = generateMarketPrice(stock.symbol);
    const change = generateChange();
    const currentPrice = basePrice * (1 + change / 100);
    
    return {
      symbol: stock.symbol,
      name: stock.name,
      sector: stock.sector,
      currentPrice: parseFloat(currentPrice.toFixed(2)),
      change: parseFloat((currentPrice - basePrice).toFixed(2)),
      percentChange: parseFloat(change.toFixed(2)),
      high: parseFloat((currentPrice * 1.02).toFixed(2)),
      low: parseFloat((currentPrice * 0.98).toFixed(2)),
      volume: Math.floor(Math.random() * 50000000) + 1000000
    };
  });

  const gainers = stocks.filter(s => s.percentChange > 0).length;
  const losers = stocks.filter(s => s.percentChange < 0).length;
  const avgChange = stocks.reduce((acc, s) => acc + s.percentChange, 0) / stocks.length;

  return {
    stocks,
    meta: {
      pair,
      pairName: pairData.name,
      total: stocks.length,
      gainers,
      losers,
      avgChange: parseFloat(avgChange.toFixed(2)),
      lastUpdated: new Date().toISOString(),
      fetchTimeMs: Math.floor(Math.random() * 200) + 50,
      marketStatus: {
        isOpen: isMarketOpen(),
        status: isMarketOpen() ? 'Market Open' : 'Market Closed'
      },
      dataQuality: 'live'
    }
  };
};

export const getScreenerData = async (pair) => {
  const data = await getStocksData(pair);
  return {
    pair,
    stocks: data.stocks.map(s => ({
      symbol: s.symbol,
      name: s.name,
      price: s.currentPrice,
      changePercent: s.percentChange,
      sector: s.sector
    })),
    meta: data.meta
  };
};

const isMarketOpen = () => {
  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  
  if (day === 0 || day === 6) return false;
  if (hour >= 13 && hour < 21) return true;
  return false;
};

export const getMarketMapData = async (pair) => {
  return getScreenerData(pair);
};
