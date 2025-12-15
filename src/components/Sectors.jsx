import { useState, useEffect } from 'react'
import '../styles/Sectors.css'
import { getSectorsData } from '../services/sectorsService'

export default function Sectors() {
  const [sectorsData, setSectorsData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSectorsData()
  }, [])

  const fetchSectorsData = async () => {
    setLoading(true)
    try {
      const data = await getSectorsData()
      setSectorsData(data.sectors || [])
    } catch (error) {
      console.error('Error fetching sectors:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSectorColor = (change) => {
    if (change >= 2) return '#00a854'
    if (change > 0) return '#00d46a'
    if (change >= -2) return '#ff7875'
    return '#ff4d4f'
  }

  return (
    <div className="sectors-section">
      <div className="sectors-header">
        <div className="sectors-title-group">
          <h1 className="sectors-main-title">Sector Performance</h1>
          <p className="sectors-subtitle">Real-time sector analysis powered by Agent Pippy</p>
        </div>
        <button
          className={`refresh-btn ${loading ? 'loading' : ''}`}
          onClick={fetchSectorsData}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {loading && sectorsData.length === 0 ? (
        <div className="loading-spinner">Loading sector data...</div>
      ) : (
        <div className="sectors-grid">
          {sectorsData.map((sector, i) => (
            <div key={i} className="sector-card">
              <div className="sector-header">
                <div className="sector-name">{sector.name}</div>
                <div className="sector-performance" style={{ color: getSectorColor(sector.change) }}>
                  {sector.change >= 0 ? '+' : ''}{sector.change?.toFixed(2) || '0.00'}%
                </div>
              </div>
              <div className="sector-chart-container">
                <div className="sector-chart">
                  {sector.stocks?.slice(0, 5).map((stock, idx) => (
                    <div
                      key={idx}
                      className="sector-mini-bar"
                      style={{
                        height: `${Math.max(20, Math.min(100, 50 + stock.change))}%`,
                        backgroundColor: getSectorColor(stock.change)
                      }}
                      title={`${stock.symbol}: ${stock.change >= 0 ? '+' : ''}${stock.change?.toFixed(2)}%`}
                    />
                  ))}
                </div>
              </div>
              <div className="sector-stats">
                <div className="stat">
                  <span className="stat-label">Stocks</span>
                  <span className="stat-value">{sector.stocks?.length || 0}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Avg Change</span>
                  <span className="stat-value" style={{ color: getSectorColor(sector.avgChange) }}>
                    {sector.avgChange >= 0 ? '+' : ''}{sector.avgChange?.toFixed(2)}%
                  </span>
                </div>
              </div>
              <div className="sector-stocks-preview">
                {sector.stocks?.slice(0, 3).map((stock, idx) => (
                  <div key={idx} className="stock-preview">
                    <span className="preview-symbol">{stock.symbol}</span>
                    <span className="preview-change" style={{ color: getSectorColor(stock.change) }}>
                      {stock.change >= 0 ? '+' : ''}{stock.change?.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {sectorsData.length === 0 && !loading && (
            <p className="no-data">No sector data available. Check API connection.</p>
          )}
        </div>
      )}

      <div className="sectors-footer">
        <p>Sector data powered by Agent Pippy • Real-time market analysis</p>
      </div>
    </div>
  )
}
