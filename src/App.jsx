import { useState, useRef, useEffect } from 'react'
import './App.css'
import AuthPage from './components/AuthPage'
import FinvizMap from './components/FinvizMap'
import '../src/styles/FinvizMap.css'
import { signOut, onAuthStateChange } from './utils/supabase'

const TRADING_PAIRS = ['US30', 'NAS100', 'SPX500'];
const TIMEFRAMES = ['15m', '1hr', '4hr', 'daily'];

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
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
  const [plannerData, setPlannerData] = useState(null)
  const [plannerLoading, setPlannerLoading] = useState(false)
  const [plannerStatus, setPlannerStatus] = useState(null)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  console.log('🤖 App component mounted, checkingAuth:', checkingAuth, 'isAuthenticated:', isAuthenticated)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Setup Supabase auth listener
  useEffect(() => {
    console.log('🔐 Setting up auth listener...')
    try {
      const { data: { subscription } } = onAuthStateChange((event, session) => {
        console.log('🔐 Auth state changed:', event, !!session)
        if (session) {
          setUser({
            id: session.user.id,
            email: session.user.email,
            username: session.user.user_metadata?.username || session.user.email
          })
          setIsAuthenticated(true)
        } else {
          setUser(null)
          setIsAuthenticated(false)
          setMessages([])
        }
        setCheckingAuth(false)
      })

      // Timeout fallback - if auth check takes too long, continue anyway
      const timeout = setTimeout(() => {
        console.log('⏱️ Auth check timeout - forcing load')
        setCheckingAuth(false)
        setIsAuthenticated(false)
      }, 2000)

      return () => {
        clearTimeout(timeout)
        subscription?.unsubscribe?.()
      }
    } catch (error) {
      console.error('❌ Auth setup error:', error)
      setCheckingAuth(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'stocks') {
      fetchStocks(selectedPair)
    } else if (activeTab === 'news') {
      fetchNews(selectedPair)
    } else if (activeTab === 'charts') {
      fetchCharts(selectedPair)
    } else if (activeTab === 'planner') {
      fetchPlannerStatus(selectedPair)
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

  const fetchPlannerStatus = async (pair) => {
    try {
      const response = await fetch(`/api/planner/status/${pair}`)
      const data = await response.json()
      setPlannerStatus(data)
    } catch (error) {
      console.error('Error fetching planner status:', error)
    }
  }

  const generatePlan = async () => {
    setPlannerLoading(true)
    setPlannerData(null)
    try {
      // Fetch all necessary data for analysis
      const [chartsRes, stocksRes, newsRes, mapRes] = await Promise.all([
        fetch(`/api/charts/${selectedPair}`),
        fetch(`/api/stocks/${selectedPair}`),
        fetch(`/api/news/${selectedPair}`),
        fetch(`/api/market-map/${selectedPair}`)
      ])
      
      const charts = await chartsRes.json()
      const stocks = await stocksRes.json()
      const news = await newsRes.json()
      const map = await mapRes.json()
      
      const response = await fetch('/api/planner/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pair: selectedPair,
          charts: charts,
          stocks: stocks,
          news: news,
          map: map
        })
      })
      const data = await response.json()
      if (data.success) {
        setPlannerData(data)
      } else {
        setPlannerData({ error: data.error })
      }
    } catch (error) {
      console.error('Error generating plan:', error)
      setPlannerData({ error: 'Failed to generate trading plan' })
    } finally {
      setPlannerLoading(false)
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

  const handleAuthSuccess = (userData) => {
    setUser(userData)
    setIsAuthenticated(true)
  }

  const handleLogout = async () => {
    try {
      await signOut()
      setUser(null)
      setIsAuthenticated(false)
      setMessages([])
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  if (checkingAuth) {
    console.log('⏳ Rendering loading screen...')
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1a1a1a' }}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div className="loading-spinner"></div>
          <p style={{ marginTop: '20px', fontSize: '16px' }}>Loading Application...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    console.log('🔓 Rendering AuthPage...')
    return <AuthPage onAuthSuccess={handleAuthSuccess} />
  }

  console.log('✅ Rendering authenticated app...')
  return (
    <div className="app-container">
      <header className="header">
        <div className="header-content">
          <div className="logo-section">
            <h1>Agent Pippy</h1>
            <p className="subtitle">AI Trading Assistant</p>
          </div>
          <div className="header-user-section">
            <div className="user-info">
              <span className="user-name">{user?.username || 'User'}</span>
              <button onClick={handleLogout} className="logout-btn">Logout</button>
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
          className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`}
          onClick={() => setActiveTab('map')}
        >
          Map
        </button>
        <button 
          className={`tab-btn ${activeTab === 'news' ? 'active' : ''}`}
          onClick={() => setActiveTab('news')}
        >
          News
        </button>
        <button 
          className={`tab-btn ${activeTab === 'planner' ? 'active' : ''}`}
          onClick={() => setActiveTab('planner')}
        >
          Planner
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

        {activeTab === 'map' && (
          <FinvizMap selectedPair={selectedPair} />
        )}

        {activeTab === 'planner' && (
          <div className="planner-section">
            <div className="planner-hero">
              <div className="planner-hero-content">
                <div className="planner-title-group">
                  <h1 className="planner-main-title">AI Trading Plan</h1>
                  <h2 className="planner-pair-subtitle">{selectedPair}</h2>
                  <p className="planner-description">AI-powered daily trading strategy based on real-time market analysis</p>
                </div>
                <button 
                  className={`generate-plan-btn-pro ${plannerLoading ? 'loading' : ''}`}
                  onClick={generatePlan}
                  disabled={plannerLoading}
                >
                  {plannerLoading ? (
                    <>
                      <span className="spinner-mini"></span> Generating Plan...
                    </>
                  ) : (
                    <>
                      ⚡ Generate Today's Plan
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="planner-data-sources">
              <div className={`data-source-card ${plannerStatus?.status?.charts === 'ready' ? 'ready' : 'pending'}`}>
                <div className="source-header">
                  <span className="source-icon">📊</span>
                  <span className="source-title">Chart Analysis</span>
                </div>
                <div className="source-value">{plannerStatus?.status?.chartCount || 0} charts</div>
                <div className="source-status-badge">{plannerStatus?.status?.charts === 'ready' ? '✓ Ready' : '⚠ Missing'}</div>
              </div>
              
              <div className={`data-source-card ${plannerStatus?.status?.geminiAI === 'ready' ? 'ready' : 'pending'}`}>
                <div className="source-header">
                  <span className="source-icon">🤖</span>
                  <span className="source-title">AI Engine</span>
                </div>
                <div className="source-value">Gemini API</div>
                <div className="source-status-badge">{plannerStatus?.status?.geminiAI === 'ready' ? '✓ Ready' : '⚠ Configure'}</div>
              </div>
              
              <div className={`data-source-card ${plannerStatus?.status?.finnhub === 'ready' ? 'ready' : 'pending'}`}>
                <div className="source-header">
                  <span className="source-icon">💹</span>
                  <span className="source-title">Market Data</span>
                </div>
                <div className="source-value">Real-time Data</div>
                <div className="source-status-badge">{plannerStatus?.status?.finnhub === 'ready' ? '✓ Ready' : '⚠ Configure'}</div>
              </div>
            </div>

            {plannerLoading ? (
              <div className="plan-loading-pro">
                <div className="loading-spinner-large"></div>
                <h3>Generating Your Trading Plan</h3>
                <p>Analyzing charts, market data, and news to create your personalized strategy...</p>
                <p className="loading-hint">This may take 10-30 seconds</p>
              </div>
            ) : plannerData ? (
              plannerData.error ? (
                <div className="plan-error-pro">
                  <h3>⚠️ Unable to Generate Plan</h3>
                  <p>{plannerData.error}</p>
                  {plannerData.error.includes('GEMINI') && (
                    <div className="error-solution">
                      <strong>Solution:</strong> Add GEMINI_API_KEY in the Secrets tab to enable AI analysis
                    </div>
                  )}
                </div>
              ) : (
                <div className="trading-plan-pro">
                  <div className="plan-metadata">
                    <div className="metadata-item">
                      <span className="metadata-label">Generated</span>
                      <span className="metadata-value">{plannerData.meta?.processingTimeMs}ms ago</span>
                    </div>
                    <div className="metadata-divider"></div>
                    <div className="metadata-sources">
                      <span className={`source-badge ${plannerData.dataSources?.chartAnalysis === 'success' ? 'success' : 'warning'}`}>
                        📈 Charts
                      </span>
                      <span className={`source-badge ${plannerData.dataSources?.stockData === 'success' ? 'success' : 'warning'}`}>
                        💹 Stocks
                      </span>
                      <span className={`source-badge ${plannerData.dataSources?.news === 'success' ? 'success' : 'warning'}`}>
                        📰 News
                      </span>
                    </div>
                  </div>

                  <div className="plan-content-grid">
                    <div className="plan-card-pro primary">
                      <div className="card-header">
                        <h3>📋 Trading Strategy</h3>
                        <span className="card-badge">Primary</span>
                      </div>
                      <div className="card-content">
                        {plannerData.plan}
                      </div>
                    </div>

                    <div className="plan-card-pro secondary">
                      <div className="card-header">
                        <h3>💡 Key Insights</h3>
                        <span className="card-badge">Reference</span>
                      </div>
                      <div className="insights-list">
                        <div className="insight-item">
                          <span className="insight-icon">📈</span>
                          <span>Technical analysis from your charts</span>
                        </div>
                        <div className="insight-item">
                          <span className="insight-icon">📊</span>
                          <span>Real-time market data for {selectedPair}</span>
                        </div>
                        <div className="insight-item">
                          <span className="insight-icon">📰</span>
                          <span>Latest financial news & events</span>
                        </div>
                        <div className="insight-item">
                          <span className="insight-icon">⚙️</span>
                          <span>Risk management best practices</span>
                        </div>
                      </div>
                    </div>

                    <div className="plan-card-pro secondary">
                      <div className="card-header">
                        <h3>✅ Action Checklist</h3>
                        <span className="card-badge">Execution</span>
                      </div>
                      <div className="checklist-items">
                        <div className="checklist-item">
                          <input type="checkbox" id="check1" />
                          <label htmlFor="check1">Review the trading strategy above</label>
                        </div>
                        <div className="checklist-item">
                          <input type="checkbox" id="check2" />
                          <label htmlFor="check2">Set your entry and exit levels</label>
                        </div>
                        <div className="checklist-item">
                          <input type="checkbox" id="check3" />
                          <label htmlFor="check3">Confirm risk/reward ratios</label>
                        </div>
                        <div className="checklist-item">
                          <input type="checkbox" id="check4" />
                          <label htmlFor="check4">Execute according to plan</label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="plan-empty-pro">
                <div className="empty-content">
                  <div className="empty-icon-large">📅</div>
                  <h2>Ready to Generate Your Trading Plan?</h2>
                  <p>Click the button above to create an AI-powered trading strategy based on your charts and market analysis</p>
                  
                  <div className="empty-requirements">
                    <h4>Requirements:</h4>
                    <div className="req-item">
                      <span className={plannerStatus?.status?.charts === 'ready' ? '✓' : '✗'}>Charts</span>
                      <span className="req-text">{plannerStatus?.status?.charts === 'ready' ? 'Charts uploaded' : 'Upload charts in Charts tab'}</span>
                    </div>
                    <div className="req-item">
                      <span className={plannerStatus?.status?.geminiAI === 'ready' ? '✓' : '✗'}>AI Key</span>
                      <span className="req-text">{plannerStatus?.status?.geminiAI === 'ready' ? 'API configured' : 'Add GEMINI_API_KEY'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
