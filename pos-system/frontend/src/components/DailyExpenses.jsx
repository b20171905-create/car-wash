import React, { useEffect, useState } from 'react';
import { api } from '../api';

const today = () => new Date().toISOString().slice(0, 10);
const formatMoney = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;

export default function DailyExpenses({ user }) {
  const [date, setDate] = useState(today());
  const [expenses, setExpenses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ category: '', amount: '', notes: '', branch_id: user.branch_id || '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const canViewExpenses = user.role === 'owner' || user.role === 'branch_manager';

  async function loadExpenses() {
    if (!canViewExpenses) return;
    setLoading(true);
    try {
      const [items, availableBranches] = await Promise.all([
        api.getExpenses({ date }),
        user.role === 'owner' ? api.getBranches() : Promise.resolve([]),
      ]);
      setExpenses(items);
      setBranches(availableBranches);
      if (user.role === 'owner' && !form.branch_id && availableBranches[0]) {
        setForm((current) => ({ ...current, branch_id: availableBranches[0].id }));
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadExpenses(); }, [date, canViewExpenses]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage(null);
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api.createExpense({ ...form, expense_date: date });
      setForm((current) => ({ ...current, category: '', amount: '', notes: '' }));
      setMessage({ type: 'success', text: 'Expense recorded.' });
      if (canViewExpenses) await loadExpenses();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await api.deleteExpense(id);
      setExpenses((current) => current.filter((expense) => expense.id !== id));
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  }

  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  return (
    <div>
      {message && <div className={`status-msg ${message.type}`} style={{ marginBottom: 16 }}>{message.text}</div>}
      <div className="card" style={{ maxWidth: 980 }}>
        <div className="section-actions">
          <div><div className="section-title">Record expense</div><p style={{ margin: 0 }}>Add operating costs for the selected day.</p></div>
          {canViewExpenses && <div>Total: <strong>{formatMoney(total)}</strong></div>}
        </div>
        <form onSubmit={save}>
          <div className="form-row">
            <div className="form-group"><label className="form-label" htmlFor="expense-date">Date</label><input id="expense-date" className="form-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></div>
            <div className="form-group"><label className="form-label" htmlFor="expense-category">Category</label><input id="expense-category" className="form-input" value={form.category} onChange={(event) => update('category', event.target.value)} placeholder="Fuel, supplies, wages..." required /></div>
            <div className="form-group"><label className="form-label" htmlFor="expense-amount">Amount</label><input id="expense-amount" className="form-input" type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => update('amount', event.target.value)} required /></div>
          </div>
          <div className="form-row">
            {user.role === 'owner' && <div className="form-group"><label className="form-label" htmlFor="expense-branch">Branch</label><select id="expense-branch" className="form-select" value={form.branch_id} onChange={(event) => update('branch_id', event.target.value)} required><option value="">Select branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>}
            <div className="form-group" style={{ flex: 2 }}><label className="form-label" htmlFor="expense-notes">Notes</label><input id="expense-notes" className="form-input" value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Optional details" /></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? <span className="spinner" /> : 'Add Expense'}</button></div>
        </form>
      </div>
      {canViewExpenses && <div className="card" style={{ maxWidth: 980, marginTop: 16 }}>
        <div className="section-title" style={{ marginBottom: 12 }}>Expenses for {date}</div>
        {loading ? <div className="page-loading"><div className="spinner" style={{ width: 32, height: 32 }} /></div> : expenses.length === 0 ? <p>No expenses recorded for this date.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Category</th><th>Branch</th><th>Notes</th><th>Amount</th><th /></tr></thead><tbody>{expenses.map((expense) => <tr key={expense.id}><td>{expense.category}</td><td>{expense.branch_name}</td><td>{expense.notes || '—'}</td><td>{formatMoney(expense.amount)}</td><td><button className="btn btn-danger btn-sm" type="button" onClick={() => remove(expense.id)}>Delete</button></td></tr>)}</tbody></table></div>}
      </div>}
    </div>
  );
}
