import React, { useEffect, useState } from 'react';
import { api } from '../api';

const PKR = (n) => `Rs. ${Number(n).toFixed(0)}`;
const PK_TIMEZONE = 'Asia/Karachi';
const parseTimestamp = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(value)) {
    return new Date(`${value.replace(' ', 'T')}Z`);
  }
  return new Date(value);
};
const formatPkDate = (value, options = {}) => parseTimestamp(value).toLocaleDateString('en-PK', { timeZone: PK_TIMEZONE, ...options });
const formatPkDateKey = (value) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: PK_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  return `${parts.find((part) => part.type === 'year').value}-${parts.find((part) => part.type === 'month').value}-${parts.find((part) => part.type === 'day').value}`;
};
const formatPkMonthKey = (value) => formatPkDateKey(value).slice(0, 7);
const CHART_COLORS = ['#0f766e', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#65a30d', '#c2410c'];

function pieStops(items, total) {
  let offset = 0;
  return items
    .filter((item) => item.dailyRevenue > 0)
    .map((item) => {
      const start = offset;
      offset += (item.dailyRevenue / total) * 100;
      return `${item.color} ${start}% ${offset}%`;
    });
}

export default function Dashboard({ user }) {
  const [summary, setSummary] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [weeklySales, setWeeklySales] = useState([]);
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [yearlySales, setYearlySales] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(formatPkMonthKey(new Date()));
  const [selectedMonthSales, setSelectedMonthSales] = useState([]);
  const [selectedHourlyDate, setSelectedHourlyDate] = useState(formatPkDateKey(new Date()));
  const [hourlySalesData, setHourlySalesData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    const from = formatPkDateKey(start);

    Promise.all([
      api.getSummary().catch(() => []),
      api.getSales({ from, limit: 500 }).catch(() => []),
      api.getMonthlySummary().catch(() => []),
    ]).then(([s, sales, monthly]) => {
      setSummary(s);
      setRecentSales(sales);
      const days = Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - index));
        const key = formatPkDateKey(date);
        return {
          key,
          label: date.toLocaleDateString('en-PK', { weekday: 'short', timeZone: PK_TIMEZONE }),
          dateLabel: date.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', timeZone: PK_TIMEZONE }),
          revenue: 0,
          count: 0,
        };
      });
      const byDay = Object.fromEntries(days.map((day) => [day.key, day]));
      sales.forEach((sale) => {
        const day = byDay[formatPkDateKey(parseTimestamp(sale.created_at))];
        if (day) {
          day.revenue += Number(sale.total || 0);
          day.count += 1;
        }
      });
      setWeeklySales(days);
      setYearlySales(monthly);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    api.getMonthDailySummary(selectedMonth).then(setSelectedMonthSales).catch(() => setSelectedMonthSales([]));
  }, [selectedMonth]);

  useEffect(() => {
    api.getYearlySummary(selectedYear).then(setYearlySales).catch(() => setYearlySales([]));
  }, [selectedYear]);

  useEffect(() => {
    api.getHourlySummary(selectedHourlyDate).then(setHourlySalesData).catch(() => setHourlySalesData([]));
  }, [selectedHourlyDate]);

  const totalRevenue = summary.reduce((s, b) => s + Number(b.revenue), 0);
  const totalToday = summary.reduce((s, b) => s + Number(b.today_revenue), 0);
  const totalSales = summary.reduce((s, b) => s + Number(b.sale_count), 0);
  const todaySales = summary.reduce((s, b) => s + Number(b.today_count || 0), 0);
  const topBranch = summary.reduce((best, branch) => Number(branch.revenue) > Number(best?.revenue || 0) ? branch : best, summary[0] || { branch_name: 'N/A', revenue: 0 });
  const bestDay = weeklySales.reduce((best, day) => Number(day.revenue) > Number(best?.revenue || 0) ? day : best, weeklySales[0] || { label: 'N/A', revenue: 0 });
  const dailyBranchSales = summary.map((branch, index) => ({
    ...branch,
    dailyRevenue: Number(branch.today_revenue || 0),
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));
  const dailyRevenueTotal = dailyBranchSales.reduce((total, branch) => total + branch.dailyRevenue, 0);
  const vehicleOptions = [
    { id: 'bike', label: 'Bike', color: '#0f766e' },
    { id: 'car', label: 'Car', color: '#2563eb' },
    { id: 'rikshaw', label: 'Rikshaw', color: '#d97706' },
    { id: 'suv', label: 'SUV', color: '#dc2626' },
    { id: 'coaster', label: 'Coaster', color: '#7c3aed' },
    { id: 'truck', label: 'Truck', color: '#0891b2' },
  ];
  const dailyVehicleSales = vehicleOptions.map((vehicle) => ({
    ...vehicle,
    dailyRevenue: summary.reduce((total, branch) => total + Number(branch[`today_${vehicle.id}_revenue`] || 0), 0),
    count: summary.reduce((total, branch) => total + Number(branch[`today_${vehicle.id}_count`] || 0), 0),
  }));
  const dailyVehicleRevenueTotal = dailyVehicleSales.reduce((total, vehicle) => total + vehicle.dailyRevenue, 0);
  const paymentOptions = [
    { id: 'cash', label: 'Cash', color: '#0f766e' },
    { id: 'card', label: 'Card', color: '#2563eb' },
    { id: 'upi', label: 'Bank Transfer', color: '#d97706' },
  ];
  const todayKey = formatPkDateKey(new Date());
  const dailyPaymentSales = paymentOptions.map((payment) => {
    const paymentSales = recentSales.filter((sale) => (
      formatPkDateKey(parseTimestamp(sale.created_at)) === todayKey && sale.payment_method === payment.id
    ));
    return {
      ...payment,
      dailyRevenue: paymentSales.reduce((total, sale) => total + Number(sale.total || 0), 0),
      count: paymentSales.length,
    };
  });
  const dailyPaymentRevenueTotal = dailyPaymentSales.reduce((total, payment) => total + payment.dailyRevenue, 0);
  const hourlySales = Array.from({ length: 24 }, (_, hour) => {
    const salesAtHour = hourlySalesData.filter((sale) => {
      const saleDate = parseTimestamp(sale.created_at);
      const hourText = new Intl.DateTimeFormat('en-GB', { timeZone: PK_TIMEZONE, hour: '2-digit', hourCycle: 'h23' }).format(saleDate);
      return formatPkDateKey(saleDate) === selectedHourlyDate && Number(hourText) === hour;
    });
    return {
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      revenue: salesAtHour.reduce((total, sale) => total + Number(sale.total || 0), 0),
      count: salesAtHour.length,
    };
  });
  const hourlyMax = Math.max(...hourlySales.map((item) => item.revenue), 0);
  const hourlyChartWidth = 960;
  const hourlyChartHeight = 250;
  const hourlyChartPadding = { top: 22, right: 18, bottom: 42, left: 72 };
  const hourlyPlotWidth = hourlyChartWidth - hourlyChartPadding.left - hourlyChartPadding.right;
  const hourlyPlotHeight = hourlyChartHeight - hourlyChartPadding.top - hourlyChartPadding.bottom;
  const hourlyPoints = hourlySales.map((item, index) => ({
    ...item,
    x: hourlyChartPadding.left + (index * hourlyPlotWidth) / (hourlySales.length - 1),
    y: hourlyChartPadding.top + hourlyPlotHeight - (hourlyMax ? (item.revenue / hourlyMax) * hourlyPlotHeight : 0),
  }));
  const hourlyLinePoints = hourlyPoints.map((point) => `${point.x},${point.y}`).join(' ');
  const weeklyMax = Math.max(...weeklySales.map((day) => day.revenue), 0);
  const monthOptions = Array.from({ length: 12 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - index);
    return {
      value: formatPkMonthKey(date),
      label: date.toLocaleDateString('en-PK', { month: 'long', year: 'numeric', timeZone: PK_TIMEZONE }),
    };
  });
  const yearOptions = Array.from({ length: 5 }, (_, index) => String(new Date().getFullYear() - index));
  const yearlyMonths = Array.from({ length: 12 }, (_, index) => {
    const monthNumber = String(index + 1).padStart(2, '0');
    const monthValue = `${selectedYear}-${monthNumber}`;
    const value = yearlySales.find((item) => item.month === monthValue);
    return {
      value: monthValue,
      label: new Date(`${monthValue}-01T00:00:00Z`).toLocaleDateString('en-PK', { month: 'short', timeZone: PK_TIMEZONE }),
      revenue: Number(value?.revenue || 0),
      count: Number(value?.sale_count || 0),
    };
  });
  const yearlyMax = Math.max(...yearlyMonths.map((month) => month.revenue), 0);
  const selectedDate = new Date(`${selectedMonth}-01T00:00:00Z`);
  const daysInSelectedMonth = new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth() + 1, 0)).getUTCDate();
  const selectedSalesByDay = Object.fromEntries(selectedMonthSales.map((day) => [day.day, day]));
  const monthlySales = Array.from({ length: daysInSelectedMonth }, (_, index) => {
    const day = String(index + 1).padStart(2, '0');
    const key = `${selectedMonth}-${day}`;
    const value = selectedSalesByDay[key];
    return { key, label: String(index + 1), revenue: Number(value?.revenue || 0), count: Number(value?.sale_count || 0) };
  });
  const monthlyMax = Math.max(...monthlySales.map((month) => month.revenue), 0);
  const monthlyChartWidth = 720;
  const monthlyChartHeight = 260;
  const monthlyChartPadding = { top: 18, right: 16, bottom: 42, left: 16 };
  const monthlyPlotWidth = monthlyChartWidth - monthlyChartPadding.left - monthlyChartPadding.right;
  const monthlyPlotHeight = monthlyChartHeight - monthlyChartPadding.top - monthlyChartPadding.bottom;
  const monthlyPoints = monthlySales.map((month, index) => ({
    ...month,
    x: monthlyChartPadding.left + (index * monthlyPlotWidth) / Math.max(monthlySales.length - 1, 1),
    y: monthlyChartPadding.top + monthlyPlotHeight - (monthlyMax ? (month.revenue / monthlyMax) * monthlyPlotHeight : 0),
  }));
  const monthlyLinePoints = monthlyPoints.map((point) => `${point.x},${point.y}`).join(' ');

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div className="spinner" style={{ width: 36, height: 36, margin: '0 auto 12px' }} />
        <p>Loading sales analysis…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="dashboard-highlight-row">
        <div className="highlight-pill">
          <span className="highlight-emoji">🏆</span>
          Top branch: <strong>{topBranch.branch_name || 'N/A'}</strong>
        </div>
        <div className="highlight-pill">
          <span className="highlight-emoji">📈</span>
          Best day: <strong>{bestDay.label || 'N/A'}</strong>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-value">{PKR(totalRevenue)}</div>
          <div className="stat-label">Total Revenue (All Time)</div>
          <div className="stat-badge neutral">📊 All branches</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-value">{PKR(totalToday)}</div>
          <div className="stat-label">Today's Revenue</div>
          <div className="stat-badge up">🚀 {todaySales} sales today</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🧾</div>
          <div className="stat-value">{totalSales}</div>
          <div className="stat-label">Total Sales</div>
          <div className="stat-badge neutral">All time</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🏢</div>
          <div className="stat-value">{summary.length}</div>
          <div className="stat-label">Active Branches</div>
          <div className="stat-badge neutral">Centralized</div>
        </div>
      </div>

      <div className="card daily-analysis-card">
        <div className="hourly-analysis-section">
          <div style={{ marginBottom: 14 }}>
            <h3>Hourly Sales Analysis</h3>
            <p>Revenue across all 24 hours for the selected date</p>
            <div className="form-group" style={{ maxWidth: 220 }}>
              <label className="form-label" htmlFor="hourly-sales-date">Calendar date</label>
              <input id="hourly-sales-date" className="form-input" type="date" value={selectedHourlyDate} onChange={(event) => setSelectedHourlyDate(event.target.value)} />
            </div>
          </div>
          <div className="hourly-line-chart-wrap">
            <svg className="hourly-line-chart" viewBox={`0 0 ${hourlyChartWidth} ${hourlyChartHeight}`} role="img" aria-label="Hourly sales analysis for all 24 hours">
              {[0, 0.5, 1].map((ratio) => {
                const y = hourlyChartPadding.top + hourlyPlotHeight * ratio;
                const value = hourlyMax * (1 - ratio);
                return (
                  <g key={ratio}>
                    <line x1={hourlyChartPadding.left} x2={hourlyChartWidth - hourlyChartPadding.right} y1={y} y2={y} className="monthly-chart-grid" />
                    <text x={hourlyChartPadding.left - 8} y={y + 4} textAnchor="end" className="hourly-chart-value-label">{PKR(value)}</text>
                  </g>
                );
              })}
              <polyline points={hourlyLinePoints} className="hourly-chart-line" />
              {hourlyPoints.map((point) => (
                <g key={point.hour}>
                  <circle cx={point.x} cy={point.y} r="4" className="hourly-chart-point">
                    <title>{`${point.label}: ${PKR(point.revenue)} (${point.count} sales)`}</title>
                  </circle>
                  {point.revenue > 0 && <text x={point.x} y={Math.max(point.y - 9, 12)} textAnchor="middle" className="hourly-chart-point-value">{PKR(point.revenue)}</text>}
                  <text x={point.x} y={hourlyChartHeight - 16} textAnchor="middle" className="hourly-chart-label">{point.label}</text>
                </g>
              ))}
            </svg>
          </div>
        </div>
        <div className="daily-pie-charts">
          <section className="daily-pie-section">
            <div style={{ marginBottom: 14 }}>
              <h3>Daily Sales by Branch</h3>
              <p>Today&apos;s revenue share across all branches</p>
            </div>
            {dailyRevenueTotal === 0 ? (
              <div className="empty-state"><div className="empty-icon">📊</div><div className="empty-title">No sales today</div></div>
            ) : (
              <div className="daily-pie-layout">
                <div className="daily-pie-chart" style={{ background: `conic-gradient(${pieStops(dailyBranchSales, dailyRevenueTotal).join(', ')})` }} aria-label={`Daily branch sales total ${PKR(dailyRevenueTotal)}`} />
                <div className="daily-pie-legend">
                  {dailyBranchSales.map((branch) => (
                    <div className="daily-pie-legend-item" key={branch.id}>
                      <span className="daily-pie-swatch" style={{ background: branch.color }} />
                      <span className="daily-pie-branch">{branch.branch_name}</span>
                      <strong>{PKR(branch.dailyRevenue)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
          <section className="daily-pie-section">
            <div style={{ marginBottom: 14 }}>
              <h3>Daily Sales by Vehicle Type</h3>
              <p>Today&apos;s revenue across all billed vehicle types</p>
            </div>
            {dailyVehicleRevenueTotal === 0 ? (
              <div className="empty-state"><div className="empty-icon">🚗</div><div className="empty-title">No vehicle sales today</div></div>
            ) : (
              <div className="daily-pie-layout">
                <div className="daily-pie-chart" style={{ background: `conic-gradient(${pieStops(dailyVehicleSales, dailyVehicleRevenueTotal).join(', ')})` }} aria-label={`Daily vehicle sales total ${PKR(dailyVehicleRevenueTotal)}`} />
                <div className="daily-pie-legend">
                  {dailyVehicleSales.map((vehicle) => (
                    <div className="daily-pie-legend-item" key={vehicle.id}>
                      <span className="daily-pie-swatch" style={{ background: vehicle.color }} />
                      <span className="daily-pie-branch">{vehicle.label}</span>
                      <strong>{PKR(vehicle.dailyRevenue)} · {vehicle.count} sales</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
          <section className="daily-pie-section">
            <div style={{ marginBottom: 14 }}>
              <h3>Daily Sales by Payment</h3>
              <p>Today&apos;s revenue grouped by payment method</p>
            </div>
            {dailyPaymentRevenueTotal === 0 ? (
              <div className="empty-state"><div className="empty-icon">💳</div><div className="empty-title">No payment sales today</div></div>
            ) : (
              <div className="daily-pie-layout">
                <div className="daily-pie-chart" style={{ background: `conic-gradient(${pieStops(dailyPaymentSales, dailyPaymentRevenueTotal).join(', ')})` }} aria-label={`Daily payment sales total ${PKR(dailyPaymentRevenueTotal)}`} />
                <div className="daily-pie-legend">
                  {dailyPaymentSales.map((payment) => (
                    <div className="daily-pie-legend-item" key={payment.id}>
                      <span className="daily-pie-swatch" style={{ background: payment.color }} />
                      <span className="daily-pie-branch">{payment.label}</span>
                      <strong>{PKR(payment.dailyRevenue)} · {payment.count} sales</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="card weekly-analysis-card">
        <div style={{ marginBottom: 14 }}>
          <h3>Weekly Sales Analysis</h3>
          <p>Revenue and sales count for the last seven days</p>
        </div>
        <div className="chart-scroll-wrap">
          <div className="weekly-bar-chart">
            {weeklySales.map((day) => (
              <div className="weekly-bar-column" key={day.key}>
                <div className="weekly-bar-value">{day.revenue ? PKR(day.revenue) : 'Rs. 0'}</div>
                <div className="weekly-bar-track">
                  <div
                    className="weekly-bar"
                    style={{ height: weeklyMax ? `${Math.max((day.revenue / weeklyMax) * 100, day.revenue ? 4 : 0)}%` : 0 }}
                    title={`${day.dateLabel}: ${PKR(day.revenue)}, ${day.count} sales`}
                  />
                </div>
                <strong>{day.label}</strong>
                <span>{day.dateLabel}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card monthly-analysis-card">
        <div className="monthly-analysis-heading">
          <div>
            <h3>Monthly Sales Analysis</h3>
            <p>Daily revenue and sales count across all branches</p>
          </div>
          <select className="form-select monthly-month-select" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} aria-label="Select month for sales analysis">
            {monthOptions.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
          </select>
        </div>
        {monthlyMax === 0 ? (
          <div className="empty-state"><div className="empty-icon">📈</div><div className="empty-title">No monthly sales yet</div></div>
        ) : (
          <div className="monthly-line-chart-wrap">
            <svg className="monthly-line-chart" viewBox={`0 0 ${monthlyChartWidth} ${monthlyChartHeight}`} role="img" aria-label={`Daily sales revenue for ${selectedMonth}`}>
              {[0, 0.5, 1].map((ratio) => {
                const y = monthlyChartPadding.top + monthlyPlotHeight * ratio;
                return <line key={ratio} x1={monthlyChartPadding.left} x2={monthlyChartWidth - monthlyChartPadding.right} y1={y} y2={y} className="monthly-chart-grid" />;
              })}
              <polyline points={monthlyLinePoints} className="monthly-chart-line" />
              {monthlyPoints.map((point) => (
                <g key={point.key}>
                  <circle cx={point.x} cy={point.y} r="4" className="monthly-chart-point">
                    <title>{`${point.label}: ${PKR(point.revenue)} (${point.count} sales)`}</title>
                  </circle>
                  <text x={point.x} y={monthlyChartHeight - 16} textAnchor="middle" className="monthly-chart-label">{point.label}</text>
                </g>
              ))}
            </svg>
          </div>
        )}
      </div>

      <div className="card yearly-analysis-card">
        <div className="yearly-analysis-heading">
          <div>
            <h3>Yearly Sales Analysis</h3>
            <p>Monthly revenue across all branches</p>
          </div>
          <select className="form-select yearly-year-select" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} aria-label="Select year for sales analysis">
            {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
        {yearlyMax === 0 ? (
          <div className="empty-state"><div className="empty-icon">📊</div><div className="empty-title">No yearly sales yet</div></div>
        ) : (
          <div className="chart-scroll-wrap">
            <div className="weekly-bar-chart yearly-bar-chart">
              {yearlyMonths.map((month) => (
                <div className="weekly-bar-column" key={month.value}>
                  <div className="weekly-bar-value">{month.revenue ? PKR(month.revenue) : 'Rs. 0'}</div>
                  <div className="weekly-bar-track">
                    <div
                      className="weekly-bar"
                      style={{ height: `${Math.max((month.revenue / yearlyMax) * 100, month.revenue ? 4 : 0)}%` }}
                      title={`${month.label}: ${PKR(month.revenue)}, ${month.count} sales`}
                    />
                  </div>
                  <strong>{month.label}</strong>
                  <span>{month.count} sales</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
