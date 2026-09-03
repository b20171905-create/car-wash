import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import ReceiptModal from './ReceiptModal';

const PKR = (n) => `Rs. ${Number(n).toFixed(0)}`;
const PK_TIMEZONE = 'Asia/Karachi';
const formatPkDate = (value, options = {}) => new Date(value).toLocaleDateString('en-PK', { timeZone: PK_TIMEZONE, ...options });
const formatPkDateTime = (value, options = {}) => new Date(value).toLocaleString('en-PK', { timeZone: PK_TIMEZONE, ...options });

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
  const closeActionTimerRef = useRef(null);

  const openActionMenu = (id) => {
    if (closeActionTimerRef.current) {
      clearTimeout(closeActionTimerRef.current);
      closeActionTimerRef.current = null;
    }
    setOpenActionId(id);
  };

  const closeActionMenu = (id) => {
    if (closeActionTimerRef.current) {
      clearTimeout(closeActionTimerRef.current);
    }
    closeActionTimerRef.current = setTimeout(() => {
      setOpenActionId((current) => (current === id ? null : current));
    }, 180);
  };

  // Filters
  const [singleDate, setSingleDate] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('');

  const resetFilters = () => {
    const emptyValues = {
      singleDate: '',
      fromDate: '',
      toDate: '',
      branchFilter: '',
      paymentFilter: '',
      customerFilter: '',
      vehicleTypeFilter: '',
    };

    setSingleDate(emptyValues.singleDate);
    setFromDate(emptyValues.fromDate);
    setToDate(emptyValues.toDate);
    setBranchFilter(emptyValues.branchFilter);
    setPaymentFilter(emptyValues.paymentFilter);
    setCustomerFilter(emptyValues.customerFilter);
    setVehicleTypeFilter(emptyValues.vehicleTypeFilter);

    return emptyValues;
  };

  function buildSalesParams(filters = {}) {
    const nextSingleDate = filters.singleDate ?? singleDate;
    const nextFromDate = filters.fromDate ?? fromDate;
    const nextToDate = filters.toDate ?? toDate;
    const nextBranchFilter = filters.branchFilter ?? branchFilter;
    const nextPaymentFilter = filters.paymentFilter ?? paymentFilter;
    const nextCustomerFilter = filters.customerFilter ?? customerFilter;
    const nextVehicleTypeFilter = filters.vehicleTypeFilter ?? vehicleTypeFilter;

    const params = {};
    if (nextSingleDate) {
      params.from = nextSingleDate;
      params.to = nextSingleDate + 'T23:59:59';
    } else {
      if (nextFromDate) params.from = nextFromDate;
      if (nextToDate) params.to = nextToDate + 'T23:59:59';
    }
    if (nextBranchFilter) params.branch_id = nextBranchFilter;
    if (nextPaymentFilter) params.payment_method = nextPaymentFilter;
    if (nextCustomerFilter) params.search = nextCustomerFilter;
    if (nextVehicleTypeFilter) params.vehicle_type = nextVehicleTypeFilter;
    return params;
  }

  useEffect(() => {
    api.getBranches().catch(() => []).then(setBranches);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSales();
    }, 220);

    return () => clearTimeout(timer);
  }, [singleDate, fromDate, toDate, branchFilter, paymentFilter, customerFilter, vehicleTypeFilter]);

  async function loadSales(overrides = {}) {
    setLoading(true);
    const params = buildSalesParams(overrides);
    const data = await api.getSales(params).catch(() => []);
    setSales(data);
    setLoading(false);
  }

  async function handleReceiptAction(saleId, action = null) {
    if (reprinting && reprinting === saleId) return;

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
        <div className="filter-row search-filter-row" style={{ alignItems: 'end' }}>
          <div className="search-filter-input" style={{ flex: 1, minWidth: 220 }}>
            <label className="form-label">Search</label>
            <input
              className="form-input"
              placeholder="Customer, contact, vehicle, receipt #"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
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
          <div className="filter-actions">
            <button className="btn btn-ghost" onClick={() => resetFilters()}>
              ✕ Clear
            </button>
          </div>
        </div>
      </div>

      {/* Summary Row */}
      {!loading && (
        <div className="sales-history-summary" style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="card card-sm" style={{ display: 'flex', gap: 10, alignItems: 'center', flex: '0 0 260px', minWidth: 220 }}>
            <span style={{ fontSize: '1.3rem' }}>🧾</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text)' }}>{sales.length}</div>
              <div className="stat-label">Transactions Shown</div>
            </div>
          </div>
          <div className="card card-sm" style={{ display: 'flex', gap: 10, alignItems: 'center', flex: '0 0 260px', minWidth: 220 }}>
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
        {loading && sales.length === 0 ? (
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
          <div className="table-wrap" style={{ opacity: loading ? 0.75 : 1, transition: 'opacity 0.15s ease' }}>
            <table>
              <thead>
                <tr>
                  <th>Receipt #</th>
                  {user.role === 'owner' && <th>Branch</th>}
                  <th>Customer</th>
                  <th>Contact</th>
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
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {s.customer_phone || <span style={{ color: 'var(--text-dim)' }}>—</span>}
                    </td>
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
                      {formatPkDateTime(s.created_at)}
                    </td>
                    {user.role === 'owner' && (
                      <td className="sales-admin-actions">
                        <div
                          className="action-menu"
                          onMouseEnter={() => openActionMenu(s.id)}
                          onMouseLeave={() => closeActionMenu(s.id)}
                          onFocus={() => openActionMenu(s.id)}
                          onBlur={() => closeActionMenu(s.id)}
                        >
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
                              <button onClick={() => { setOpenActionId(null); handleReceiptAction(s.id); }} disabled={reprinting === s.id}>
                                {reprinting === s.id ? '⏳ Loading...' : '👁 Preview'}
                              </button>
                              <button onClick={() => { setOpenActionId(null); handleReceiptAction(s.id, 'print'); }} disabled={reprinting === s.id}>
                                {reprinting === s.id ? '⏳ Loading...' : '🖨️ Print'}
                              </button>
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
        <ReceiptModal saleData={receiptData} autoAction={receiptAction} onClose={() => { setReceiptData(null); setReceiptAction(null); }} />
      )}
    </div>
  );
}
