import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function initDatabase() {
  if (!supabase) {
    console.log('⚠ Supabase not configured - trade journal will not persist');
    return false;
  }
  
  try {
    const { error } = await supabase.from('trades').select('id').limit(1);
    
    if (error && error.code === '42P01') {
      console.log('⚠ Trades table does not exist in Supabase. Please create it via the Supabase dashboard.');
      console.log('SQL to run in Supabase SQL Editor:');
      console.log(`
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
      `);
      return false;
    }
    
    console.log('✓ Trade journal database initialized (Supabase)');
    return true;
  } catch (error) {
    console.error('Database initialization error:', error);
    return false;
  }
}

export async function createTrade(trade, userId = null) {
  if (!supabase) throw new Error('Database not configured');
  
  const {
    pair, direction, entry_price, stop_loss, take_profit,
    position_size, timeframe, setup_type, notes, chart_analysis
  } = trade;
  
  const { data, error } = await supabase
    .from('trades')
    .insert({
      user_id: userId,
      pair,
      direction,
      entry_price,
      stop_loss,
      take_profit,
      position_size,
      timeframe,
      setup_type,
      notes,
      chart_analysis,
      entry_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function closeTrade(id, exitData, userId = null) {
  if (!supabase) throw new Error('Database not configured');
  
  const { exit_price, status, notes } = exitData;
  
  let query = supabase.from('trades').select('*').eq('id', id);
  if (userId) query = query.eq('user_id', userId);
  
  const { data: tradeData, error: fetchError } = await query.single();
  
  if (fetchError || !tradeData) {
    throw new Error('Trade not found');
  }
  
  const trade = tradeData;
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
    riskReward = risk > 0 ? parseFloat((reward / risk).toFixed(2)) : null;
  }
  
  const updateData = {
    exit_price,
    status,
    pnl: parseFloat(pnl.toFixed(2)),
    pnl_percent: parseFloat(pnlPercent.toFixed(2)),
    risk_reward: riskReward,
    exit_date: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  if (notes) updateData.notes = notes;
  
  let updateQuery = supabase.from('trades').update(updateData).eq('id', id);
  if (userId) updateQuery = updateQuery.eq('user_id', userId);
  
  const { data, error } = await updateQuery.select().single();
  
  if (error) throw error;
  return data;
}

export async function getTrades(filters = {}, userId = null) {
  if (!supabase) return [];
  
  const { pair, status, limit = 50, offset = 0 } = filters;
  
  let query = supabase.from('trades').select('*');
  
  if (userId) query = query.eq('user_id', userId);
  if (pair) query = query.eq('pair', pair);
  if (status) query = query.eq('status', status);
  
  query = query.order('entry_date', { ascending: false }).range(offset, offset + limit - 1);
  
  const { data, error } = await query;
  
  if (error) throw error;
  return data || [];
}

export async function getTradeStats(pair = null, userId = null) {
  if (!supabase) {
    return {
      totalTrades: 0, wins: 0, losses: 0, breakeven: 0,
      winRate: 0, totalPnl: '0.00', avgPnl: '0.00',
      avgWin: '0.00', avgLoss: '0.00', bestTrade: '0.00',
      worstTrade: '0.00', avgRiskReward: '0.00', profitFactor: 0,
      currentStreak: 0, streakType: 'NONE'
    };
  }
  
  let query = supabase.from('trades').select('*').in('status', ['WIN', 'LOSS', 'BREAKEVEN']);
  
  if (userId) query = query.eq('user_id', userId);
  if (pair) query = query.eq('pair', pair);
  
  const { data: trades, error } = await query;
  
  if (error) throw error;
  
  const allTrades = trades || [];
  const totalTrades = allTrades.length;
  const wins = allTrades.filter(t => t.status === 'WIN').length;
  const losses = allTrades.filter(t => t.status === 'LOSS').length;
  const breakeven = allTrades.filter(t => t.status === 'BREAKEVEN').length;
  
  const totalPnl = allTrades.reduce((sum, t) => sum + (parseFloat(t.pnl) || 0), 0);
  const avgPnl = totalTrades > 0 ? totalPnl / totalTrades : 0;
  
  const winTrades = allTrades.filter(t => t.status === 'WIN');
  const lossTrades = allTrades.filter(t => t.status === 'LOSS');
  
  const avgWin = winTrades.length > 0 
    ? winTrades.reduce((sum, t) => sum + (parseFloat(t.pnl) || 0), 0) / winTrades.length 
    : 0;
  const avgLoss = lossTrades.length > 0 
    ? lossTrades.reduce((sum, t) => sum + (parseFloat(t.pnl) || 0), 0) / lossTrades.length 
    : 0;
  
  const pnlValues = allTrades.map(t => parseFloat(t.pnl) || 0);
  const bestTrade = pnlValues.length > 0 ? Math.max(...pnlValues) : 0;
  const worstTrade = pnlValues.length > 0 ? Math.min(...pnlValues) : 0;
  
  const rrValues = allTrades.filter(t => t.risk_reward).map(t => parseFloat(t.risk_reward));
  const avgRiskReward = rrValues.length > 0 ? rrValues.reduce((a, b) => a + b, 0) / rrValues.length : 0;
  
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : 0;
  const profitFactor = Math.abs(avgLoss) > 0 ? (avgWin / Math.abs(avgLoss)).toFixed(2) : 0;
  
  const sortedTrades = [...allTrades].sort((a, b) => 
    new Date(b.exit_date || b.entry_date) - new Date(a.exit_date || a.entry_date)
  ).slice(0, 20);
  
  let currentStreak = 0;
  let streakType = null;
  for (const trade of sortedTrades) {
    if (streakType === null) {
      streakType = trade.status;
      currentStreak = 1;
    } else if (trade.status === streakType) {
      currentStreak++;
    } else {
      break;
    }
  }
  
  return {
    totalTrades,
    wins,
    losses,
    breakeven,
    winRate: parseFloat(winRate),
    totalPnl: totalPnl.toFixed(2),
    avgPnl: avgPnl.toFixed(2),
    avgWin: avgWin.toFixed(2),
    avgLoss: avgLoss.toFixed(2),
    bestTrade: bestTrade.toFixed(2),
    worstTrade: worstTrade.toFixed(2),
    avgRiskReward: avgRiskReward.toFixed(2),
    profitFactor,
    currentStreak,
    streakType: streakType || 'NONE'
  };
}

export async function deleteTrade(id, userId = null) {
  if (!supabase) throw new Error('Database not configured');
  
  let query = supabase.from('trades').delete().eq('id', id);
  if (userId) query = query.eq('user_id', userId);
  
  const { data, error } = await query.select().single();
  
  if (error) throw error;
  return data;
}

export async function updateTrade(id, updates, userId = null) {
  if (!supabase) throw new Error('Database not configured');
  
  const allowedFields = [
    'pair', 'direction', 'entry_price', 'exit_price', 
    'stop_loss', 'take_profit', 'position_size',
    'status', 'pnl', 'pnl_percent', 'risk_reward',
    'timeframe', 'setup_type', 'notes', 'chart_analysis', 'exit_date'
  ];
  
  const updateData = { updated_at: new Date().toISOString() };
  
  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key) && value !== undefined && value !== null && value !== '') {
      updateData[key] = value;
    }
  }
  
  if (Object.keys(updateData).length <= 1) {
    throw new Error('No valid fields to update');
  }
  
  let query = supabase.from('trades').update(updateData).eq('id', id);
  if (userId) query = query.eq('user_id', userId);
  
  const { data, error } = await query.select().single();
  
  if (error) throw error;
  return data;
}

export default supabase;
