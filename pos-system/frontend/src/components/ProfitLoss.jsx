import React, { useEffect, useState } from 'react';
import { api } from '../api';

const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => `${today().slice(0, 8)}01`;
const formatMoney = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;
const formatCompactMoney = (value) => `Rs. ${Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;

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
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState([]);
  const [report, setReport] = useState(null);
  const [categorySearch, setCategorySearch] = useState('');
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  async function loadReport() {
    setLoading(true);
    setMessage(null);
    try {
      const data = await api.getProfitLoss({ from, to, branch_id: branchId });
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

  useEffect(() => { loadReport(); }, [from, to, branchId]);

  const profit = Number(report?.profit || 0);
  const revenue = Number(report?.revenue || 0);
  const expenses = Number(report?.expenses || 0);
  const margin = revenue ? (profit / revenue) * 100 : 0;
  const daily = report?.daily || [];
  const chart = buildChart(daily);
  const filteredCategories = (report?.categories || []).filter((item) => item.category.toLowerCase().includes(categorySearch.trim().toLowerCase()));
  const visibleCategories = showAllCategories ? filteredCategories : filteredCategories.slice(0, 4);
  const remainingCategories = Math.max(filteredCategories.length - visibleCategories.length, 0);

  return (
    <div className="profit-loss-page">
      {message && <div className={`status-msg ${message.type}`} style={{ marginBottom: 16 }}>{message.text}</div>}
      <div className="profit-loss-heading">
        <div>
          <div className="profit-loss-eyebrow">Owner workspace</div>
          <h1>Profit &amp; loss</h1>
        </div>
        <div className="profit-loss-filters">
          <label className="profit-loss-date"><span className="sr-only">From date</span><input id="profit-loss-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <span className="profit-loss-to">to</span>
          <label className="profit-loss-date"><span className="sr-only">To date</span><input id="profit-loss-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          {user.role === 'owner' && <select id="profit-loss-branch" className="profit-loss-branch" value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">All branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>}
        </div>
      </div>

      {loading ? <div className="page-loading"><div className="spinner" style={{ width: 36, height: 36 }} /></div> : report && <>
        <div className="profit-loss-kpis">
          <div className="profit-loss-kpi"><div className="profit-loss-kpi-label">▣ &nbsp; Paid revenue</div><strong>{formatCompactMoney(revenue)}</strong><span>{report.sale_count} sales</span></div>
          <div className="profit-loss-kpi"><div className="profit-loss-kpi-label">▤ &nbsp; Operating expenses</div><strong>{formatCompactMoney(expenses)}</strong><span>{report.expense_count} entries</span></div>
          <div className={`profit-loss-kpi profit-loss-kpi-positive${profit < 0 ? ' is-negative' : ''}`}><div className="profit-loss-kpi-label">↗ &nbsp; Net profit</div><strong>{formatCompactMoney(profit)}</strong><span>{margin.toFixed(1)}% margin</span></div>
        </div>

        <div className="profit-loss-grid">
          <section className="profit-loss-chart-panel">
            <h2>Revenue vs expenses</h2>
            {daily.length === 0 ? <p className="profit-loss-empty">No daily activity recorded for this period.</p> : <div className="profit-loss-chart-wrap">
              <svg className="profit-loss-chart" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="Revenue versus expenses over time">
                {[0, 0.25, 0.5, 0.75, 1].map((level) => <g key={level}><line x1={chart.padding.left} x2={chart.width - chart.padding.right} y1={chart.y(chart.max * level)} y2={chart.y(chart.max * level)} className="profit-loss-grid-line" /><text x={chart.padding.left - 8} y={chart.y(chart.max * level) + 4} textAnchor="end" className="profit-loss-axis-label">{formatCompactMoney(chart.max * level)}</text></g>)}
                <polygon points={`${chart.revenuePoints} ${chart.width - chart.padding.right},${chart.height - chart.padding.bottom} ${chart.padding.left},${chart.height - chart.padding.bottom}`} className="profit-loss-area" />
                <polyline points={chart.revenuePoints} className="profit-loss-line profit-loss-line-revenue" />
                <polyline points={chart.expensePoints} className="profit-loss-line profit-loss-line-expenses" />
                {daily.map((item, index) => <text key={item.day} x={chart.x(index)} y={chart.height - 8} textAnchor="middle" className="profit-loss-axis-label">{new Date(`${item.day}T12:00:00`).toLocaleDateString('en-PK', { month: 'short', day: 'numeric' })}</text>)}
              </svg>
              <div className="profit-loss-legend"><span><i className="profit-loss-legend-revenue" />Revenue</span><span><i className="profit-loss-legend-expenses" />Expenses</span></div>
            </div>}
          </section>
          <section className="profit-loss-expense-panel">
            <div className="profit-loss-expense-heading"><h2>Expense breakdown</h2><input type="search" placeholder="Search category" aria-label="Search expense category" value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} /></div>
            {visibleCategories.length === 0 ? <p className="profit-loss-empty">No expenses recorded for this period.</p> : <div className="profit-loss-expense-table"><div className="profit-loss-expense-row profit-loss-expense-header"><span>Category</span><span>Entries</span><span>Amount</span></div>{visibleCategories.map((item) => <div className="profit-loss-expense-row" key={item.category}><span>{item.category}</span><span>{item.expense_count}</span><strong>{formatCompactMoney(item.amount)}</strong></div>)}{(remainingCategories > 0 || showAllCategories) && <button type="button" className="profit-loss-more" onClick={() => setShowAllCategories((expanded) => !expanded)}>{showAllCategories ? '− Show fewer categories' : `··· ${remainingCategories} more categor${remainingCategories === 1 ? 'y' : 'ies'}`}</button>}</div>}
          </section>
        </div>
      </>}
    </div>
  );
}
