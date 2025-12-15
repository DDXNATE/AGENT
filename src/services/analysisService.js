import { getApiUrl } from './apiConfig';

export const generateAnalysis = async (pair) => {
  try {
    const response = await fetch(getApiUrl(`analyze?instrument=${pair}`));
    
    if (!response.ok) {
      throw new Error('Failed to generate analysis');
    }
    
    const data = await response.json();
    
    if (data.success && data.analysis) {
      return {
        summary: data.analysis.summary,
        keyLevels: data.analysis.levels,
        volatility: data.signals?.volatility || 'Normal',
        trend: data.analysis.bias?.toLowerCase() || 'neutral',
        recommendation: data.analysis.drivers?.[0] || 'Monitor key levels',
        confidence: data.analysis.confidence,
        drivers: data.analysis.drivers,
        invalidation: data.analysis.invalidation
      };
    }
    
    throw new Error('Invalid analysis response');
  } catch (error) {
    console.error('Analysis error:', error);
    return {
      summary: 'Analysis temporarily unavailable. Please try again.',
      keyLevels: { support: [], resistance: [] },
      volatility: 'Unknown',
      trend: 'neutral',
      recommendation: 'Unable to generate recommendation at this time.'
    };
  }
};

export const generateTradingPlan = async (pair, stocksData, newsData) => {
  try {
    const response = await fetch(getApiUrl(`analyze?instrument=${pair}`));
    
    if (!response.ok) {
      throw new Error('Failed to generate trading plan');
    }
    
    const data = await response.json();
    
    if (data.success && data.analysis) {
      const analysis = data.analysis;
      const gainers = stocksData?.stocks?.filter(s => s.percentChange > 0) || [];
      const losers = stocksData?.stocks?.filter(s => s.percentChange < 0) || [];
      
      const topGainers = gainers.slice(0, 3).map(s => s.symbol).join(', ') || 'N/A';
      const topLosers = losers.slice(0, 3).map(s => s.symbol).join(', ') || 'N/A';

      return {
        success: true,
        pair,
        generatedAt: new Date().toISOString(),
        marketBias: analysis.bias,
        plan: {
          overview: analysis.summary,
          keyLevels: {
            support: analysis.levels?.support?.join(', ') || 'See analysis',
            resistance: analysis.levels?.resistance?.join(', ') || 'See analysis',
            pivot: 'Calculated from session data'
          },
          topMovers: { gainers: topGainers, losers: topLosers },
          strategy: analysis.drivers?.slice(0, 2).join('. ') || 'Monitor key levels',
          riskManagement: analysis.invalidation || 'Use position sizing of 1-2% per trade.',
          timeframe: `${analysis.session} session focus`,
          watchPoints: analysis.drivers || []
        }
      };
    }
    
    throw new Error('Invalid response');
  } catch (error) {
    console.error('Trading plan error:', error);
    return { success: false, error: error.message };
  }
};

export const generateChatResponse = async (message, pair, history = []) => {
  try {
    const response = await fetch(getApiUrl('chat'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        instrument: pair,
        history
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to get chat response');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Chat error:', error);
    return {
      reply: 'I apologize, but I am unable to process your request at the moment. Please try again.'
    };
  }
};
