import React, { useEffect, useState } from 'react';
import { api } from '../api';

const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => today().slice(0, 7);
const monthDateRange = (month) => {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` };
};
const formatMoney = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;
const formatCompactMoney = (value) => `Rs. ${Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
const formatChartDate = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '—';
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)).toLocaleDateString('en-PK', { month: 'short', day: 'numeric', timeZone: 'UTC' });
};
const getMonthWindow = (report, daily) => {
  const start = new Date(`${report?.from || currentMonth() + '-01'}T12:00:00Z`);
  const end = new Date(`${report?.to || currentMonth() + '-01'}T12:00:00Z`);
  const valuesByDay = new Map(daily.map((item) => [item.day, item]));
  const window = [];
  for (let date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    const day = date.toISOString().slice(0, 10);
    window.push({ day, revenue: Number(valuesByDay.get(day)?.revenue || 0), expenses: Number(valuesByDay.get(day)?.expenses || 0) });
  }
  return window;
};

const getSevenDayWindow = (report, monthly) => {
  const todayKey = today();
  const reportEnd = report?.to && report.to > todayKey ? todayKey : report?.to;
  const end = new Date(`${reportEnd || todayKey}T12:00:00Z`);
  const valuesByDay = new Map(monthly.map((item) => [item.day, item]));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - (6 - index));
    const day = date.toISOString().slice(0, 10);
    const values = valuesByDay.get(day);
    return { day, revenue: Number(values?.revenue || 0), expenses: Number(values?.expenses || 0) };
  }).filter((item) => !report?.from || item.day >= report.from);
};

function buildChart(data) {
  const width = 640;
  const height = 250;
  const padding = { top: 18, right: 14, bottom: 32, left: 54 };
  const values = data.flatMap((item) => [Number(item.revenue || 0), Number(item.expenses || 0)]);
  const max = Math.max(...values, 1);
  const x = (index) => padding.left + (index / Math.max(data.length - 1, 1)) * (width - padding.left - padding.right);
  const y = (value) => padding.top + (1 - value / max) * (height - padding.top - padding.bottom);
  const points = (key) => data.map((item, index) => `${x(index)},${y(item[key])}`).join(' ');
  return { width, height, padding, max, x, y, revenuePoints: points('revenue'), expensePoints: points('expenses') };
}

