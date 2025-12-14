import { useState, useEffect } from 'react'
import '../styles/InsiderTrading.css'

export default function InsiderTrading() {
  const [insiderData, setInsiderData] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('all')

  useEffect(() => {
    fetchInsiderData()
  }, [])

  const fetchInsiderData = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/insider-trading')
      const data = await response.json()
      setInsiderData(data.trades || [])
    } catch (error) {
      console.error('Error fetching insider data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTradeColor = (type) => {
    if (type === 'buy') return '#00a854'
    if (type === 'sell') return '#ff7875'
    return '#1890ff'
  }

  const filteredData = filterType === 'all' 
    ? insiderData 
    : insiderData.filter(trade => trade.type === filterType)

  return (
    <div className="insider-section">
      <div className="insider-header">
        <div className="insider-title-group">
          <h1 className="insider-main-title">Insider Trading Activity</h1>
          <p className="insider-subtitle">Monitor executive and insider transactions powered by Agent Pippy</p>
        </div>
        <div className="insider-controls">
          <div className="filter-buttons">
            <button
              className={`filter-btn ${filterType === 'all' ? 'active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              All Trades
            </button>
            <button
              className={`filter-btn ${filterType === 'buy' ? 'active' : ''}`}
              onClick={() => setFilterType('buy')}
            >
              Buys
            </button>
            <button
              className={`filter-btn ${filterType === 'sell' ? 'active' : ''}`}
              onClick={() => setFilterType('sell')}
            >
              Sells
            </button>
          </div>
          <button
            className={`refresh-btn ${loading ? 'loading' : ''}`}
            onClick={fetchInsiderData}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {loading && insiderData.length === 0 ? (
        <div className="loading-spinner">Loading insider trading data...</div>
      ) : (
        <div className="insider-container">
          <table className="insider-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Symbol</th>
                <th>Insider</th>
                <th>Type</th>
                <th>Shares</th>
                <th>Price</th>
                <th>Value</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.slice(0, 50).map((trade, i) => (
                <tr key={i} className={`trade-row ${trade.type}`}>
                  <td className="company-name">{trade.companyName}</td>
                  <td className="company-symbol">{trade.symbol}</td>
                  <td className="insider-name">{trade.insiderName}</td>
                  <td className="trade-type">
                    <span
                      className={`trade-badge ${trade.type}`}
                      style={{ backgroundColor: getTradeColor(trade.type) }}
                    >
                      {trade.type === 'buy' ? '↑ Buy' : '↓ Sell'}
                    </span>
                  </td>
                  <td className="trade-shares">{trade.shares?.toLocaleString()}</td>
                  <td className="trade-price">${trade.price?.toFixed(2)}</td>
                  <td className="trade-value">
                    ${(trade.shares * trade.price)?.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="trade-date">{new Date(trade.date).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredData.length === 0 && !loading && (
            <div className="no-data-container">
              <p className="no-data">No insider trading data available for selected filter.</p>
            </div>
          )}
        </div>
      )}

      <div className="insider-stats">
        <div className="stat-card">
          <div className="stat-label">Total Trades</div>
          <div className="stat-value">{insiderData.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Buys</div>
          <div className="stat-value" style={{ color: '#00a854' }}>
            {insiderData.filter(t => t.type === 'buy').length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Sells</div>
          <div className="stat-value" style={{ color: '#ff7875' }}>
            {insiderData.filter(t => t.type === 'sell').length}
          </div>
        </div>
      </div>

      <div className="insider-footer">
        <p>Insider trading data powered by Agent Pippy • SEC filing data</p>
      </div>
    </div>
  )
}
