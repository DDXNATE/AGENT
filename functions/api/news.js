const INSTRUMENT_TICKERS = {
  US30: ['AAPL', 'MSFT', 'JPM', 'GS', 'BA'],
  NAS100: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA'],
  SPX500: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'XOM']
};

async function fetchNewsFromAlphaVantage(tickers, apiKey) {
  const news = [];
  
  for (const ticker of tickers.slice(0, 3)) {
    try {
      const response = await fetch(
        `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${ticker}&apikey=${apiKey}&limit=3`
      );
      const data = await response.json();
      
      if (data.feed) {
        for (const item of data.feed.slice(0, 2)) {
          news.push({
            symbol: ticker,
            headline: item.title,
            summary: item.summary?.substring(0, 200) + '...' || '',
            source: item.source,
            datetime: item.time_published,
            sentiment: item.overall_sentiment_label,
            sentimentScore: item.overall_sentiment_score,
            url: item.url
          });
        }
      }
    } catch (error) {
      console.error(`Error fetching news for ${ticker}:`, error);
    }
  }
  
  return news.sort((a, b) => 
    new Date(b.datetime) - new Date(a.datetime)
  );
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

  try {
    const url = new URL(request.url);
    const instrument = url.searchParams.get('instrument') || 'US30';
    
    const tickers = INSTRUMENT_TICKERS[instrument];
    if (!tickers) {
      return new Response(
        JSON.stringify({ error: 'Invalid instrument' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const apiKey = env.ALPHA_VANTAGE_API_KEY;
    const news = await fetchNewsFromAlphaVantage(tickers, apiKey);

    return new Response(
      JSON.stringify({
        news,
        instrument,
        fetchedAt: new Date().toISOString()
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('News error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch news' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
