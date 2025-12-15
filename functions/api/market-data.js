const INSTRUMENT_STOCKS = {
  US30: [
    { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
    { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology' },
    { symbol: 'UNH', name: 'UnitedHealth Group', sector: 'Healthcare' },
    { symbol: 'GS', name: 'Goldman Sachs', sector: 'Financial' },
    { symbol: 'HD', name: 'Home Depot', sector: 'Consumer Discretionary' },
    { symbol: 'MCD', name: "McDonald's Corp.", sector: 'Consumer Discretionary' },
    { symbol: 'V', name: 'Visa Inc.', sector: 'Financial' },
    { symbol: 'BA', name: 'Boeing Co.', sector: 'Industrials' },
    { symbol: 'CAT', name: 'Caterpillar Inc.', sector: 'Industrials' },
    { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Financial' }
  ],
  NAS100: [
    { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
    { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Discretionary' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', sector: 'Technology' },
    { symbol: 'META', name: 'Meta Platforms', sector: 'Technology' },
    { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Discretionary' },
    { symbol: 'AVGO', name: 'Broadcom Inc.', sector: 'Technology' },
    { symbol: 'COST', name: 'Costco Wholesale', sector: 'Consumer Staples' },
    { symbol: 'PEP', name: 'PepsiCo Inc.', sector: 'Consumer Staples' }
  ],
  SPX500: [
    { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
    { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Discretionary' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', sector: 'Technology' },
    { symbol: 'BRK-B', name: 'Berkshire Hathaway', sector: 'Financial' },
    { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare' },
    { symbol: 'XOM', name: 'Exxon Mobil', sector: 'Energy' },
    { symbol: 'PG', name: 'Procter & Gamble', sector: 'Consumer Staples' },
    { symbol: 'MA', name: 'Mastercard Inc.', sector: 'Financial' }
  ]
};

function isMarketOpen() {
  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  
  if (day === 0 || day === 6) return false;
  if (hour >= 14 && hour < 21) return true;
  return false;
}

async function fetchStockQuote(symbol, apiKey) {
  try {
    const response = await fetch(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`
    );
    const data = await response.json();
    
    if (data['Global Quote']) {
      const quote = data['Global Quote'];
      return {
        currentPrice: parseFloat(quote['05. price'] || 0),
        change: parseFloat(quote['09. change'] || 0),
        percentChange: parseFloat(quote['10. change percent']?.replace('%', '') || 0),
        high: parseFloat(quote['03. high'] || 0),
        low: parseFloat(quote['04. low'] || 0),
        volume: parseInt(quote['06. volume'] || 0)
      };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error);
    return null;
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!env.ALPHA_VANTAGE_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'API key missing', required: ['ALPHA_VANTAGE_API_KEY'] }),
      { status: 500, headers: corsHeaders }
    );
  }

  try {
    const url = new URL(request.url);
    const instrument = url.searchParams.get('instrument') || 'US30';
    
    const instrumentStocks = INSTRUMENT_STOCKS[instrument];
    if (!instrumentStocks) {
      return new Response(
        JSON.stringify({ error: 'Invalid instrument' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const apiKey = env.ALPHA_VANTAGE_API_KEY;
    const startTime = Date.now();
    
    const stockPromises = instrumentStocks.slice(0, 5).map(async (stock) => {
      const quote = await fetchStockQuote(stock.symbol, apiKey);
      if (quote) {
        return {
          symbol: stock.symbol,
          name: stock.name,
          sector: stock.sector,
          ...quote
        };
      }
      return {
        symbol: stock.symbol,
        name: stock.name,
        sector: stock.sector,
        currentPrice: 0,
        change: 0,
        percentChange: 0,
        high: 0,
        low: 0,
        volume: 0,
        error: true
      };
    });

    const stocks = await Promise.all(stockPromises);
    const validStocks = stocks.filter(s => !s.error);
    
    const gainers = validStocks.filter(s => s.percentChange > 0).length;
    const losers = validStocks.filter(s => s.percentChange < 0).length;
    const avgChange = validStocks.length > 0
      ? validStocks.reduce((acc, s) => acc + s.percentChange, 0) / validStocks.length
      : 0;

    return new Response(
      JSON.stringify({
        stocks,
        meta: {
          pair: instrument,
          pairName: instrument === 'US30' ? 'Dow Jones Industrial Average' :
            instrument === 'NAS100' ? 'NASDAQ 100' : 'S&P 500',
          total: stocks.length,
          gainers,
          losers,
          avgChange: parseFloat(avgChange.toFixed(2)),
          lastUpdated: new Date().toISOString(),
          fetchTimeMs: Date.now() - startTime,
          marketStatus: {
            isOpen: isMarketOpen(),
            status: isMarketOpen() ? 'Market Open' : 'Market Closed'
          },
          dataQuality: validStocks.length === stocks.length ? 'live' : 'partial'
        }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Market data error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch market data' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
