import { useState, useRef, useEffect } from 'react'
import './App.css'

const TRADING_PAIRS = ['US30', 'NAS100', 'SPX500'];
const TIMEFRAMES = ['15m', '1hr', '4hr', 'daily'];

function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('chat')
  const [selectedPair, setSelectedPair] = useState('US30')
  const [stocks, setStocks] = useState([])
  const [stocksMeta, setStocksMeta] = useState(null)
  const [news, setNews] = useState([])
  const [charts, setCharts] = useState({})
  const [uploading, setUploading] = useState(false)
  const [uploadTimeframe, setUploadTimeframe] = useState('daily')
  const [stocksLoading, setStocksLoading] = useState(false)
  const [newsLoading, setNewsLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [chartAnalysis, setChartAnalysis] = useState(null)
  const [trades, setTrades] = useState([])
  const [tradeStats, setTradeStats] = useState(null)
  const [tradesLoading, setTradesLoading] = useState(false)
  const [showTradeForm, setShowTradeForm] = useState(false)
  const [closingTrade, setClosingTrade] = useState(null)
  const [editingTrade, setEditingTrade] = useState(null)
  const [tradeFormMode, setTradeFormMode] = useState('new') // 'new', 'edit', 'quick'
  const [tradeForm, setTradeForm] = useState({
    pair: 'US30',
    direction: 'LONG',
    entry_price: '',
    exit_price: '',
    stop_loss: '',
    take_profit: '',
    position_size: '1',
    pnl: '',
    status: 'OPEN',
    timeframe: 'daily',
    setup_type: '',
    notes: ''
  })
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (activeTab === 'stocks') {
      fetchStocks(selectedPair)
    } else if (activeTab === 'news') {
      fetchNews(selectedPair)
    } else if (activeTab === 'charts') {
      fetchCharts(selectedPair)
    } else if (activeTab === 'journal') {
      fetchTrades()
      fetchTradeStats()
    }
  }, [activeTab, selectedPair])

  const fetchStocks = async (pair) => {
    setStocksLoading(true)
    try {
      const response = await fetch(`/api/stocks/${pair}`)
      const data = await response.json()
      setStocks(data.stocks || [])
      setStocksMeta(data.meta || null)
    } catch (error) {
      console.error('Error fetching stocks:', error)
    } finally {
      setStocksLoading(false)
    }
  }

  useEffect(() => {
    let interval
    if (activeTab === 'stocks' && autoRefresh) {
      interval = setInterval(() => {
        fetchStocks(selectedPair)
      }, 30000)
    }
    return () => clearInterval(interval)
  }, [activeTab, selectedPair, autoRefresh])

  const fetchNews = async (pair) => {
    setNewsLoading(true)
    try {
      const response = await fetch(`/api/news/${pair}`)
      const data = await response.json()
      setNews(data.news || [])
    } catch (error) {
      console.error('Error fetching news:', error)
    } finally {
      setNewsLoading(false)
    }
  }

  const fetchCharts = async (pair) => {
    try {
      const response = await fetch(`/api/charts/${pair}`)
      const data = await response.json()
      setCharts(data || {})
    } catch (error) {
      console.error('Error fetching charts:', error)
    }
  }

  const analyzeCharts = async (timeframe = null) => {
    setAnalyzing(true)
    setChartAnalysis(null)
    try {
      const response = await fetch('/api/analyze-chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pair: selectedPair, timeframe })
      })
      const data = await response.json()
      if (data.success) {
        setChartAnalysis(data)
      } else {
        setChartAnalysis({ error: data.error })
      }
    } catch (error) {
      console.error('Error analyzing charts:', error)
      setChartAnalysis({ error: 'Failed to analyze charts' })
    } finally {
      setAnalyzing(false)
    }
  }

  const quickAnalysis = async (timeframe) => {
    setAnalyzing(true)
    try {
      const response = await fetch('/api/quick-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pair: selectedPair, timeframe })
      })
      const data = await response.json()
      if (data.success) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `**Quick Analysis - ${selectedPair} ${timeframe}:**\n\n${data.analysis}\n\n_Processed in ${data.processingTimeMs}ms_` 
        }])
        setActiveTab('chat')
      }
    } catch (error) {
      console.error('Error in quick analysis:', error)
    } finally {
      setAnalyzing(false)
    }
  }

  const fetchTrades = async () => {
    setTradesLoading(true)
    try {
      const response = await fetch('/api/trades')
      const data = await response.json()
      setTrades(data.trades || [])
    } catch (error) {
      console.error('Error fetching trades:', error)
    } finally {
      setTradesLoading(false)
    }
  }

  const fetchTradeStats = async () => {
    try {
      const response = await fetch('/api/trades/stats')
      const data = await response.json()
      setTradeStats(data.stats || null)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const resetTradeForm = () => {
    setTradeForm({
      pair: selectedPair,
      direction: 'LONG',
      entry_price: '',
      exit_price: '',
      stop_loss: '',
      take_profit: '',
      position_size: '1',
      pnl: '',
      status: 'OPEN',
      timeframe: 'daily',
      setup_type: '',
      notes: ''
    })
    setEditingTrade(null)
    setTradeFormMode('new')
  }

  const handleCreateTrade = async (e) => {
    e.preventDefault()
    try {
      // If editing, update instead of create
      if (editingTrade) {
        const response = await fetch(`/api/trades/${editingTrade.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tradeForm)
        })
        const data = await response.json()
        if (data.success) {
          setShowTradeForm(false)
          resetTradeForm()
          fetchTrades()
          fetchTradeStats()
        }
        return
      }
      
      // Quick log mode - create and immediately close with P&L
      if (tradeFormMode === 'quick' && tradeForm.pnl) {
        const response = await fetch('/api/trades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...tradeForm,
            entry_price: tradeForm.entry_price || 0
          })
        })
        const data = await response.json()
        if (data.success && data.trade) {
          // Immediately update with P&L and status
          await fetch(`/api/trades/${data.trade.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              exit_price: tradeForm.exit_price || tradeForm.entry_price || 0,
              pnl: parseFloat(tradeForm.pnl),
              status: tradeForm.status || (parseFloat(tradeForm.pnl) >= 0 ? 'WIN' : 'LOSS'),
              exit_date: new Date()
            })
          })
          setShowTradeForm(false)
          resetTradeForm()
          fetchTrades()
          fetchTradeStats()
        }
        return
      }
      
      // Regular create
      const response = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tradeForm)
      })
      const data = await response.json()
      if (data.success) {
        setShowTradeForm(false)
        resetTradeForm()
        fetchTrades()
        fetchTradeStats()
      }
    } catch (error) {
      console.error('Error creating trade:', error)
    }
  }

  const handleEditTrade = (trade) => {
    setEditingTrade(trade)
    setTradeFormMode('edit')
    setTradeForm({
      pair: trade.pair,
      direction: trade.direction,
      entry_price: trade.entry_price || '',
      exit_price: trade.exit_price || '',
      stop_loss: trade.stop_loss || '',
      take_profit: trade.take_profit || '',
      position_size: trade.position_size || '1',
      pnl: trade.pnl || '',
      status: trade.status || 'OPEN',
      timeframe: trade.timeframe || 'daily',
      setup_type: trade.setup_type || '',
      notes: trade.notes || ''
    })
    setShowTradeForm(true)
  }

  const openQuickLogForm = () => {
    resetTradeForm()
    setTradeFormMode('quick')
    setTradeForm(prev => ({ ...prev, pair: selectedPair }))
    setShowTradeForm(true)
  }

  const handleCloseTrade = async (e) => {
    e.preventDefault()
    if (!closingTrade) return
    
    const formData = new FormData(e.target)
    const exitPrice = formData.get('exit_price')
    const status = formData.get('status')
    
    try {
      const response = await fetch(`/api/trades/${closingTrade.id}/close`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exit_price: exitPrice, status })
      })
      const data = await response.json()
      if (data.success) {
        setClosingTrade(null)
        fetchTrades()
        fetchTradeStats()
      }
    } catch (error) {
      console.error('Error closing trade:', error)
    }
  }

  const handleDeleteTrade = async (id) => {
    if (!confirm('Delete this trade?')) return
    try {
      await fetch(`/api/trades/${id}`, { method: 'DELETE' })
      fetchTrades()
      fetchTradeStats()
    } catch (error) {
      console.error('Error deleting trade:', error)
    }
  }

  const handleChartUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('chart', file)
    formData.append('pair', selectedPair)
    formData.append('timeframe', uploadTimeframe)

    try {
      const response = await fetch('/api/upload-chart', {
        method: 'POST',
        body: formData
      })
      const data = await response.json()
      if (data.success) {
        fetchCharts(selectedPair)
      }
    } catch (error) {
      console.error('Error uploading chart:', error)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          pair: selectedPair,
          history: messages.slice(-10)
        })
      })

      const data = await response.json()

      if (response.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
        
        // If a trade action was performed, refresh the trades list
        if (data.tradeAction && data.tradeAction.success) {
          fetchTrades()
          fetchTradeStats()
        }
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.error || 'Sorry, I encountered an error. Please try again.',
          error: true 
        }])
      }
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Unable to connect. Please check your connection and try again.',
        error: true 
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const quickCommands = [
    { label: 'Analyze my charts', cmd: `Hey Pippy, analyze my charts for ${selectedPair}` },
    { label: 'Major stocks update', cmd: `Hey Pippy, what are major stocks doing for ${selectedPair}?` },
    { label: 'Market news', cmd: `Hey Pippy, any news affecting ${selectedPair}?` },
    { label: 'Trading setup', cmd: `Hey Pippy, what trading setups do you see for ${selectedPair}?` }
  ]

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-content">
          <div className="logo-section">
            <h1>Agent Pippy</h1>
            <p className="subtitle">AI Trading Assistant</p>
          </div>
          <div className="pair-selector">
            {TRADING_PAIRS.map(pair => (
              <button
                key={pair}
                className={`pair-btn ${selectedPair === pair ? 'active' : ''}`}
                onClick={() => setSelectedPair(pair)}
              >
                {pair}
              </button>
            ))}
          </div>
        </div>
      </header>

      <nav className="tab-nav">
        <button 
          className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          Chat
        </button>
        <button 
          className={`tab-btn ${activeTab === 'charts' ? 'active' : ''}`}
          onClick={() => setActiveTab('charts')}
        >
          Charts
        </button>
        <button 
          className={`tab-btn ${activeTab === 'stocks' ? 'active' : ''}`}
          onClick={() => setActiveTab('stocks')}
        >
          Screener
        </button>
        <button 
          className={`tab-btn ${activeTab === 'news' ? 'active' : ''}`}
          onClick={() => setActiveTab('news')}
        >
          News
        </button>
        <button 
          className={`tab-btn ${activeTab === 'journal' ? 'active' : ''}`}
          onClick={() => setActiveTab('journal')}
        >
          Journal
        </button>
      </nav>

      <main className="main-content">
        {activeTab === 'chat' && (
          <div className="chat-section">
            <div className="quick-commands">
              {quickCommands.map((qc, i) => (
                <button 
                  key={i} 
                  className="quick-cmd-btn"
                  onClick={() => setInput(qc.cmd)}
                >
                  {qc.label}
                </button>
              ))}
            </div>
            
            <div className="chat-container">
              <div className="messages-container">
                {messages.length === 0 && (
                  <div className="welcome-message">
                    <h2>Hey there! I'm Pippy</h2>
                    <p>
                      Your AI trading assistant for <strong>{selectedPair}</strong>. 
                      Upload your charts, check live stock prices, or ask me anything about trading!
                    </p>
                    <div className="welcome-features">
                      <div className="feature">
                        <span className="feature-icon">📈</span>
                        <span>Upload & analyze charts</span>
                      </div>
                      <div className="feature">
                        <span className="feature-icon">💹</span>
                        <span>Real-time stock screener</span>
                      </div>
                      <div className="feature">
                        <span className="feature-icon">📰</span>
                        <span>Live market news</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {messages.map((msg, index) => (
                  <div 
                    key={index} 
                    className={`message ${msg.role} ${msg.error ? 'error' : ''}`}
                  >
                    {msg.role === 'assistant' && <span className="msg-label">Pippy</span>}
                    {msg.role === 'user' && <span className="msg-label">You</span>}
                    <div className="msg-content">{msg.content}</div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="typing-indicator">
                    <span className="msg-label">Pippy is thinking...</span>
                    <div className="dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              <form className="input-container" onSubmit={sendMessage}>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`Ask Pippy about ${selectedPair}...`}
                  disabled={isLoading}
                />
                <button type="submit" disabled={isLoading || !input.trim()}>
                  Send
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'charts' && (
          <div className="charts-section">
            <div className="upload-section">
              <h3>Upload Chart for {selectedPair}</h3>
              <div className="upload-controls">
                <select 
                  value={uploadTimeframe} 
                  onChange={(e) => setUploadTimeframe(e.target.value)}
                  className="timeframe-select"
                >
                  {TIMEFRAMES.map(tf => (
                    <option key={tf} value={tf}>{tf}</option>
                  ))}
                </select>
                <label className="upload-btn">
                  {uploading ? 'Uploading...' : 'Choose Chart Image'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleChartUpload}
                    disabled={uploading}
                    hidden
                  />
                </label>
                <button 
                  className={`analyze-btn ${analyzing ? 'loading' : ''}`}
                  onClick={() => analyzeCharts()}
                  disabled={analyzing || Object.keys(charts).length === 0}
                >
                  {analyzing ? 'Analyzing...' : 'AI Analyze All Charts'}
                </button>
              </div>
            </div>

            {chartAnalysis && (
              <div className="analysis-results">
                {chartAnalysis.error ? (
                  <div className="analysis-error">{chartAnalysis.error}</div>
                ) : (
                  <>
                    <div className="analysis-header">
                      <h4>AI Technical Analysis - {chartAnalysis.pair}</h4>
                      <span className="analysis-meta">
                        {chartAnalysis.meta?.chartsAnalyzed} chart(s) analyzed in {chartAnalysis.meta?.processingTimeMs}ms
                      </span>
                    </div>
                    {chartAnalysis.analyses?.map((analysis, i) => (
                      <div key={i} className="analysis-card">
                        <div className="analysis-tf-badge">{analysis.timeframe}</div>
                        <div className="analysis-content">{analysis.analysis}</div>
                        <div className="analysis-timestamp">
                          Analyzed: {new Date(analysis.analyzedAt).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            <div className="charts-grid">
              {TIMEFRAMES.map(tf => (
                <div key={tf} className="chart-timeframe-section">
                  <div className="chart-section-header">
                    <h4>{tf.toUpperCase()} Charts</h4>
                    {charts[tf]?.length > 0 && (
                      <button 
                        className="quick-analyze-btn"
                        onClick={() => quickAnalysis(tf)}
                        disabled={analyzing}
                      >
                        Quick Analyze
                      </button>
                    )}
                  </div>
                  <div className="chart-list">
                    {charts[tf]?.length > 0 ? (
                      charts[tf].map((chart, i) => (
                        <div key={i} className="chart-item">
                          <img src={chart.path} alt={`${selectedPair} ${tf}`} />
                          <span className="chart-date">
                            {new Date(chart.uploadedAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="no-charts">No {tf} charts uploaded yet</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'stocks' && (
          <div className="stocks-section">
            <div className="stocks-header">
              <h3>Major Stocks - {selectedPair}</h3>
              <div className="stocks-controls">
                <button 
                  className={`refresh-btn ${stocksLoading ? 'loading' : ''}`}
                  onClick={() => fetchStocks(selectedPair)}
                  disabled={stocksLoading}
                >
                  {stocksLoading ? 'Refreshing...' : 'Refresh'}
                </button>
                <label className="auto-refresh-toggle">
                  <input 
                    type="checkbox" 
                    checked={autoRefresh} 
                    onChange={(e) => setAutoRefresh(e.target.checked)} 
                  />
                  Auto-refresh (30s)
                </label>
              </div>
            </div>
            
            {stocksMeta && (
              <div className="market-status-bar">
                <div className={`market-indicator ${stocksMeta.marketStatus?.isOpen ? 'open' : 'closed'}`}>
                  <span className="status-dot"></span>
                  <span>{stocksMeta.marketStatus?.status}</span>
                </div>
                <div className="data-quality">
                  <span className={`quality-badge ${stocksMeta.dataQuality}`}>
                    Data: {stocksMeta.dataQuality}
                  </span>
                </div>
                <div className="last-updated">
                  Updated: {new Date(stocksMeta.lastUpdated).toLocaleTimeString()}
                  <span className="fetch-time">({stocksMeta.fetchTimeMs}ms)</span>
                </div>
              </div>
            )}
            
            {stocksLoading && stocks.length === 0 ? (
              <div className="loading-spinner">Loading live prices...</div>
            ) : (
              <div className="stocks-grid">
                {stocks.map((stock, i) => (
                  <div key={i} className={`stock-card ${stock.change >= 0 ? 'positive' : 'negative'}`}>
                    <div className="stock-header">
                      <span className="stock-symbol">{stock.symbol}</span>
                      <span className="stock-name">{stock.name}</span>
                      {stock.dataStatus && stock.dataStatus !== 'live' && (
                        <span className={`data-status-badge ${stock.dataStatus}`}>
                          {stock.dataStatus}
                        </span>
                      )}
                    </div>
                    <div className="stock-price">
                      ${stock.currentPrice?.toFixed(2) || 'N/A'}
                    </div>
                    <div className="stock-change">
                      <span className="change-value">
                        {stock.change >= 0 ? '+' : ''}{stock.change?.toFixed(2) || '0.00'}
                      </span>
                      <span className="change-percent">
                        ({stock.change >= 0 ? '+' : ''}{stock.percentChange?.toFixed(2) || '0.00'}%)
                      </span>
                    </div>
                    <div className="stock-range">
                      <span>L: ${stock.low?.toFixed(2)}</span>
                      <span>H: ${stock.high?.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
                {stocks.length === 0 && !stocksLoading && (
                  <p className="no-data">No stock data available. Check API connection.</p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'news' && (
          <div className="news-section">
            <h3>Latest News - {selectedPair}</h3>
            {newsLoading ? (
              <div className="loading-spinner">Loading news...</div>
            ) : (
              <div className="news-list">
                {news.map((item, i) => (
                  <a 
                    key={i} 
                    href={item.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="news-card"
                  >
                    <div className="news-meta">
                      <span className="news-symbol">{item.symbol}</span>
                      <span className="news-source">{item.source}</span>
                      <span className="news-date">{item.datetime}</span>
                    </div>
                    <h4 className="news-headline">{item.headline}</h4>
                    <p className="news-summary">{item.summary?.slice(0, 200)}...</p>
                  </a>
                ))}
                {news.length === 0 && !newsLoading && (
                  <p className="no-data">No news available. Check API connection.</p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'journal' && (
          <div className="journal-section">
            <div className="journal-header">
              <h3>Trade Journal</h3>
              <div className="journal-actions">
                <button 
                  className="quick-log-btn"
                  onClick={openQuickLogForm}
                >
                  Quick Log (P&L)
                </button>
                <button 
                  className="new-trade-btn"
                  onClick={() => {
                    resetTradeForm()
                    setTradeForm(prev => ({ ...prev, pair: selectedPair }))
                    setShowTradeForm(true)
                  }}
                >
                  + Full Entry
                </button>
              </div>
            </div>
            <p className="journal-tip">Tip: Tell Pippy in chat "log my US30 long, made $150" to auto-journal trades!</p>

            {tradeStats && (
              <div className="stats-dashboard">
                <div className="stat-card primary">
                  <span className="stat-value">{tradeStats.winRate}%</span>
                  <span className="stat-label">Win Rate</span>
                </div>
                <div className={`stat-card ${parseFloat(tradeStats.totalPnl) >= 0 ? 'positive' : 'negative'}`}>
                  <span className="stat-value">${tradeStats.totalPnl}</span>
                  <span className="stat-label">Total P&L</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{tradeStats.totalTrades}</span>
                  <span className="stat-label">Total Trades</span>
                </div>
                <div className="stat-card positive">
                  <span className="stat-value">{tradeStats.wins}</span>
                  <span className="stat-label">Wins</span>
                </div>
                <div className="stat-card negative">
                  <span className="stat-value">{tradeStats.losses}</span>
                  <span className="stat-label">Losses</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{tradeStats.avgRiskReward}</span>
                  <span className="stat-label">Avg R:R</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">${tradeStats.avgWin}</span>
                  <span className="stat-label">Avg Win</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">${tradeStats.avgLoss}</span>
                  <span className="stat-label">Avg Loss</span>
                </div>
                <div className={`stat-card ${tradeStats.streakType === 'WIN' ? 'positive' : tradeStats.streakType === 'LOSS' ? 'negative' : ''}`}>
                  <span className="stat-value">{tradeStats.currentStreak} {tradeStats.streakType}</span>
                  <span className="stat-label">Current Streak</span>
                </div>
              </div>
            )}

            {showTradeForm && (
              <div className="modal-overlay" onClick={() => { setShowTradeForm(false); resetTradeForm(); }}>
                <div className="modal-content trade-modal-large" onClick={e => e.stopPropagation()}>
                  <h4>
                    {editingTrade ? `Edit Trade #${editingTrade.id}` : 
                     tradeFormMode === 'quick' ? 'Quick Log Trade' : 'Log New Trade'}
                  </h4>
                  <form onSubmit={handleCreateTrade} className="trade-form">
                    <div className="form-row">
                      <label>
                        Pair
                        <select value={tradeForm.pair} onChange={e => setTradeForm({...tradeForm, pair: e.target.value})}>
                          {TRADING_PAIRS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </label>
                      <label>
                        Direction
                        <select value={tradeForm.direction} onChange={e => setTradeForm({...tradeForm, direction: e.target.value})}>
                          <option value="LONG">LONG</option>
                          <option value="SHORT">SHORT</option>
                        </select>
                      </label>
                      <label>
                        Status
                        <select value={tradeForm.status} onChange={e => setTradeForm({...tradeForm, status: e.target.value})}>
                          <option value="OPEN">OPEN</option>
                          <option value="WIN">WIN</option>
                          <option value="LOSS">LOSS</option>
                          <option value="BREAKEVEN">BREAKEVEN</option>
                        </select>
                      </label>
                      <label>
                        Timeframe
                        <select value={tradeForm.timeframe} onChange={e => setTradeForm({...tradeForm, timeframe: e.target.value})}>
                          {TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf}</option>)}
                        </select>
                      </label>
                    </div>
                    
                    {tradeFormMode === 'quick' ? (
                      <div className="form-row quick-pnl-row">
                        <label className="pnl-input">
                          P&L ($) *
                          <input 
                            type="number" 
                            step="0.01" 
                            required 
                            placeholder="e.g., 150 or -80"
                            value={tradeForm.pnl} 
                            onChange={e => {
                              const pnl = e.target.value
                              const status = pnl && parseFloat(pnl) >= 0 ? 'WIN' : pnl ? 'LOSS' : 'OPEN'
                              setTradeForm({...tradeForm, pnl, status})
                            }} 
                          />
                        </label>
                        <label>
                          Position Size
                          <input type="number" step="0.01" value={tradeForm.position_size} onChange={e => setTradeForm({...tradeForm, position_size: e.target.value})} />
                        </label>
                      </div>
                    ) : (
                      <>
                        <div className="form-row">
                          <label>
                            Entry Price {tradeFormMode !== 'quick' && '*'}
                            <input type="number" step="0.00001" required={tradeFormMode !== 'quick'} value={tradeForm.entry_price} onChange={e => setTradeForm({...tradeForm, entry_price: e.target.value})} />
                          </label>
                          <label>
                            Exit Price
                            <input type="number" step="0.00001" value={tradeForm.exit_price} onChange={e => setTradeForm({...tradeForm, exit_price: e.target.value})} />
                          </label>
                          <label>
                            P&L ($)
                            <input 
                              type="number" 
                              step="0.01" 
                              placeholder="Auto or manual"
                              value={tradeForm.pnl} 
                              onChange={e => setTradeForm({...tradeForm, pnl: e.target.value})} 
                            />
                          </label>
                        </div>
                        <div className="form-row">
                          <label>
                            Stop Loss
                            <input type="number" step="0.00001" value={tradeForm.stop_loss} onChange={e => setTradeForm({...tradeForm, stop_loss: e.target.value})} />
                          </label>
                          <label>
                            Take Profit
                            <input type="number" step="0.00001" value={tradeForm.take_profit} onChange={e => setTradeForm({...tradeForm, take_profit: e.target.value})} />
                          </label>
                          <label>
                            Position Size
                            <input type="number" step="0.01" value={tradeForm.position_size} onChange={e => setTradeForm({...tradeForm, position_size: e.target.value})} />
                          </label>
                        </div>
                      </>
                    )}
                    
                    <div className="form-row">
                      <label className="setup-input">
                        Setup Type
                        <input type="text" placeholder="e.g., Breakout, Pullback, Reversal" value={tradeForm.setup_type} onChange={e => setTradeForm({...tradeForm, setup_type: e.target.value})} />
                      </label>
                    </div>
                    <label className="full-width">
                      Notes
                      <textarea value={tradeForm.notes} onChange={e => setTradeForm({...tradeForm, notes: e.target.value})} rows={2} placeholder="Trade notes, reasoning, lessons learned..." />
                    </label>
                    <div className="form-actions">
                      <button type="button" className="cancel-btn" onClick={() => { setShowTradeForm(false); resetTradeForm(); }}>Cancel</button>
                      <button type="submit" className="submit-btn">
                        {editingTrade ? 'Update Trade' : 'Log Trade'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {closingTrade && (
              <div className="modal-overlay" onClick={() => setClosingTrade(null)}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                  <h4>Close Trade - {closingTrade.pair} {closingTrade.direction}</h4>
                  <p className="close-info">Entry: ${parseFloat(closingTrade.entry_price).toFixed(2)}</p>
                  <form onSubmit={handleCloseTrade} className="trade-form">
                    <label>
                      Exit Price *
                      <input type="number" step="0.00001" name="exit_price" required />
                    </label>
                    <label>
                      Result
                      <select name="status" required>
                        <option value="WIN">WIN</option>
                        <option value="LOSS">LOSS</option>
                        <option value="BREAKEVEN">BREAKEVEN</option>
                      </select>
                    </label>
                    <div className="form-actions">
                      <button type="button" className="cancel-btn" onClick={() => setClosingTrade(null)}>Cancel</button>
                      <button type="submit" className="submit-btn">Close Trade</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="trades-list">
              {tradesLoading ? (
                <div className="loading-spinner">Loading trades...</div>
              ) : trades.length > 0 ? (
                <table className="trades-table">
                  <thead>
                    <tr>
                      <th>Pair</th>
                      <th>Direction</th>
                      <th>Entry</th>
                      <th>Exit</th>
                      <th>P&L</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map(trade => (
                      <tr key={trade.id} className={`trade-row ${trade.status.toLowerCase()}`}>
                        <td>{trade.pair}</td>
                        <td className={trade.direction === 'LONG' ? 'long' : 'short'}>{trade.direction}</td>
                        <td>${parseFloat(trade.entry_price).toFixed(2)}</td>
                        <td>{trade.exit_price ? `$${parseFloat(trade.exit_price).toFixed(2)}` : '-'}</td>
                        <td className={parseFloat(trade.pnl) >= 0 ? 'positive' : 'negative'}>
                          {trade.pnl ? `$${parseFloat(trade.pnl).toFixed(2)}` : '-'}
                        </td>
                        <td><span className={`status-badge ${trade.status.toLowerCase()}`}>{trade.status}</span></td>
                        <td>{new Date(trade.entry_date).toLocaleDateString()}</td>
                        <td className="actions">
                          <button className="edit-trade-btn" onClick={() => handleEditTrade(trade)}>Edit</button>
                          {trade.status === 'OPEN' && (
                            <button className="close-trade-btn" onClick={() => setClosingTrade(trade)}>Close</button>
                          )}
                          <button className="delete-trade-btn" onClick={() => handleDeleteTrade(trade.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="no-trades">
                  <p>No trades logged yet. Start tracking your trades!</p>
                  <button className="new-trade-btn" onClick={() => setShowTradeForm(true)}>+ Log Your First Trade</button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
