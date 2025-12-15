const COMPANIES = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corp.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.' },
  { symbol: 'META', name: 'Meta Platforms' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'JPM', name: 'JPMorgan Chase' },
  { symbol: 'V', name: 'Visa Inc.' },
  { symbol: 'UNH', name: 'UnitedHealth Group' },
  { symbol: 'HD', name: 'Home Depot' },
  { symbol: 'MA', name: 'Mastercard Inc.' },
  { symbol: 'PG', name: 'Procter & Gamble' },
  { symbol: 'XOM', name: 'Exxon Mobil' },
  { symbol: 'JNJ', name: 'Johnson & Johnson' }
];

const INSIDER_NAMES = [
  'John Smith (CEO)',
  'Sarah Johnson (CFO)',
  'Michael Chen (COO)',
  'Emily Davis (Director)',
  'Robert Wilson (VP)',
  'Jennifer Brown (CTO)',
  'David Miller (President)',
  'Lisa Anderson (EVP)',
  'James Taylor (Director)',
  'Amanda White (SVP)'
];

const generateInsiderTrades = () => {
  const trades = [];
  const now = new Date();
  
  for (let i = 0; i < 30; i++) {
    const company = COMPANIES[Math.floor(Math.random() * COMPANIES.length)];
    const type = Math.random() > 0.45 ? 'buy' : 'sell';
    const basePrice = 50 + Math.random() * 400;
    const shares = Math.floor(Math.random() * 50000) + 1000;
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    
    trades.push({
      symbol: company.symbol,
      companyName: company.name,
      insiderName: INSIDER_NAMES[Math.floor(Math.random() * INSIDER_NAMES.length)],
      type,
      shares,
      price: parseFloat(basePrice.toFixed(2)),
      date: date.toISOString()
    });
  }
  
  return trades.sort((a, b) => new Date(b.date) - new Date(a.date));
};

export const getInsiderData = async () => {
  await new Promise(r => setTimeout(r, 200));
  return { trades: generateInsiderTrades() };
};
