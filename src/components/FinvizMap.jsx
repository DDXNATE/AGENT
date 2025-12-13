import { useState, useEffect } from 'react';
import '../styles/FinvizMap.css';

function FinvizMap({ selectedPair }) {
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshTime, setRefreshTime] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Real stock lists for each pair
  const STOCKS_BY_PAIR = {
    US30: [
      { symbol: 'AAPL', name: 'Apple' },
      { symbol: 'MSFT', name: 'Microsoft' },
      { symbol: 'UNH', name: 'UnitedHealth' },
      { symbol: 'GS', name: 'Goldman Sachs' },
      { symbol: 'HD', name: 'Home Depot' },
      { symbol: 'MCD', name: "McDonald's" },
      { symbol: 'CAT', name: 'Caterpillar' },
      { symbol: 'AMGN', name: 'Amgen' },
      { symbol: 'V', name: 'Visa' },
      { symbol: 'BA', name: 'Boeing' },
      { symbol: 'JPM', name: 'JPMorgan' },
      { symbol: 'JNJ', name: 'Johnson & J' },
      { symbol: 'WMT', name: 'Walmart' },
      { symbol: 'PG', name: 'Procter' },
      { symbol: 'CRM', name: 'Salesforce' }
    ],
    NAS100: [
      { symbol: 'AAPL', name: 'Apple' },
      { symbol: 'MSFT', name: 'Microsoft' },
      { symbol: 'NVDA', name: 'NVIDIA' },
      { symbol: 'AMZN', name: 'Amazon' },
      { symbol: 'META', name: 'Meta' },
      { symbol: 'GOOGL', name: 'Alphabet' },
      { symbol: 'TSLA', name: 'Tesla' },
      { symbol: 'AVGO', name: 'Broadcom' },
      { symbol: 'COST', name: 'Costco' },
      { symbol: 'NFLX', name: 'Netflix' },
      { symbol: 'QCOM', name: 'Qualcomm' },
      { symbol: 'AMD', name: 'AMD' },
      { symbol: 'INTC', name: 'Intel' },
      { symbol: 'CRM', name: 'Salesforce' },
      { symbol: 'ADBE', name: 'Adobe' }
    ],
    SPX500: [
      { symbol: 'AAPL', name: 'Apple' },
      { symbol: 'MSFT', name: 'Microsoft' },
      { symbol: 'NVDA', name: 'NVIDIA' },
      { symbol: 'AMZN', name: 'Amazon' },
      { symbol: 'META', name: 'Meta' },
      { symbol: 'GOOGL', name: 'Alphabet' },
      { symbol: 'BRK.B', name: 'Berkshire' },
      { symbol: 'JPM', name: 'JPMorgan' },
      { symbol: 'LLY', name: 'Eli Lilly' },
      { symbol: 'XOM', name: 'ExxonMobil' },
      { symbol: 'V', name: 'Visa' },
      { symbol: 'WMT', name: 'Walmart' },
      { symbol: 'JNJ', name: 'Johnson & J' },
      { symbol: 'WFC', name: 'Wells Fargo' },
      { symbol: 'PG', name: 'Procter' }
    ]
  };

  useEffect(() => {
    fetchMapData();
    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchMapData, 60000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedPair, autoRefresh]);

  const fetchMapData = async () => {
    setLoading(true);
    setError('');
    try {
      const stocks = STOCKS_BY_PAIR[selectedPair] || STOCKS_BY_PAIR.US30;
      
      // Fetch live data for each stock
      const promises = stocks.map(async (stock) => {
        try {
          const response = await fetch(`/api/stocks-quote/${stock.symbol}`);
          if (response.ok) {
            const data = await response.json();
            return {
              symbol: stock.symbol,
              name: stock.name,
              price: parseFloat(data.currentPrice) || parseFloat(data.c) || 0,
              change: parseFloat(data.change) || parseFloat(data.d) || 0,
              changePercent: parseFloat(data.percentChange) || parseFloat(data.dp) || 0
            };
          }
          return null;
        } catch (err) {
          return null;
        }
      });

      const results = await Promise.all(promises);
      const validResults = results.filter(s => s && s.price > 0 && !isNaN(s.price));
      
      if (validResults.length === 0) {
        setError('No market data available - API unreachable');
        setLoading(false);
        return;
      }
      
      validResults.sort((a, b) => b.changePercent - a.changePercent);
      
      setMapData({
        pair: selectedPair,
        stocks: validResults,
        meta: {
          gainers: validResults.filter(s => s.changePercent > 0).length,
          losers: validResults.filter(s => s.changePercent < 0).length,
          avgChange: (validResults.reduce((sum, s) => sum + s.changePercent, 0) / validResults.length).toFixed(2),
          total: validResults.length
        }
      });
      setRefreshTime(new Date());
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to load market data');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !mapData) {
    return (
      <div className="finviz-map-container">
        <div className="map-loading">
          <div className="spinner"></div>
          <p>Agent Pippy loading {selectedPair} data...</p>
        </div>
      </div>
    );
  }

  if (error && !mapData) {
    return (
      <div className="finviz-map-container">
        <div className="map-error">
          <p>⚠️ {error}</p>
          <button onClick={fetchMapData} className="retry-btn">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="finviz-map-container">
      <div className="map-header-section">
        <div className="map-title">
          <h2>Agent Pippy - {selectedPair}</h2>
          <p className="map-subtitle">Live Market Heatmap</p>
        </div>
        <div className="map-stats">
          <div className="stat">
            <span className="stat-label">Total</span>
            <span className="stat-value">{mapData?.meta?.total || 0}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Gainers</span>
            <span className="stat-value gainers">{mapData?.meta?.gainers || 0}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Losers</span>
            <span className="stat-value losers">{mapData?.meta?.losers || 0}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Avg Change</span>
            <span className="stat-value" style={{ color: (mapData?.meta?.avgChange || 0) >= 0 ? '#4CAF50' : '#F44336' }}>
              {(mapData?.meta?.avgChange || 0) >= 0 ? '+' : ''}{mapData?.meta?.avgChange || 0}%
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Updated</span>
            <span className="stat-value time-update">{refreshTime.toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      <div className="map-controls">
        <label className="auto-refresh-toggle">
          <input 
            type="checkbox" 
            checked={autoRefresh} 
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          Auto-refresh every 60s
        </label>
        <button onClick={fetchMapData} className="refresh-button" disabled={loading}>
          {loading ? 'Updating...' : '⟳ Refresh Now'}
        </button>
      </div>

      <div className="treemap-container">
        {mapData?.stocks && mapData.stocks.length > 0 ? (
          <div className="treemap-grid">
            {mapData.stocks.map((stock, idx) => {
              const isPositive = stock.changePercent >= 0;
              const absChange = Math.abs(stock.changePercent);
              const intensity = Math.min(absChange / 15, 1);

              return (
                <div
                  key={idx}
                  className="treemap-item"
                  style={{
                    backgroundColor: isPositive
                      ? `rgba(76, 175, 80, ${0.2 + intensity * 0.8})`
                      : `rgba(244, 67, 54, ${0.2 + intensity * 0.8})`,
                    borderColor: isPositive ? '#4CAF50' : '#F44336'
                  }}
                  onMouseEnter={() => {}}
                  onMouseLeave={() => {}}
                  title={`$${stock.price.toFixed(2)} (${isPositive ? '+' : ''}${stock.changePercent.toFixed(2)}%)`}
                >
                  <div className="item-content">
                    <div className="stock-symbol">{stock.symbol}</div>
                    {stock.price > 0 && <div className="stock-price">${stock.price.toFixed(2)}</div>}
                    <div className="stock-change" style={{ color: isPositive ? '#4CAF50' : '#F44336' }}>
                      {isPositive ? '▲' : '▼'} {Math.abs(stock.changePercent).toFixed(2)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <p>No live data available. Check API connection.</p>
          </div>
        )}
      </div>

      <div className="map-legend">
        <div className="legend-color strong-gain">Strong Gainers ({'>'}10%)</div>
        <div className="legend-color moderate-gain">Moderate Gainers (5-10%)</div>
        <div className="legend-color neutral">Neutral</div>
        <div className="legend-color moderate-loss">Moderate Losers (5-10%)</div>
        <div className="legend-color strong-loss">Strong Losers ({'>'}10%)</div>
      </div>

      <div className="map-info">
        <p>Agent Pippy | Live Market Data | Updates every 60 seconds</p>
      </div>
    </div>
  );
}

export default FinvizMap;
