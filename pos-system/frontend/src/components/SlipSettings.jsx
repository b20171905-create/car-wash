import React, { useEffect, useState } from 'react';
import { api } from '../api';

const DEFAULTS = {
  paper_columns: 42,
  left_padding: 0,
  right_padding: 0,
  top_feed: 0,
  bottom_feed: 3,
  header_alignment: 'center',
};

function Field({ label, value, onChange, min, max, help }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input className="form-input" type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      {help && <small style={{ color: 'var(--text-muted)' }}>{help}</small>}
    </div>
  );
}

export default function SlipSettings() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    api.getReceiptSettings()
      .then(setSettings)
      .catch((error) => setMessage({ type: 'error', text: error.message }))
      .finally(() => setLoading(false));
  }, []);

  function update(field, value) {
    setSettings((current) => ({ ...current, [field]: value }));
    setMessage(null);
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      setSettings(await api.updateReceiptSettings(settings));
      setMessage({ type: 'success', text: 'Slip settings saved. New receipts will use them.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setSettings(DEFAULTS);
    setMessage(null);
  }

  const previewWidth = Math.min(100, Math.max(64, settings.paper_columns * 2));
  const previewStyle = {
    width: `${previewWidth}%`,
    paddingLeft: `${settings.left_padding * 2}px`,
    paddingRight: `${settings.right_padding * 2}px`,
    paddingTop: `${Math.max(8, settings.top_feed * 4)}px`,
    paddingBottom: `${Math.max(12, settings.bottom_feed * 4)}px`,
    textAlign: settings.header_alignment,
  };

  if (loading) return <div className="page-loading"><div className="spinner" style={{ width: 36, height: 36 }} /><p>Loading slip settings...</p></div>;

  return (
    <div className="slip-settings-page">
      {message && <div className={`status-msg ${message.type}`} style={{ marginBottom: 16 }}>{message.text}</div>}
      <div className="card" style={{ maxWidth: 980 }}>
        <div className="section-actions">
          <div>
            <div className="section-title">Thermal slip layout</div>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>These settings apply to new and reprinted thermal receipts.</p>
          </div>
        </div>
        <form onSubmit={save}>
          <div className="form-row">
            <Field label="Paper columns" value={settings.paper_columns} min={32} max={48} onChange={(value) => update('paper_columns', value)} help="80 mm rolls are commonly 42 columns." />
            <Field label="Left padding" value={settings.left_padding} min={0} max={10} onChange={(value) => update('left_padding', value)} help="Character spaces." />
            <Field label="Right padding" value={settings.right_padding} min={0} max={10} onChange={(value) => update('right_padding', value)} help="Character spaces." />
          </div>
          <div className="form-row">
            <Field label="Top feed" value={settings.top_feed} min={0} max={10} onChange={(value) => update('top_feed', value)} help="Blank lines before the header." />
            <Field label="Bottom feed" value={settings.bottom_feed} min={0} max={10} onChange={(value) => update('bottom_feed', value)} help="Blank lines before cutting." />
            <div className="form-group">
              <label className="form-label">Header alignment</label>
              <select className="form-select" value={settings.header_alignment} onChange={(event) => update('header_alignment', event.target.value)}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
              <small style={{ color: 'var(--text-muted)' }}>Controls branch name and header lines.</small>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={reset}>Reset Defaults</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <span className="spinner" /> : 'Save Settings'}</button>
          </div>
        </form>
      </div>

      <div className="card" style={{ maxWidth: 980, marginTop: 16 }}>
        <div className="section-title" style={{ marginBottom: 12 }}>Live preview</div>
        <div style={{ background: '#e9edf0', padding: 18, overflow: 'auto' }}>
          <div style={{ ...previewStyle, minWidth: 280, margin: '0 auto', background: '#fff', color: '#111', fontFamily: 'Courier New, monospace', fontSize: 13, lineHeight: 1.35, boxShadow: '0 4px 18px rgba(0,0,0,.12)' }}>
            <strong style={{ fontSize: 17 }}>TIGER CAR WASH</strong>
            <div>EURO FUEL STATION</div>
            <div>03074298550</div>
            <hr />
            <div style={{ textAlign: 'left' }}>Customer: Hammad</div>
            <div style={{ textAlign: 'left' }}>Vehicle: ABC 123</div>
            <div style={{ textAlign: 'left' }}>Receipt #017</div>
            <hr />
            <div style={{ textAlign: 'left' }}>Car Service (SUV)     x1 Rs. 600.00</div>
            <div style={{ textAlign: 'left' }}>Bike Wash              x1 Rs. 250.00</div>
            <hr />
            <strong style={{ display: 'block', textAlign: 'left' }}>TOTAL:              Rs. 850.00</strong>
            <div style={{ textAlign: 'left' }}>Paid via: CASH</div>
            <div style={{ marginTop: 8 }}>Thank you for choosing<br />Tiger Car Wash<br />Come back again</div>
          </div>
        </div>
      </div>
    </div>
  );
}
