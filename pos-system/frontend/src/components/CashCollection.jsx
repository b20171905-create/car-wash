import React, { useEffect, useState } from 'react';
import { api } from '../api';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
const formatMoney = (value) => `Rs. ${Number(value || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CashCollection() {
  const [date, setDate] = useState(today());
  const [summary, setSummary] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMessage(null);
    Promise.all([api.getSummary(date), api.getExpenses({ date })])
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
  }, [date]);

  const revenue = summary.reduce((total, branch) => total + Number(branch.today_revenue || 0), 0);
  const card = summary.reduce((total, branch) => total + Number(branch.today_card_revenue || 0), 0);
  const bankTransfer = summary.reduce((total, branch) => total + Number(branch.today_upi_revenue || 0), 0);
  const totalExpenses = expenses.reduce((total, expense) => total + Number(expense.amount || 0), 0);
  const cashCollected = revenue - totalExpenses - card - bankTransfer;

  return (
    <div className="cash-collection-page">
      {message && <div className="status-msg error" style={{ marginBottom: 16 }}>{message.text}</div>}
      <div className="card cash-collection-toolbar">
        <div>
          <div className="section-title">Cash collected</div>
          <p style={{ margin: 0 }}>Revenue less expenses, card payments, and bank transfers.</p>
        </div>
        <div className="form-group cash-collection-date">
          <label className="form-label" htmlFor="cash-collection-date">Calendar date</label>
          <input id="cash-collection-date" className="form-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
      </div>

      {loading ? <div className="page-loading"><div className="spinner" style={{ width: 36, height: 36 }} /></div> : (
        <>
          <div className="cash-collection-hero">
            <span>Cash collected on {date}</span>
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