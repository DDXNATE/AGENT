const SECTORS_DATA = [
  {
    name: 'Technology',
    stocks: [
      { symbol: 'AAPL', name: 'Apple Inc.' },
      { symbol: 'MSFT', name: 'Microsoft Corp.' },
      { symbol: 'NVDA', name: 'NVIDIA Corp.' },
      { symbol: 'GOOGL', name: 'Alphabet Inc.' },
      { symbol: 'META', name: 'Meta Platforms' }
    ]
  },
  {
    name: 'Healthcare',
    stocks: [
      { symbol: 'UNH', name: 'UnitedHealth Group' },
      { symbol: 'JNJ', name: 'Johnson & Johnson' },
      { symbol: 'LLY', name: 'Eli Lilly & Co.' },
      { symbol: 'PFE', name: 'Pfizer Inc.' },
      { symbol: 'AMGN', name: 'Amgen Inc.' }
    ]
  },
  {
    name: 'Financial',
    stocks: [
      { symbol: 'JPM', name: 'JPMorgan Chase' },
      { symbol: 'BAC', name: 'Bank of America' },
      { symbol: 'GS', name: 'Goldman Sachs' },
      { symbol: 'V', name: 'Visa Inc.' },
      { symbol: 'MA', name: 'Mastercard Inc.' }
    ]
  },
  {
    name: 'Consumer Discretionary',
    stocks: [
      { symbol: 'AMZN', name: 'Amazon.com Inc.' },
      { symbol: 'TSLA', name: 'Tesla Inc.' },
      { symbol: 'HD', name: 'Home Depot' },
      { symbol: 'MCD', name: "McDonald's Corp." },
      { symbol: 'NKE', name: 'Nike Inc.' }
    ]
  },
  {
    name: 'Consumer Staples',
    stocks: [
      { symbol: 'PG', name: 'Procter & Gamble' },
      { symbol: 'KO', name: 'Coca-Cola Co.' },
      { symbol: 'PEP', name: 'PepsiCo Inc.' },
      { symbol: 'COST', name: 'Costco Wholesale' },
      { symbol: 'WMT', name: 'Walmart Inc.' }
    ]
  },
  {
    name: 'Energy',
    stocks: [
      { symbol: 'XOM', name: 'Exxon Mobil' },
      { symbol: 'CVX', name: 'Chevron Corp.' },
      { symbol: 'COP', name: 'ConocoPhillips' },
      { symbol: 'SLB', name: 'Schlumberger' },
      { symbol: 'EOG', name: 'EOG Resources' }
    ]
  },
  {
    name: 'Industrials',
    stocks: [
      { symbol: 'BA', name: 'Boeing Co.' },
      { symbol: 'CAT', name: 'Caterpillar Inc.' },
      { symbol: 'UPS', name: 'United Parcel Service' },
      { symbol: 'HON', name: 'Honeywell International' },
      { symbol: 'GE', name: 'General Electric' }
    ]
  },
  {
    name: 'Communication',
    stocks: [
      { symbol: 'GOOGL', name: 'Alphabet Inc.' },
      { symbol: 'META', name: 'Meta Platforms' },
      { symbol: 'DIS', name: 'Walt Disney Co.' },
      { symbol: 'NFLX', name: 'Netflix Inc.' },
      { symbol: 'T', name: 'AT&T Inc.' }
    ]
  }
];

const generateChange = () => (Math.random() - 0.5) * 6;

export const getSectorsData = async () => {
  await new Promise(r => setTimeout(r, 200));
  
  const sectors = SECTORS_DATA.map(sector => {
    const stocks = sector.stocks.map(stock => ({
      symbol: stock.symbol,
      name: stock.name,
      change: parseFloat(generateChange().toFixed(2))
    }));
    
    const avgChange = stocks.reduce((acc, s) => acc + s.change, 0) / stocks.length;
    const sectorChange = avgChange + (Math.random() - 0.5) * 2;
    
    return {
      name: sector.name,
      change: parseFloat(sectorChange.toFixed(2)),
      avgChange: parseFloat(avgChange.toFixed(2)),
      stocks
    };
  });
  
  return { sectors };
};
