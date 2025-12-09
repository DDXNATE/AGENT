function Landing({ onLogin }) {
  return (
    <div className="landing-page">
      <div className="landing-content">
        <div className="landing-header">
          <h1>Agent Pippy</h1>
          <p className="landing-subtitle">AI-Powered Trading Assistant</p>
        </div>
        
        <div className="landing-features">
          <div className="feature-card">
            <span className="feature-icon">📊</span>
            <h3>Smart Chart Analysis</h3>
            <p>Upload your trading charts and get AI-powered technical analysis</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">📈</span>
            <h3>Live Market Data</h3>
            <p>Real-time stock screener for US30, NAS100, and SPX500</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">📓</span>
            <h3>Trade Journal</h3>
            <p>Track all your trades with detailed statistics and calendar view</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🤖</span>
            <h3>AI Trading Plans</h3>
            <p>Get personalized trading plans based on market conditions</p>
          </div>
        </div>

        <div className="landing-cta">
          <button onClick={onLogin} className="login-btn">
            Sign In to Get Started
          </button>
          <p className="login-note">Sign in with Google, GitHub, or email to save your journal</p>
        </div>
      </div>
    </div>
  );
}

export default Landing;
