import React, { useState } from 'react';
import { api } from '../api';

const VEHICLE_TYPES = ['bike', 'car', 'rikshaw', 'suv', 'coaster', 'truck'];
const PAYMENT_METHODS = [
  ['cash', 'Cash'],
  ['card', 'Card'],
  ['upi', 'Bank Transfer'],
  ['wallet', 'Wallet'],
  ['other', 'Other'],
];

export default function SlipEditorModal({ saleData, onClose, onSaved }) {
  const sale = saleData.sale;
  const [form, setForm] = useState({
    name: sale.customer_name || '',
    phone: sale.customer_phone || '',
    vehicle_type: sale.vehicle_type || 'car',
    vehicle_number: sale.vehicle_number || '',
    vehicle_model: sale.vehicle_model || '',
    payment_method: sale.payment_method || 'cash',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await api.updateSaleSlip(sale.id, form);
      onSaved(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Edit Slip</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              Receipt #{sale.receipt_number} · totals and services stay unchanged
            </p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close slip editor">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="slip-customer-name">Customer name</label>
              <input id="slip-customer-name" className="form-input" required value={form.name} onChange={(event) => update('name', event.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="slip-customer-phone">Phone</label>
              <input id="slip-customer-phone" className="form-input" required value={form.phone} onChange={(event) => update('phone', event.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="slip-vehicle-number">Vehicle number</label>
              <input id="slip-vehicle-number" className="form-input" required value={form.vehicle_number} onChange={(event) => update('vehicle_number', event.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="slip-vehicle-model">Vehicle model</label>
              <input id="slip-vehicle-model" className="form-input" value={form.vehicle_model} onChange={(event) => update('vehicle_model', event.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="slip-vehicle-type">Vehicle type</label>
              <select id="slip-vehicle-type" className="form-select" value={form.vehicle_type} onChange={(event) => update('vehicle_type', event.target.value)}>
                {VEHICLE_TYPES.map((type) => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="slip-payment">Payment method</label>
              <select id="slip-payment" className="form-select" value={form.payment_method} onChange={(event) => update('payment_method', event.target.value)}>
                {PAYMENT_METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>

          {error && <div className="status-msg error" style={{ marginBottom: 14 }}>{error}</div>}
          <div className="modal-footer" style={{ padding: 0, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : 'Save Slip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
