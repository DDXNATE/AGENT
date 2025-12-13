import { useState, useEffect } from 'react';
import '../styles/FinvizMap.css';

function FinvizMap({ selectedPair }) {
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshTime, setRefreshTime] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchScreenerData();
    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchScreenerData, 60000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedPair, autoRefresh]);

  const fetchScreenerData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/screener/${selectedPair}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`);
      }
      const data = await response.json();
      
      if (!data.stocks || data.stocks.length === 0) {
        setError('No market data available');
        setLoading(false);
        return;
      }
      
      setMapData({
        pair: data.pair,
        stocks: data.stocks,
        meta: data.meta
      });
      setRefreshTime(new Date());
    } catch (err) {
      console.error('Screener Error:', err);
      setError(err.message || 'Failed to load market data');
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
          <p>{error}</p>
          <button onClick={fetchScreenerData} className="retry-btn">Retry</button>
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
        <button onClick={fetchScreenerData} className="refresh-button" disabled={loading}>
          {loading ? 'Updating...' : 'Refresh Now'}
        </button>
      </div>

      <div className="treemap-container">
        {mapData?.stocks && mapData.stocks.length > 0 ? (
          <div className="treemap-grid">
            {mapData.stocks.map((stock, idx) => {
              const isPositive = stock.changePercent >= 0;
              const absChange = Math.abs(stock.changePercent);
              const intensity = Math.min(absChange / 8, 1);

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
                  title={`$${stock.price.toFixed(2)} (${isPositive ? '+' : ''}${stock.changePercent.toFixed(2)}%)`}
                >
                  <div className="item-content">
                    <div className="stock-symbol">{stock.symbol}</div>
                    {stock.price > 0 && <div className="stock-price">${stock.price.toFixed(2)}</div>}
                    <div className="stock-change" style={{ color: isPositive ? '#4CAF50' : '#F44336' }}>
                      {isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%
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
        <div className="legend-color strong-gain">Strong Gainers ({'>'}5%)</div>
        <div className="legend-color moderate-gain">Moderate Gainers (2-5%)</div>
        <div className="legend-color neutral">Neutral</div>
        <div className="legend-color moderate-loss">Moderate Losers (2-5%)</div>
        <div className="legend-color strong-loss">Strong Losers ({'>'}5%)</div>
      </div>

      <div className="map-info">
        <p>Agent Pippy | Live Market Data | Updates every 60 seconds</p>
      </div>
    </div>
  );
}

export default FinvizMap;
