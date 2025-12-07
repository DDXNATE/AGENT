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
          history: messages.slice(-10)
        })
      })

      const data = await response.json()

      if (response.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
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
              </div>
            </div>

            <div className="charts-grid">
              {TIMEFRAMES.map(tf => (
                <div key={tf} className="chart-timeframe-section">
                  <h4>{tf.toUpperCase()} Charts</h4>
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
      </main>
    </div>
  )
}

export default App