export default function ProfitLoss({ user }) {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState([]);
  const [report, setReport] = useState(null);
  const [categorySearch, setCategorySearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  async function loadReport() {
    setLoading(true);
    setMessage(null);
    try {
      const data = await api.getProfitLoss({ ...monthDateRange(selectedMonth), branch_id: branchId });
      setReport(data);
    } catch (error) {
      setReport(null);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user.role === 'owner') {
      api.getBranches().then(setBranches).catch(() => setBranches([]));
    }
  }, [user.role]);

  useEffect(() => { loadReport(); }, [selectedMonth, branchId]);

  const profit = Number(report?.profit || 0);
  const revenue = Number(report?.revenue || 0);
  const expenses = Number(report?.expenses || 0);
  const margin = revenue ? (profit / revenue) * 100 : 0;
  const daily = report?.daily || [];
  const monthly = getMonthWindow(report, daily);
  const weekly = getSevenDayWindow(report, monthly);
  const chart = buildChart(monthly);
  const weeklyMax = Math.max(...weekly.flatMap((item) => [Number(item.revenue || 0), Number(item.expenses || 0)]), 1);
  const filteredCategories = (report?.categories || []).filter((item) => item.category.toLowerCase().includes(categorySearch.trim().toLowerCase()));

  return (
    <div className="profit-loss-page">
      {message && <div className={`status-msg ${message.type}`} style={{ marginBottom: 16 }}>{message.text}</div>}
      <div className="profit-loss-heading">
        <div>
          <div className="profit-loss-eyebrow">Owner workspace</div>
          <h1>Profit &amp; loss</h1>
        </div>
        <div className="profit-loss-filters">
          {user.role === 'owner' && <select id="profit-loss-branch" className="profit-loss-branch" value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">All branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>}
        </div>
      </div>

      {loading ? <div className="page-loading"><div className="spinner" style={{ width: 36, height: 36 }} /></div> : report && <>
        <div className="profit-loss-kpis">
          <div className="profit-loss-kpi"><div className="profit-loss-kpi-label">▣ &nbsp; Paid revenue</div><strong>{formatCompactMoney(revenue)}</strong><span>{report.sale_count} sales</span></div>
          <div className="profit-loss-kpi"><div className="profit-loss-kpi-label">▤ &nbsp; Operating expenses</div><strong>{formatCompactMoney(expenses)}</strong><span>{report.expense_count} entries</span></div>
          <div className={`profit-loss-kpi profit-loss-kpi-positive${profit < 0 ? ' is-negative' : ''}`}><div className="profit-loss-kpi-label">↗ &nbsp; Net profit</div><strong>{formatCompactMoney(profit)}</strong><span>{margin.toFixed(1)}% margin</span></div>
        </div>

        <section className="profit-loss-weekly-panel">
          <div className="profit-loss-section-heading">
            <div><h2>Last 7 days profit &amp; sales analysis</h2><p>Revenue and expenses compared day by day</p></div>
            <div className="profit-loss-legend"><span><i className="profit-loss-legend-revenue" />Revenue</span><span><i className="profit-loss-legend-expenses" />Expenses</span></div>
          </div>
          {weekly.length === 0 ? <p className="profit-loss-empty">No weekly activity recorded for this period.</p> : <div className="profit-loss-weekly-chart">{weekly.map((item) => <div className="profit-loss-week" key={item.day}><div className="profit-loss-week-bars"><div className="profit-loss-week-bar-group"><span className="profit-loss-week-value">{formatCompactMoney(item.revenue)}</span><div className="profit-loss-week-bar profit-loss-week-bar-revenue" style={{ height: `${Math.max((Number(item.revenue || 0) / weeklyMax) * 100, 2)}%` }} /></div><div className="profit-loss-week-bar-group"><span className="profit-loss-week-value">{formatCompactMoney(item.expenses)}</span><div className="profit-loss-week-bar profit-loss-week-bar-expenses" style={{ height: `${Math.max((Number(item.expenses || 0) / weeklyMax) * 100, 2)}%` }} /></div></div><strong>{formatChartDate(item.day)}</strong></div>)}</div>}
        </section>

        <div className="profit-loss-grid">
          <section className="profit-loss-chart-panel">
            <div className="profit-loss-chart-heading"><h2>Monthly revenue &amp; expenses</h2><label className="profit-loss-month"><span className="sr-only">Report month</span><input id="profit-loss-month" type="month" value={selectedMonth} max={currentMonth()} onChange={(event) => setSelectedMonth(event.target.value || currentMonth())} /></label></div>
            {monthly.length === 0 ? <p className="profit-loss-empty">No monthly activity recorded for this period.</p> : <div className="profit-loss-chart-wrap">
              <svg className="profit-loss-chart" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="Revenue versus expenses over time">
                {[0, 0.25, 0.5, 0.75, 1].map((level) => <g key={level}><line x1={chart.padding.left} x2={chart.width - chart.padding.right} y1={chart.y(chart.max * level)} y2={chart.y(chart.max * level)} className="profit-loss-grid-line" /><text x={chart.padding.left - 8} y={chart.y(chart.max * level) + 4} textAnchor="end" className="profit-loss-axis-label">{formatCompactMoney(chart.max * level)}</text></g>)}
                <polygon points={`${chart.revenuePoints} ${chart.width - chart.padding.right},${chart.height - chart.padding.bottom} ${chart.padding.left},${chart.height - chart.padding.bottom}`} className="profit-loss-area" />
                <polyline points={chart.revenuePoints} className="profit-loss-line profit-loss-line-revenue" />
                <polyline points={chart.expensePoints} className="profit-loss-line profit-loss-line-expenses" />
                {monthly.map((item, index) => (index === 0 || index === monthly.length - 1 || index % 5 === 0) && <text key={item.day} x={chart.x(index)} y={chart.height - 8} textAnchor="middle" className="profit-loss-axis-label">{formatChartDate(item.day)}</text>)}
              </svg>
              <div className="profit-loss-legend"><span><i className="profit-loss-legend-revenue" />Revenue</span><span><i className="profit-loss-legend-expenses" />Expenses</span></div>
            </div>}
          </section>
          <section className="profit-loss-expense-panel">
            <div className="profit-loss-expense-heading"><h2>Expense breakdown</h2><input type="search" placeholder="Search category" aria-label="Search expense category" value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} /></div>
            {filteredCategories.length === 0 ? <p className="profit-loss-empty">No expenses recorded for this period.</p> : <div className="profit-loss-expense-table"><div className="profit-loss-expense-row profit-loss-expense-header"><span>Category</span><span>Entries</span><span>Amount</span></div>{filteredCategories.map((item) => <div className="profit-loss-expense-row" key={item.category}><span>{item.category}</span><span>{item.expense_count}</span><strong>{formatCompactMoney(item.amount)}</strong></div>)}</div>}
          </section>
        </div>
      </>}
    </div>
  );
}
