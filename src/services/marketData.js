import { getApiUrl } from './apiConfig';

export const getStocksData = async (pair) => {
  try {
    const response = await fetch(getApiUrl(`market-data?instrument=${pair}`));
    
    if (!response.ok) {
      throw new Error('Failed to fetch market data');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching stocks data:', error);
    return { stocks: [], meta: null };
  }
};

export const getScreenerData = async (pair) => {
  const data = await getStocksData(pair);
  return {
    pair,
    stocks: data.stocks?.map(s => ({
      symbol: s.symbol,
      name: s.name,
      price: s.currentPrice,
      changePercent: s.percentChange,
      sector: s.sector
    })) || [],
    meta: data.meta
  };
};

export const getMarketMapData = async (pair) => {
  return getScreenerData(pair);
};
