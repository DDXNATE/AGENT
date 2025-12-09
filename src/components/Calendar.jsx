import { useState, useMemo } from 'react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Calendar({ trades, onDateSelect, selectedDate }) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  const years = useMemo(() => {
    const startYear = 2020;
    const endYear = 2050;
    return Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
  }, []);

  const tradesByDate = useMemo(() => {
    const map = {};
    trades.forEach(trade => {
      const date = new Date(trade.entry_date);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(trade);
    });
    return map;
  }, [trades]);

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push({ day: null, trades: [] });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const key = `${currentYear}-${currentMonth}-${day}`;
      days.push({
        day,
        date: new Date(currentYear, currentMonth, day),
        trades: tradesByDate[key] || []
      });
    }

    return days;
  }, [currentYear, currentMonth, tradesByDate]);

  const navigateMonth = (direction) => {
    if (direction === 'prev') {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(prev => prev - 1);
      } else {
        setCurrentMonth(prev => prev - 1);
      }
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(prev => prev + 1);
      } else {
        setCurrentMonth(prev => prev + 1);
      }
    }
  };

  const goToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  };

  const getTradeStats = (dayTrades) => {
    if (!dayTrades.length) return null;
    const wins = dayTrades.filter(t => t.status === 'WIN').length;
    const losses = dayTrades.filter(t => t.status === 'LOSS').length;
    const totalPnl = dayTrades.reduce((sum, t) => sum + (parseFloat(t.pnl) || 0), 0);
    return { wins, losses, totalPnl, count: dayTrades.length };
  };

  const isToday = (date) => {
    if (!date) return false;
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date) => {
    if (!date || !selectedDate) return false;
    return date.toDateString() === selectedDate.toDateString();
  };

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <div className="calendar-nav">
          <button onClick={() => navigateMonth('prev')} className="nav-btn">&lt;</button>
          <select 
            value={currentMonth} 
            onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
            className="month-select"
          >
            {MONTHS.map((month, idx) => (
              <option key={month} value={idx}>{month}</option>
            ))}
          </select>
          <select 
            value={currentYear} 
            onChange={(e) => setCurrentYear(parseInt(e.target.value))}
            className="year-select"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <button onClick={() => navigateMonth('next')} className="nav-btn">&gt;</button>
        </div>
        <button onClick={goToToday} className="today-btn">Today</button>
      </div>

      <div className="calendar-weekdays">
        {WEEKDAYS.map(day => (
          <div key={day} className="weekday">{day}</div>
        ))}
      </div>

      <div className="calendar-grid">
        {calendarDays.map((dayData, idx) => {
          const stats = getTradeStats(dayData.trades);
          return (
            <div 
              key={idx} 
              className={`calendar-day ${!dayData.day ? 'empty' : ''} 
                ${isToday(dayData.date) ? 'today' : ''} 
                ${isSelected(dayData.date) ? 'selected' : ''}
                ${stats ? (stats.totalPnl >= 0 ? 'profit' : 'loss') : ''}`}
              onClick={() => dayData.day && onDateSelect(dayData.date, dayData.trades)}
            >
              {dayData.day && (
                <>
                  <span className="day-number">{dayData.day}</span>
                  {stats && (
                    <div className="day-stats">
                      <span className="trade-count">{stats.count} trade{stats.count > 1 ? 's' : ''}</span>
                      <span className={`day-pnl ${stats.totalPnl >= 0 ? 'positive' : 'negative'}`}>
                        {stats.totalPnl >= 0 ? '+' : ''}{stats.totalPnl.toFixed(0)}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Calendar;
