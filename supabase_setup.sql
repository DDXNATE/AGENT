-- Agent Pippy - Supabase Database Setup
-- Run this SQL in your Supabase SQL Editor (Dashboard > SQL Editor)

CREATE TABLE IF NOT EXISTS trades (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR,
  pair VARCHAR(20) NOT NULL,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
  entry_price DECIMAL(20, 5) NOT NULL,
  stop_loss DECIMAL(20, 5),
  take_profit DECIMAL(20, 5),
  exit_price DECIMAL(20, 5),
  position_size DECIMAL(20, 5),
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'WIN', 'LOSS', 'BREAKEVEN', 'CANCELLED')),
  pnl DECIMAL(20, 2),
  pnl_percent DECIMAL(10, 2),
  risk_reward DECIMAL(10, 2),
  timeframe VARCHAR(10),
  setup_type VARCHAR(100),
  notes TEXT,
  chart_analysis TEXT,
  entry_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  exit_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trades_pair ON trades(pair);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_entry_date ON trades(entry_date);
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);

-- Enable Row Level Security (optional - for multi-user support)
-- ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Allow all operations for service role (used by backend)
-- CREATE POLICY "Service role full access" ON trades FOR ALL USING (true);
