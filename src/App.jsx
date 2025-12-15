import { useState, useRef, useEffect } from 'react'
import './App.css'
import FinvizMap from './components/FinvizMap'
import '../src/styles/FinvizMap.css'
import Sectors from './components/Sectors'
import InsiderTrading from './components/InsiderTrading'
import soundManager from './utils/soundManager'
import { onAuthStateChange, getCurrentUser, signOut } from './utils/supabase'
import AuthPage from './components/AuthPage'
import { getStocksData, getScreenerData } from './services/marketData'
import { getNewsData } from './services/newsService'
import { generateChatResponse, generateTradingPlan } from './services/analysisService'

const TRADING_PAIRS = ['US30', 'NAS100', 'SPX500'];

function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem('pippy_messages')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('chat')
  const [selectedPair, setSelectedPair] = useState('US30')
  const [stocks, setStocks] = useState([])
  const [stocksMeta, setStocksMeta] = useState(null)
  const [news, setNews] = useState([])
  const [stocksLoading, setStocksLoading] = useState(false)
  const [newsLoading, setNewsLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [plannerData, setPlannerData] = useState(null)
  const [plannerLoading, setPlannerLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
    try {
      sessionStorage.setItem('pippy_messages', JSON.stringify(messages))
    } catch (e) {
      console.error('Failed to save messages:', e)
    }
  }, [messages])

  useEffect(() => {
    getCurrentUser().then(user => {
      setSession(user)
      setAuthLoading(false)
    })

    const { data: { subscription } } = onAuthStateChange((event, session) => {
      setSession(session?.user ?? null)
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await signOut()
    setSession(null)
    setMessages([])
    sessionStorage.removeItem('pippy_messages')
    soundManager.click()
  }

  useEffect(() => {
    if (activeTab === 'stocks') {
      fetchStocks(selectedPair)
    } else if (activeTab === 'news') {
      fetchNews(selectedPair)
    }
  }, [activeTab, selectedPair])

  const fetchStocks = async (pair) => {
    setStocksLoading(true)
    try {
      const data = await getStocksData(pair)
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
      const data = await getNewsData(pair)
      setNews(data.news || [])
    } catch (error) {
      console.error('Error fetching news:', error)
    } finally {
      setNewsLoading(false)
    }
  }

  const generatePlan = async () => {
    setPlannerLoading(true)
    setPlannerData(null)
    try {
      const stocksData = await getStocksData(selectedPair)
      const newsData = await getNewsData(selectedPair)
      
      const result = await generateTradingPlan(selectedPair, stocksData, newsData)
      
      if (result.success) {
        setPlannerData({
          success: true,
          plan: `${result.plan.overview}\n\nKey Levels:\n• Support: ${result.plan.keyLevels.support}\n• Resistance: ${result.plan.keyLevels.resistance}\n• Pivot: ${result.plan.keyLevels.pivot}\n\nTop Movers:\n• Gainers: ${result.plan.topMovers.gainers}\n• Losers: ${result.plan.topMovers.losers}\n\nStrategy: ${result.plan.strategy}\n\nRisk Management: ${result.plan.riskManagement}\n\nWatch Points:\n${result.plan.watchPoints.map(p => '• ' + p).join('\n')}`,
          meta: { processingTimeMs: 1500 },
          dataSources: { stockData: 'success', mapData: 'success', news: 'success' }
        })
      } else {
        setPlannerData({ error: 'Failed to generate trading plan' })
      }
    } catch (error) {
      console.error('Error generating plan:', error)
      setPlannerData({ error: 'Failed to generate trading plan' })
    } finally {
      setPlannerLoading(false)
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    soundManager.messageSend()

    try {
      const data = await generateChatResponse(userMessage, selectedPair, messages.slice(-10))

      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
        soundManager.messageReceive()
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Unable to process your request. Please try again.',
        error: true
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const quickCommands = [
    { label: 'Major stocks update', cmd: `Hey Pippy, what are major stocks doing for ${selectedPair}?` },
    { label: 'Market news', cmd: `Hey Pippy, any news affecting ${selectedPair}?` },
    { label: 'Market overview', cmd: `Hey Pippy, give me a market overview for ${selectedPair}` }
  ]

  if (authLoading) {
    return (
      <div className="app-loading">
        <div className="spinner-large"></div>
        <p>Initializing Secure Session...</p>
      </div>
    )
  }

  if (!session) {
    return <AuthPage onAuthSuccess={(user) => setSession(user)} />
  }

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-content">
          <div className="logo-section">
            <h1>Agent Pippy</h1>
            <p className="subtitle">AI Trading Assistant</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div className="pair-selector">
              {TRADING_PAIRS.map(pair => (
                <button
                  key={pair}
                  className={`pair-btn ${selectedPair === pair ? 'active' : ''}`}
                  onClick={() => {
                    soundManager.click()
                    setSelectedPair(pair)
                  }}
                >
                  {pair}
                </button>
              ))}
            </div>
            <button
              className="sign-out-btn"
              onClick={handleSignOut}
              title="Sign Out"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <nav className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => {
            soundManager.tabSwitch()
            setActiveTab('chat')
          }}
        >
          Chat
        </button>
        <button
          className={`tab-btn ${activeTab === 'stocks' ? 'active' : ''}`}
          onClick={() => {
            soundManager.tabSwitch()
            setActiveTab('stocks')
          }}
        >
          Screener
        </button>
        <button
          className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`}
          onClick={() => {
            soundManager.tabSwitch()
            setActiveTab('map')
          }}
        >
          Map
        </button>
        <button
          className={`tab-btn ${activeTab === 'sectors' ? 'active' : ''}`}
          onClick={() => {
            soundManager.tabSwitch()
            setActiveTab('sectors')
          }}
        >
          Sectors
        </button>
        <button
          className={`tab-btn ${activeTab === 'insider' ? 'active' : ''}`}
          onClick={() => {
            soundManager.tabSwitch()
            setActiveTab('insider')
          }}
        >
          Insider
        </button>
        <button
          className={`tab-btn ${activeTab === 'news' ? 'active' : ''}`}
          onClick={() => {
            soundManager.tabSwitch()
            setActiveTab('news')
          }}
        >
          News
        </button>
        <button
          className={`tab-btn ${activeTab === 'planner' ? 'active' : ''}`}
          onClick={() => {
            soundManager.tabSwitch()
            setActiveTab('planner')
          }}
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
                  onClick={() => {
                    soundManager.click()
                    setInput(qc.cmd)
                  }}
                >
                  {qc.label}
                </button>
              ))}
            </div>

            <div className="chat-container">
              <div className="messages-container">
                {messages.length === 0 && (
                  <div className="welcome-message">
                    <h2>Pippy AI</h2>
                    <p>
                      Your advanced AI trading analyst for <strong>{selectedPair}</strong>
                    </p>
                    <div className="welcome-features">
                      <div className="feature">
                        <span className="feature-icon">🚀</span>
                        <span>Instant AI responses</span>
                      </div>
                      <div className="feature">
                        <span className="feature-icon">📊</span>
                        <span>Smart technical analysis</span>
                      </div>
                      <div className="feature">
                        <span className="feature-icon">⚡</span>
                        <span>Trading insights</span>
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
                    <span className="msg-label">Pippy is analyzing...</span>
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
              <div className="loading-spinner">Loading prices...</div>
            ) : (
              <div className="stocks-grid">
                {stocks.map((stock, i) => (
                  <div key={i} className={`stock-card ${stock.change >= 0 ? 'positive' : 'negative'}`}>
                    <div className="stock-header">
                      <span className="stock-symbol">{stock.symbol}</span>
                      <span className="stock-name">{stock.name}</span>
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
                  <p className="no-data">No stock data available.</p>
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
                  <div key={i} className="news-card">
                    <div className="news-meta">
                      <span className="news-symbol">{item.symbol}</span>
                      <span className="news-source">{item.source}</span>
                      <span className="news-date">{new Date(item.datetime).toLocaleString()}</span>
                    </div>
                    <h4 className="news-headline">{item.headline}</h4>
                    <p className="news-summary">{item.summary}</p>
                  </div>
                ))}
                {news.length === 0 && !newsLoading && (
                  <p className="no-data">No news available.</p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'map' && (
          <FinvizMap selectedPair={selectedPair} />
        )}

        {activeTab === 'sectors' && (
          <Sectors />
        )}

        {activeTab === 'insider' && (
          <InsiderTrading />
        )}

        {activeTab === 'planner' && (
          <div className="planner-section">
            <div className="planner-hero">
              <div className="planner-hero-content">
                <div className="planner-title-group">
                  <h1 className="planner-main-title">AI Trading Plan</h1>
                  <h2 className="planner-pair-subtitle">{selectedPair}</h2>
                  <p className="planner-description">AI-powered daily trading strategy based on market analysis</p>
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
              <div className="data-source-card ready">
                <div className="source-header">
                  <span className="source-icon">🤖</span>
                  <span className="source-title">AI Engine</span>
                </div>
                <div className="source-value">Analysis Engine</div>
                <div className="source-status-badge">✓ Ready</div>
              </div>

              <div className="data-source-card ready">
                <div className="source-header">
                  <span className="source-icon">💹</span>
                  <span className="source-title">Market Data</span>
                </div>
                <div className="source-value">Stock Analysis</div>
                <div className="source-status-badge">✓ Ready</div>
              </div>

              <div className="data-source-card ready">
                <div className="source-header">
                  <span className="source-icon">🗺️</span>
                  <span className="source-title">Market Map</span>
                </div>
                <div className="source-value">Sector Heatmap</div>
                <div className="source-status-badge">✓ Ready</div>
              </div>
            </div>

            {plannerLoading ? (
              <div className="plan-loading-pro">
                <div className="loading-spinner-large"></div>
                <h3>Generating Your Trading Plan</h3>
                <p>Analyzing stocks, market map, and news to create your personalized strategy...</p>
                <p className="loading-hint">This may take a few seconds</p>
              </div>
            ) : plannerData ? (
              plannerData.error ? (
                <div className="plan-error-pro">
                  <h3>Unable to Generate Plan</h3>
                  <p>{plannerData.error}</p>
                </div>
              ) : (
                <div className="trading-plan-pro">
                  <div className="plan-metadata">
                    <div className="metadata-item">
                      <span className="metadata-label">Generated</span>
                      <span className="metadata-value">{plannerData.meta?.processingTimeMs}ms</span>
                    </div>
                    <div className="metadata-divider"></div>
                    <div className="metadata-sources">
                      <span className={`source-badge ${plannerData.dataSources?.stockData === 'success' ? 'success' : 'warning'}`}>
                        💹 Stocks
                      </span>
                      <span className={`source-badge ${plannerData.dataSources?.mapData === 'success' ? 'success' : 'warning'}`}>
                        🗺️ Map
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
                      <div className="card-content" style={{ whiteSpace: 'pre-line' }}>
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
                          <span className="insight-icon">💹</span>
                          <span>Stock data for {selectedPair}</span>
                        </div>
                        <div className="insight-item">
                          <span className="insight-icon">🗺️</span>
                          <span>Market sector heatmap analysis</span>
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
                  <p>Click the button above to create an AI-powered trading strategy based on stocks, market map, and news</p>

                  <div className="empty-requirements">
                    <h4>All Systems Ready:</h4>
                    <div className="req-item">
                      <span>✓</span>
                      <span className="req-text">AI Analysis Engine configured</span>
                    </div>
                    <div className="req-item">
                      <span>✓</span>
                      <span className="req-text">Market Data available</span>
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
