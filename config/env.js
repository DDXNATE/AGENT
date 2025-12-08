const REQUIRED_SECRETS = {
  GEMINI_API_KEY: {
    required: false,
    description: 'Google Gemini AI API key',
    getUrl: 'https://aistudio.google.com/apikey'
  },
  GROQ_API_KEY: {
    required: false,
    description: 'Groq AI API key',
    getUrl: 'https://console.groq.com/keys'
  },
  FINNHUB_API_KEY: {
    required: false,
    description: 'Finnhub stock data API key',
    getUrl: 'https://finnhub.io/'
  },
  ALPHA_VANTAGE_API_KEY: {
    required: false,
    description: 'Alpha Vantage financial data API key',
    getUrl: 'https://www.alphavantage.co/support/#api-key'
  }
};

function checkEnvironment() {
  const missing = [];
  const available = [];
  
  console.log('\n========================================');
  console.log('   Agent Pippy - Environment Check');
  console.log('========================================\n');
  
  for (const [key, config] of Object.entries(REQUIRED_SECRETS)) {
    if (process.env[key]) {
      available.push(key);
      console.log(`✓ ${key} - Available`);
    } else {
      missing.push({ key, ...config });
      console.log(`✗ ${key} - Missing`);
    }
  }
  
  console.log('\n----------------------------------------');
  
  if (missing.length > 0) {
    console.log('\nMissing API Keys:');
    console.log('To add them in Replit:');
    console.log('1. Click the "Secrets" tab (lock icon) in the left panel');
    console.log('2. Add each key listed below:\n');
    
    for (const { key, description, getUrl } of missing) {
      console.log(`   ${key}`);
      console.log(`   Description: ${description}`);
      console.log(`   Get one at: ${getUrl}\n`);
    }
  }
  
  if (available.length === Object.keys(REQUIRED_SECRETS).length) {
    console.log('\n✓ All API keys configured! Full functionality enabled.\n');
  } else if (available.length > 0) {
    console.log(`\n⚠ Partial configuration: ${available.length}/${Object.keys(REQUIRED_SECRETS).length} keys set.`);
    console.log('Some features may be limited.\n');
  } else {
    console.log('\n⚠ No API keys configured. App will run with limited functionality.\n');
  }
  
  console.log('========================================\n');
  
  return {
    missing,
    available,
    isFullyConfigured: missing.length === 0,
    hasAI: available.includes('GEMINI_API_KEY') && available.includes('GROQ_API_KEY'),
    hasMarketData: available.includes('FINNHUB_API_KEY')
  };
}

function getEnvStatus() {
  return {
    geminiReady: !!process.env.GEMINI_API_KEY,
    groqReady: !!process.env.GROQ_API_KEY,
    finnhubReady: !!process.env.FINNHUB_API_KEY,
    alphaVantageReady: !!process.env.ALPHA_VANTAGE_API_KEY
  };
}

export { checkEnvironment, getEnvStatus, REQUIRED_SECRETS };
