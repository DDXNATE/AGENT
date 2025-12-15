import { getApiUrl } from './apiConfig';

export const getNewsData = async (pair) => {
  try {
    const response = await fetch(getApiUrl(`news?instrument=${pair}`));
    
    if (!response.ok) {
      throw new Error('Failed to fetch news');
    }
    
    const data = await response.json();
    return { news: data.news || [] };
  } catch (error) {
    console.error('Error fetching news:', error);
    return { news: [] };
  }
};

export const getSocialNews = async (pair) => {
  return { social: [] };
};
