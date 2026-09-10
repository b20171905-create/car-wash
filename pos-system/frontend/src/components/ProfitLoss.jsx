import React, { useEffect, useState } from 'react';
import { api } from '../api';

const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => `${today().slice(0, 8)}01`;
const formatMoney = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;

export default function ProfitLoss({ user }) {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState([]);
  const [report, setReport] = useState(null);
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

  return (
    <div>
      {message && <div className={`status-msg ${message.type}`} style={{ marginBottom: 16 }}>{message.text}</div>}
      <div className="card" style={{ maxWidth: 1100, marginBottom: 16 }}>
        <div className="section-actions">
          <div><div className="section-title">Report period</div><p style={{ margin: 0 }}>Paid sales minus recorded operating expenses.</p></div>
          <div className="form-row" style={{ margin: 0 }}>
            <div className="form-group"><label className="form-label" htmlFor="profit-loss-from">From</label><input id="profit-loss-from" className="form-input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></div>
            <div className="form-group"><label className="form-label" htmlFor="profit-loss-to">To</label><input id="profit-loss-to" className="form-input" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div>
            {user.role === 'owner' && <div className="form-group"><label className="form-label" htmlFor="profit-loss-branch">Branch</label><select id="profit-loss-branch" className="form-select" value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">All branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>}
          </div>
        </div>
      </div>

      {loading ? <div className="page-loading"><div className="spinner" style={{ width: 36, height: 36 }} /></div> : report && <>
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-icon">💰</div><div className="stat-value">{formatMoney(revenue)}</div><div className="stat-label">Paid Revenue</div><div className="stat-badge neutral">{report.sale_count} sales</div></div>
          <div className="stat-card"><div className="stat-icon">💸</div><div className="stat-value">{formatMoney(expenses)}</div><div className="stat-label">Operating Expenses</div><div className="stat-badge neutral">{report.expense_count} entries</div></div>
          <div className="stat-card"><div className="stat-icon">{profit >= 0 ? '📈' : '📉'}</div><div className="stat-value" style={{ color: profit >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatMoney(profit)}</div><div className="stat-label">Net Profit / Loss</div><div className="stat-badge neutral">{margin.toFixed(1)}% margin</div></div>
        </div>

        <div className="card" style={{ maxWidth: 1100, marginTop: 16 }}>
          <div className="section-title" style={{ marginBottom: 12 }}>Expense breakdown</div>
          {report.categories.length === 0 ? <p>No expenses recorded for this period.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Category</th><th>Entries</th><th>Amount</th></tr></thead><tbody>{report.categories.map((item) => <tr key={item.category}><td>{item.category}</td><td>{item.expense_count}</td><td>{formatMoney(item.amount)}</td></tr>)}</tbody></table></div>}
        </div>
      </>}
    </div>
  );
}
