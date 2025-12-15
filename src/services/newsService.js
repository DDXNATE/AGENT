const NEWS_TEMPLATES = {
  US30: [
    {
      headline: 'Dow Components Show Mixed Performance Ahead of Fed Decision',
      summary: 'Major Dow Jones constituents displayed varied trading patterns as investors await the Federal Reserve policy announcement. Industrial stocks led gains while technology names showed caution.',
      source: 'Market Watch',
      symbol: 'DJI'
    },
    {
      headline: 'Goldman Sachs Upgrades Industrial Sector Outlook',
      summary: 'Analysts at Goldman Sachs raised their outlook for industrial stocks, citing improved manufacturing data and strong corporate earnings guidance for the upcoming quarter.',
      source: 'Bloomberg',
      symbol: 'GS'
    },
    {
      headline: 'Apple Announces Strategic Partnership in AI Development',
      summary: 'Apple Inc. revealed a new partnership aimed at accelerating artificial intelligence capabilities across its product lineup, potentially impacting the broader technology sector.',
      source: 'Reuters',
      symbol: 'AAPL'
    },
    {
      headline: 'Boeing Secures Major International Aircraft Order',
      summary: 'Boeing Company announced a significant order from an international carrier, boosting sentiment for the aerospace giant and related supply chain companies.',
      source: 'Financial Times',
      symbol: 'BA'
    },
    {
      headline: 'Healthcare Stocks Rally on Medicare Policy Updates',
      summary: 'UnitedHealth and other healthcare giants posted gains following clarity on Medicare reimbursement rates, providing visibility for the sector outlook.',
      source: 'CNBC',
      symbol: 'UNH'
    }
  ],
  NAS100: [
    {
      headline: 'NVIDIA Chip Demand Exceeds Expectations for AI Applications',
      summary: 'NVIDIA Corporation reported unprecedented demand for its AI-focused semiconductor products, driving the stock to new highs and lifting the broader technology sector.',
      source: 'TechCrunch',
      symbol: 'NVDA'
    },
    {
      headline: 'Meta Platforms Expands Virtual Reality Investment',
      summary: 'Meta Platforms announced increased capital allocation toward its virtual reality division, signaling continued commitment to the metaverse despite market skepticism.',
      source: 'The Verge',
      symbol: 'META'
    },
    {
      headline: 'Amazon Web Services Announces New Enterprise Solutions',
      summary: 'AWS unveiled a suite of enterprise-focused cloud solutions designed to accelerate digital transformation for large organizations.',
      source: 'ZDNet',
      symbol: 'AMZN'
    },
    {
      headline: 'Microsoft Azure Growth Outpaces Competitors',
      summary: 'Microsoft cloud division reported strong quarterly growth, with Azure services seeing accelerated enterprise adoption across multiple industries.',
      source: 'Business Insider',
      symbol: 'MSFT'
    },
    {
      headline: 'Tesla Deliveries Beat Analyst Estimates',
      summary: 'Tesla Inc. reported vehicle deliveries that exceeded Wall Street expectations, driven by strong demand in international markets and improved production efficiency.',
      source: 'Electrek',
      symbol: 'TSLA'
    }
  ],
  SPX500: [
    {
      headline: 'S&P 500 Approaches Record Highs Amid Earnings Season',
      summary: 'The S&P 500 index moved closer to all-time highs as major corporations reported better-than-expected quarterly earnings across multiple sectors.',
      source: 'Wall Street Journal',
      symbol: 'SPX'
    },
    {
      headline: 'Energy Sector Leads Market Gains on Oil Price Rally',
      summary: 'Exxon Mobil and Chevron posted significant gains as crude oil prices surged following supply concerns and increased global demand projections.',
      source: 'Oil & Gas Journal',
      symbol: 'XOM'
    },
    {
      headline: 'Consumer Staples Stocks Show Defensive Strength',
      summary: 'Procter & Gamble and Coca-Cola demonstrated resilience as investors rotated into defensive positions amid broader market volatility.',
      source: 'Barrons',
      symbol: 'PG'
    },
    {
      headline: 'Financial Sector Anticipates Rate Decision Impact',
      summary: 'Major banks including JPMorgan and Bank of America position for potential interest rate adjustments, with analysts projecting varied sector impacts.',
      source: 'Financial Times',
      symbol: 'JPM'
    },
    {
      headline: 'Pharmaceutical Innovation Drives Healthcare Rally',
      summary: 'Eli Lilly and Johnson & Johnson advanced on positive clinical trial data, highlighting ongoing innovation in the pharmaceutical industry.',
      source: 'BioPharma Dive',
      symbol: 'LLY'
    }
  ]
};

const generateTimestamp = (index) => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - (index * 15 + Math.floor(Math.random() * 30)));
  return now.toISOString();
};

export const getNewsData = async (pair) => {
  await new Promise(r => setTimeout(r, 400));
  
  const templates = NEWS_TEMPLATES[pair] || NEWS_TEMPLATES.US30;
  
  const news = templates.map((item, index) => ({
    ...item,
    datetime: generateTimestamp(index),
    url: '#',
    type: 'news'
  }));

  return { news };
};

export const getSocialNews = async (pair) => {
  await new Promise(r => setTimeout(r, 200));
  
  const socialPosts = [
    {
      headline: `${pair} showing strong momentum in early trading. Key levels holding well.`,
      source: 'Market Analyst',
      virality: 85,
      type: 'social',
      datetime: 'Just now',
      url: '#'
    },
    {
      headline: `Technical setup looking favorable for ${pair}. Watch for breakout above resistance.`,
      source: 'Trading Pro',
      virality: 72,
      type: 'social',
      datetime: new Date().toISOString(),
      url: '#'
    }
  ];

  return { social: socialPosts };
};
