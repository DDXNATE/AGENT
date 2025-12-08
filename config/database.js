import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS trades (
        id SERIAL PRIMARY KEY,
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
    `);
    console.log('✓ Trade journal database initialized');
    return true;
  } catch (error) {
    console.error('Database initialization error:', error);
    return false;
  } finally {
    client.release();
  }
}

export async function createTrade(trade) {
  const {
    pair, direction, entry_price, stop_loss, take_profit,
    position_size, timeframe, setup_type, notes, chart_analysis
  } = trade;
  
  const result = await pool.query(
    `INSERT INTO trades (pair, direction, entry_price, stop_loss, take_profit, position_size, timeframe, setup_type, notes, chart_analysis)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [pair, direction, entry_price, stop_loss, take_profit, position_size, timeframe, setup_type, notes, chart_analysis]
  );
  return result.rows[0];
}

export async function closeTrade(id, exitData) {
  const { exit_price, status, notes } = exitData;
  
  const tradeResult = await pool.query('SELECT * FROM trades WHERE id = $1', [id]);
  if (tradeResult.rows.length === 0) {
    throw new Error('Trade not found');
  }
  
  const trade = tradeResult.rows[0];
  const entryPrice = parseFloat(trade.entry_price);
  const exitPrice = parseFloat(exit_price);
  const positionSize = parseFloat(trade.position_size) || 1;
  
  let pnl, pnlPercent;
  if (trade.direction === 'LONG') {
    pnl = (exitPrice - entryPrice) * positionSize;
    pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
  } else {
    pnl = (entryPrice - exitPrice) * positionSize;
    pnlPercent = ((entryPrice - exitPrice) / entryPrice) * 100;
  }
  
  let riskReward = null;
  if (trade.stop_loss) {
    const risk = Math.abs(entryPrice - parseFloat(trade.stop_loss));
    const reward = Math.abs(exitPrice - entryPrice);
    riskReward = risk > 0 ? (reward / risk).toFixed(2) : null;
  }
  
  const result = await pool.query(
    `UPDATE trades SET 
      exit_price = $1, status = $2, pnl = $3, pnl_percent = $4, 
      risk_reward = $5, exit_date = CURRENT_TIMESTAMP, 
      notes = COALESCE($6, notes), updated_at = CURRENT_TIMESTAMP
     WHERE id = $7 RETURNING *`,
    [exit_price, status, pnl.toFixed(2), pnlPercent.toFixed(2), riskReward, notes, id]
  );
  return result.rows[0];
}

export async function getTrades(filters = {}) {
  const { pair, status, limit = 50, offset = 0 } = filters;
  
  let query = 'SELECT * FROM trades WHERE 1=1';
  const params = [];
  let paramCount = 0;
  
  if (pair) {
    paramCount++;
    query += ` AND pair = $${paramCount}`;
    params.push(pair);
  }
  if (status) {
    paramCount++;
    query += ` AND status = $${paramCount}`;
    params.push(status);
  }
  
  query += ' ORDER BY entry_date DESC';
  paramCount++;
  query += ` LIMIT $${paramCount}`;
  params.push(limit);
  paramCount++;
  query += ` OFFSET $${paramCount}`;
  params.push(offset);
  
  const result = await pool.query(query, params);
  return result.rows;
}

export async function getTradeStats(pair = null) {
  let whereClause = "WHERE status IN ('WIN', 'LOSS', 'BREAKEVEN')";
  const params = [];
  
  if (pair) {
    whereClause += ' AND pair = $1';
    params.push(pair);
  }
  
  const statsQuery = `
    SELECT 
      COUNT(*) as total_trades,
      COUNT(CASE WHEN status = 'WIN' THEN 1 END) as wins,
      COUNT(CASE WHEN status = 'LOSS' THEN 1 END) as losses,
      COUNT(CASE WHEN status = 'BREAKEVEN' THEN 1 END) as breakeven,
      COALESCE(SUM(pnl), 0) as total_pnl,
      COALESCE(AVG(pnl), 0) as avg_pnl,
      COALESCE(AVG(CASE WHEN status = 'WIN' THEN pnl END), 0) as avg_win,
      COALESCE(AVG(CASE WHEN status = 'LOSS' THEN pnl END), 0) as avg_loss,
      COALESCE(MAX(pnl), 0) as best_trade,
      COALESCE(MIN(pnl), 0) as worst_trade,
      COALESCE(AVG(risk_reward), 0) as avg_rr
    FROM trades ${whereClause}
  `;
  
  const result = await pool.query(statsQuery, params);
  const stats = result.rows[0];
  
  const totalTrades = parseInt(stats.total_trades) || 0;
  const wins = parseInt(stats.wins) || 0;
  const losses = parseInt(stats.losses) || 0;
  
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : 0;
  const profitFactor = Math.abs(parseFloat(stats.avg_loss)) > 0 
    ? (parseFloat(stats.avg_win) / Math.abs(parseFloat(stats.avg_loss))).toFixed(2) 
    : 0;
  
  const streakQuery = `
    SELECT status FROM trades 
    ${whereClause}
    ORDER BY exit_date DESC LIMIT 20
  `;
  const streakResult = await pool.query(streakQuery, params);
  
  let currentStreak = 0;
  let streakType = null;
  for (const row of streakResult.rows) {
    if (streakType === null) {
      streakType = row.status;
      currentStreak = 1;
    } else if (row.status === streakType) {
      currentStreak++;
    } else {
      break;
    }
  }
  
  return {
    totalTrades,
    wins,
    losses,
    breakeven: parseInt(stats.breakeven) || 0,
    winRate: parseFloat(winRate),
    totalPnl: parseFloat(stats.total_pnl).toFixed(2),
    avgPnl: parseFloat(stats.avg_pnl).toFixed(2),
    avgWin: parseFloat(stats.avg_win).toFixed(2),
    avgLoss: parseFloat(stats.avg_loss).toFixed(2),
    bestTrade: parseFloat(stats.best_trade).toFixed(2),
    worstTrade: parseFloat(stats.worst_trade).toFixed(2),
    avgRiskReward: parseFloat(stats.avg_rr).toFixed(2),
    profitFactor,
    currentStreak,
    streakType: streakType || 'NONE'
  };
}

export async function deleteTrade(id) {
  const result = await pool.query('DELETE FROM trades WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
}

export async function updateTrade(id, updates) {
  const allowedFields = [
    'pair', 'direction', 'entry_price', 'exit_price', 
    'stop_loss', 'take_profit', 'position_size',
    'status', 'pnl', 'pnl_percent', 'risk_reward',
    'timeframe', 'setup_type', 'notes', 'chart_analysis', 'exit_date'
  ];
  const setClauses = [];
  const params = [];
  let paramCount = 0;
  
  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key) && value !== undefined && value !== null && value !== '') {
      paramCount++;
      setClauses.push(`${key} = $${paramCount}`);
      params.push(value);
    }
  }
  
  if (setClauses.length === 0) {
    throw new Error('No valid fields to update');
  }
  
  paramCount++;
  setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
  params.push(id);
  
  const query = `UPDATE trades SET ${setClauses.join(', ')} WHERE id = $${paramCount} RETURNING *`;
  const result = await pool.query(query, params);
  return result.rows[0];
}

export default pool;
