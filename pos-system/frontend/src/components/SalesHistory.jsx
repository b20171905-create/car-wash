import React, { useEffect, useState } from 'react';
import { api } from '../api';
import ReceiptModal from './ReceiptModal';

const PKR = (n) => `Rs. ${Number(n).toFixed(0)}`;

const PAYMENT_LABELS = { cash: '💵 Cash', card: '💳 Card', upi: '🏦 Bank Transfer', wallet: '👛 Wallet', other: '🔖 Other', '': 'All Methods' };

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function SalesHistory({ user }) {
  const [sales, setSales] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reprinting, setReprinting] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [receiptAction, setReceiptAction] = useState(null);
  const [openActionId, setOpenActionId] = useState(null);

  // Filters
  const [singleDate, setSingleDate] = useState('');
  const [fromDate, setFromDate] = useState(() => `${localDateString().slice(0, 8)}01`);
  const [toDate, setToDate] = useState(() => localDateString());
  const [branchFilter, setBranchFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [receiptSearch, setReceiptSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('');

  useEffect(() => {
    api.getBranches().catch(() => []).then(setBranches);
    loadSales();
  }, []);

  async function loadSales() {
    setLoading(true);
    const params = {};
    if (singleDate) {
      params.from = singleDate;
      params.to = singleDate + 'T23:59:59';
    } else {
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate + 'T23:59:59';
    }
    if (branchFilter) params.branch_id = branchFilter;
    if (paymentFilter) params.payment_method = paymentFilter;
    if (receiptSearch) params.receipt_number = receiptSearch;
    if (customerSearch) params.customer_name = customerSearch;
    if (vehicleSearch) params.vehicle = vehicleSearch;
    if (vehicleTypeFilter) params.vehicle_type = vehicleTypeFilter;
    const data = await api.getSales(params).catch(() => []);
    setSales(data);
    setLoading(false);
  }

  async function handleReceiptAction(saleId, action = null) {
    setReprinting(saleId);
    try {
      const data = await api.getSale(saleId);
      setReceiptData(data);
      setReceiptAction(action);
    } catch (e) {
      alert('Could not load receipt: ' + e.message);
    } finally {
      setReprinting(null);
    }
  }

  async function handleDelete(sale) {
    if (!window.confirm(`Delete sale ${sale.receipt_number}? This cannot be undone.`)) return;
    try {
      await api.deleteSale(sale.id);
      setSales((current) => current.filter((item) => item.id !== sale.id));
    } catch (error) {
      alert(error.message);
    }
  }

  const totalShown = sales.reduce((s, x) => s + Number(x.total), 0);

  const paymentBadge = (method) => {
    const map = { cash: 'badge-green', card: 'badge-teal', upi: 'badge-purple', wallet: 'badge-amber', other: 'badge-gray' };
    return map[method] || 'badge-gray';
  };

  return (
    <div className="sales-history-content">
      {/* Filter Bar */}
      <div className="card card-sm sales-history-filters" style={{ marginBottom: 16 }}>
        <div className="filter-bar">
          <div>
            <label className="form-label">Receipt Number</label>
            <input className="form-input" placeholder="Search receipt" value={receiptSearch} onChange={(e) => setReceiptSearch(e.target.value)} style={{ width: 160 }} />
          </div>
          <div>
            <label className="form-label">Customer Name</label>
            <input className="form-input" placeholder="Search customer" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} style={{ width: 160 }} />
          </div>
          <div>
            <label className="form-label">Vehicle ID / Number</label>
            <input className="form-input" placeholder="Search vehicle" value={vehicleSearch} onChange={(e) => setVehicleSearch(e.target.value)} style={{ width: 160 }} />
          </div>
          <div>
            <label className="form-label">Date</label>
            <input
              className="form-input"
              type="date"
              value={singleDate}
              onChange={(e) => { setSingleDate(e.target.value); setFromDate(''); setToDate(''); }}
              style={{ width: 150 }}
            />
          </div>
          <div>
            <label className="form-label">From Date</label>
            <input
              className="form-input"
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setSingleDate(''); }}
              style={{ width: 150 }}
            />
          </div>
          <div>
            <label className="form-label">To Date</label>
            <input
              className="form-input"
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setSingleDate(''); }}
              style={{ width: 150 }}
            />
          </div>
          {user.role === 'owner' && (
            <div>
              <label className="form-label">Branch</label>
              <select className="form-select" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} style={{ width: 170 }}>
                <option value="">All Branches</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="form-label">Vehicle Type</label>
            <select className="form-select" value={vehicleTypeFilter} onChange={(e) => setVehicleTypeFilter(e.target.value)} style={{ width: 150 }}>
              <option value="">All Vehicles</option>
              <option value="bike">Bike</option>
              <option value="rikshaw">Rikshaw</option>
              <option value="suv">SUV</option>
              <option value="coaster">Coaster</option>
              <option value="truck">Truck</option>
              <option value="car">Car</option>
            </select>
          </div>
          <div>
            <label className="form-label">Payment</label>
            <select className="form-select" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} style={{ width: 150 }}>
              {Object.entries(PAYMENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <button id="apply-filter-btn" className="btn btn-primary" onClick={loadSales}>
              🔍 Apply
            </button>
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => { setSingleDate(''); setFromDate(''); setToDate(''); setBranchFilter(''); setPaymentFilter(''); setReceiptSearch(''); setCustomerSearch(''); setVehicleSearch(''); setVehicleTypeFilter(''); setTimeout(loadSales, 0); }}>
              ✕ Clear
            </button>
          </div>
        </div>
      </div>

      {/* Summary Row */}
      {!loading && (
        <div className="sales-history-summary" style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="card card-sm" style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, minWidth: 160 }}>
            <span style={{ fontSize: '1.3rem' }}>🧾</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text)' }}>{sales.length}</div>
              <div className="stat-label">Transactions Shown</div>
            </div>
          </div>
          <div className="card card-sm" style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, minWidth: 160 }}>
            <span style={{ fontSize: '1.3rem' }}>💰</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--teal-light)' }}>{PKR(totalShown)}</div>
              <div className="stat-label">Total (Filtered)</div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card sales-history-table">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 10px' }} />
            <p>Loading sales…</p>
          </div>
        ) : sales.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <div className="empty-title">No sales found</div>
            <div className="empty-desc">Try adjusting your filters</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Receipt #</th>
                  {user.role === 'owner' && <th>Branch</th>}
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Vehicle</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Date & Time</th>
                  {user.role === 'owner' && <th>Admin Actions</th>}
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', color: 'var(--teal-light)', fontSize: '0.82rem', fontWeight: 700 }}>
                        {s.receipt_number}
                      </span>
                    </td>
                    {user.role === 'owner' && <td>{s.branch_name}</td>}
                    <td>{s.customer_name || <span style={{ color: 'var(--text-dim)' }}>Walk-in</span>}</td>
                    <td>
                      {s.vehicle_type ? s.vehicle_type.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                    </td>
                    <td>
                      {s.vehicle_number
                        ? <span className="badge badge-gray">{s.vehicle_number}</span>
                        : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--text)' }}>{PKR(s.total)}</td>
                    <td><span className={`badge ${paymentBadge(s.payment_method)}`}>{s.payment_method === 'upi' ? 'BANK TRANSFER' : s.payment_method?.toUpperCase()}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {new Date(s.created_at).toLocaleString('en-PK')}
                    </td>
                    {user.role === 'owner' && (
                      <td className="sales-admin-actions">
                        <div className="action-menu">
                          <button
                            className="action-menu-trigger"
                            aria-label={`Actions for receipt ${s.receipt_number}`}
                            aria-expanded={openActionId === s.id}
                            onClick={() => setOpenActionId((current) => current === s.id ? null : s.id)}
                          >
                            ⋮
                          </button>
                          {openActionId === s.id && (
                            <div className="action-menu-dropdown">
                              <button onClick={() => { setOpenActionId(null); handleReceiptAction(s.id); }}>👁 Preview</button>
                              <button onClick={() => { setOpenActionId(null); handleReceiptAction(s.id, 'download'); }}>📥 Download</button>
                              <button onClick={() => { setOpenActionId(null); handleReceiptAction(s.id, 'print'); }}>🖨️ Print</button>
                              <button className="danger" onClick={() => { setOpenActionId(null); handleDelete(s); }}>🗑 Delete</button>
                            </div>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {receiptData && (
        <ReceiptModal saleData={receiptData} autoAction={receiptAction} adminActions={user.role === 'owner'} onClose={() => { setReceiptData(null); setReceiptAction(null); }} />
      )}
    </div>
  );
}
