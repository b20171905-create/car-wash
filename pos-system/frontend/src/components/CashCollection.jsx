import React, { useEffect, useState } from 'react';
import { api } from '../api';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
const formatMoney = (value) => `Rs. ${Number(value || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CashCollection() {
  const [mode, setMode] = useState('single');
  const [date, setDate] = useState(today());
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [summary, setSummary] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = mode === 'single' ? { date } : { from, to };
    if (mode === 'range' && from > to) {
      setSummary([]);
      setExpenses([]);
      setMessage({ type: 'error', text: 'The start date cannot be after the end date.' });
      setLoading(false);
      return () => { active = false; };
    }
    setMessage(null);
    Promise.all([api.getSummary(params), api.getExpenses(params)])
      .then(([summaryData, expenseData]) => {
        if (!active) return;
        setSummary(summaryData);
        setExpenses(expenseData);
      })
      .catch((error) => {
        if (!active) return;
        setSummary([]);
        setExpenses([]);
        setMessage({ type: 'error', text: error.message });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [date, mode, from, to]);

  const revenue = summary.reduce((total, branch) => total + Number(branch.today_revenue || 0), 0);
  const card = summary.reduce((total, branch) => total + Number(branch.today_card_revenue || 0), 0);
  const bankTransfer = summary.reduce((total, branch) => total + Number(branch.today_upi_revenue || 0), 0);
  const totalExpenses = expenses.reduce((total, expense) => total + Number(expense.amount || 0), 0);
  const cashCollected = revenue - totalExpenses - card - bankTransfer;
  const periodLabel = mode === 'single' ? date : `${from} to ${to}`;

  return (
    <div className="cash-collection-page">
      {message && <div className="status-msg error" style={{ marginBottom: 16 }}>{message.text}</div>}
      <div className="card cash-collection-toolbar">
        <div>
          <div className="section-title">Cash collected</div>
          <p style={{ margin: 0 }}>Revenue less expenses, card payments, and bank transfers.</p>
        </div>
        <div className="cash-collection-filters">
          <div className="cash-collection-mode" role="group" aria-label="Cash collection period">
            <button className={`btn btn-sm ${mode === 'single' ? 'btn-primary' : 'btn-ghost'}`} type="button" onClick={() => setMode('single')}>Single date</button>
            <button className={`btn btn-sm ${mode === 'range' ? 'btn-primary' : 'btn-ghost'}`} type="button" onClick={() => setMode('range')}>Date range</button>
          </div>
          {mode === 'single' ? <div className="form-group cash-collection-date"><label className="form-label" htmlFor="cash-collection-date">Calendar date</label><input id="cash-collection-date" className="form-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div> : <div className="cash-collection-range"><div className="form-group"><label className="form-label" htmlFor="cash-collection-from">From</label><input id="cash-collection-from" className="form-input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></div><div className="form-group"><label className="form-label" htmlFor="cash-collection-to">To</label><input id="cash-collection-to" className="form-input" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div></div>}
        </div>
      </div>

      {loading ? <div className="page-loading"><div className="spinner" style={{ width: 36, height: 36 }} /></div> : (
        <>
          <div className="cash-collection-hero">
            <span>Cash collected for {periodLabel}</span>
            <strong className={cashCollected < 0 ? 'is-negative' : ''}>{formatMoney(cashCollected)}</strong>
          </div>
          <div className="cash-collection-grid">
            <div className="cash-collection-card"><span>Revenue generated</span><strong>{formatMoney(revenue)}</strong></div>
            <div className="cash-collection-card"><span>Expenses</span><strong>{formatMoney(totalExpenses)}</strong></div>
            <div className="cash-collection-card"><span>Card payments</span><strong>{formatMoney(card)}</strong></div>
            <div className="cash-collection-card"><span>Bank transfers</span><strong>{formatMoney(bankTransfer)}</strong></div>
          </div>
          <div className="card cash-collection-breakdown">
            <div className="section-title">Collection calculation</div>
            <div className="cash-collection-equation">
              <span>{formatMoney(revenue)} revenue</span><b>−</b><span>{formatMoney(totalExpenses)} expenses</span><b>−</b><span>{formatMoney(card)} card</span><b>−</b><span>{formatMoney(bankTransfer)} bank transfer</span><b>=</b><strong>{formatMoney(cashCollected)}</strong>
            </div>
          </div>
        </>
      )}
    </div>
  );
}