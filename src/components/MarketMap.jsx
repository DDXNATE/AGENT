import { useState, useEffect } from 'react';

function MarketMap({ selectedPair }) {
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hoveredItem, setHoveredItem] = useState(null);

  useEffect(() => {
    fetchMapData(selectedPair);
  }, [selectedPair]);

  const fetchMapData = async (pair) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/market-map/${pair}`);
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Map data received:', data);
      if (!data || !data.sectors) {
        throw new Error('Invalid data format: missing sectors');
      }
      setMapData(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching map data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="market-map-container">
        <div className="loading-state">
          <div className="spinner-large"></div>
          <p>Loading market heatmap...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="market-map-container">
        <div className="error-state">
          <p>⚠️ {error}</p>
          <button onClick={() => fetchMapData(selectedPair)} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="market-map-container">
      <div className="map-header">
        <h2>Market Heatmap - {selectedPair}</h2>
        <p className="map-subtitle">Market sectors and performance visualization</p>
      </div>

      {mapData && mapData.sectors ? (
        <div className="heatmap-grid">
          {mapData.sectors.map((sector, idx) => {
            const changePercent = sector.change || 0;
            const size = sector.marketCap ? Math.sqrt(sector.marketCap) : 100;
            const isPositive = changePercent >= 0;
            const intensity = Math.min(Math.abs(changePercent) / 10, 1);

            return (
              <div
                key={idx}
                className="heatmap-item"
                style={{
                  width: `${Math.max(size * 0.5, 60)}px`,
                  height: `${Math.max(size * 0.5, 60)}px`,
                  backgroundColor: isPositive
                    ? `rgba(76, 175, 80, ${0.3 + intensity * 0.7})`
                    : `rgba(244, 67, 54, ${0.3 + intensity * 0.7})`,
                  borderColor: isPositive ? '#4CAF50' : '#F44336',
                  borderWidth: '2px',
                  borderStyle: 'solid'
                }}
                onMouseEnter={() => setHoveredItem(sector.id)}
                onMouseLeave={() => setHoveredItem(null)}
                title={`${sector.symbol}: ${isPositive ? '+' : ''}${changePercent.toFixed(2)}%`}
              >
                <div className="heatmap-symbol">{sector.symbol}</div>
                <div className="heatmap-change" style={{ color: isPositive ? '#4CAF50' : '#F44336' }}>
                  {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-map">
          <p>No heatmap data available for {selectedPair}</p>
        </div>
      )}

      <div className="map-legend">
        <div className="legend-item">
          <div className="legend-box" style={{ backgroundColor: 'rgba(76, 175, 80, 0.7)' }}></div>
          <span>Gainers</span>
        </div>
        <div className="legend-item">
          <div className="legend-box" style={{ backgroundColor: 'rgba(244, 67, 54, 0.7)' }}></div>
          <span>Losers</span>
        </div>
        <div className="legend-item">
          <span className="legend-note">Size = Market Cap | Color Intensity = Change %</span>
        </div>
      </div>
    </div>
  );
}

export default MarketMap;
