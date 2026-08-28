import React, { useEffect, useState } from 'react';
import { api } from '../api';
import ReceiptModal from './ReceiptModal';

const PKR = (n) => `Rs. ${Number(n).toFixed(0)}`;

// Service icon map (fallback to 🔧 if not found)
const ICONS = {
  'Bike Wash': '🏍️',
  'Bike Wash YBR': '🏍️',
  'Bike Diesel': '⛽',
  'Car Wash (SEDAN)': '🚗',
  'Car Wash (SUV)': '🚙',
  'Car Service (SEDAN)': '🛠️',
  'Car Service (SUV)': '🔧',
  'Rikshaw/AUTO Wash': '🛺',
  'Rikshaw/AUTO Service': '🛠️',
  'Compound Polish': '💎',
  'Gernal Service': '⚙️',
};

const PAYMENT_OPTIONS = [
  { value: 'cash',   label: 'Cash',   icon: '💵' },
  { value: 'card',   label: 'Card',   icon: '💳' },
  { value: 'upi',    label: 'Bank Transfer', icon: '🏦' },
  { value: 'wallet', label: 'Wallet', icon: '👛' },
];

export default function Checkout({ user }) {
  const [services, setServices] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discount, setDiscount] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null); // {type, text}
  const [receiptData, setReceiptData] = useState(null);

  useEffect(() => {
    api.getServices()
      .then(setServices)
      .catch((e) => setStatusMsg({ type: 'error', text: e.message }));
  }, []);

  const filteredServices = services.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  function addToCart(service) {
    setCart((prev) => {
      const existing = prev.find((i) => i.service_id === service.id);
      if (existing) {
        return prev.map((i) =>
          i.service_id === service.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { service_id: service.id, name: service.name, price: service.price, quantity: 1 }];
    });
  }

  function updateQty(serviceId, delta) {
    setCart((prev) =>
      prev
        .map((i) => i.service_id === serviceId ? { ...i, quantity: i.quantity + delta } : i)
        .filter((i) => i.quantity > 0)
    );
  }

  function removeFromCart(serviceId) {
    setCart((prev) => prev.filter((i) => i.service_id !== serviceId));
  }

  function clearCart() {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setVehicleNumber('');
    setVehicleType('');
    setVehicleModel('');
    setDiscount('');
    setStatusMsg(null);
  }

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discountAmt = parseFloat(discount) || 0;
  const total = Math.max(0, subtotal - discountAmt);

  async function handleCheckout() {
    if (!cart.length) return;
    if (!customerName.trim() || !customerPhone.trim() || !vehicleNumber.trim() || !vehicleType || !vehicleModel.trim()) {
      setStatusMsg({ type: 'error', text: 'Please complete all customer and vehicle details before billing.' });
      return;
    }
    setLoading(true);
    setStatusMsg(null);

    try {
      const payload = {
        branch_id: user.branch_id,
        customer: (customerName || customerPhone)
          ? { name: customerName, phone: customerPhone, vehicle_type: vehicleType || null, vehicle_number: vehicleNumber, vehicle_model: vehicleModel }
          : null,
        items: cart.map((i) => ({ service_id: i.service_id, quantity: i.quantity })),
        discount: discountAmt,
        payment_method: paymentMethod,
      };

      const result = await api.createSale(payload);

      // Show receipt modal
      setReceiptData({
        sale: result.sale,
        items: result.items,
        branch: result.branch,
      });

      // Also attempt thermal ESC/POS print in background
      if (result.receipt_print_payload) {
        api.printThermal(result.receipt_print_payload).catch(() => null);
      }

      setStatusMsg({ type: 'success', text: `Sale #${result.sale.receipt_number} completed!` });
      clearCart();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="checkout-layout">
      {/* Left — Services + Customer */}
      <div className="checkout-left">
        {/* Services */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3>Services</h3>
            <span className="badge badge-teal">{filteredServices.length} available</span>
          </div>

          <div className="services-search">
            <span className="services-search-icon">🔍</span>
            <input
              id="service-search"
              className="form-input"
              placeholder="Search services..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {filteredServices.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <div className="empty-icon">🔍</div>
              <div className="empty-title">No services found</div>
            </div>
          ) : (
            <div className="services-grid">
              {filteredServices.map((s) => (
                <div
                  key={s.id}
                  id={`service-${s.id}`}
                  className="service-tile"
                  onClick={() => addToCart(s)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && addToCart(s)}
                >
                  <div className="service-tile-icon">{ICONS[s.name] || '🔧'}</div>
                  <div className="service-tile-name">{s.name}</div>
                  <div className="service-tile-price">{PKR(s.price)}</div>
                  {s.duration_minutes && (
                    <div className="service-tile-duration">⏱ {s.duration_minutes} min</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Customer Info */}
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Customer Info <span style={{ color: 'var(--red)', fontWeight: 600, fontSize: '0.8rem' }}>* Required</span></h3>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Customer Name *</label>
              <input className="form-input" placeholder="e.g. Ahmed Khan" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Phone / WhatsApp *</label>
              <input className="form-input" type="tel" placeholder="+92 300 1234567" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Vehicle Number *</label>
              <input className="form-input" placeholder="e.g. ABC-123" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Vehicle Type *</label>
              <select className="form-select" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} required>
                <option value="">Select vehicle type</option>
                <option value="motor_bike">Motor Bike</option>
                <option value="car">Car</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Vehicle Model *</label>
              <input className="form-input" placeholder="e.g. Toyota Corolla" value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} required />
            </div>
          </div>
        </div>
      </div>

      {/* Right — Cart + Payment */}
      <div className="checkout-right">
        {/* Cart */}
        <div className="card" style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3>Cart</h3>
            {cart.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={clearCart}>🗑 Clear</button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="cart-empty">
              <div className="cart-empty-icon">🛒</div>
              <p>Tap a service to add it</p>
            </div>
          ) : (
            <>
              <div className="cart-items">
                {cart.map((item) => (
                  <div key={item.service_id} className="cart-item">
                    <span className="cart-item-name">{item.name}</span>
                    <div className="qty-controls">
                      <button className="qty-btn" onClick={() => updateQty(item.service_id, -1)}>−</button>
                      <span className="qty-val">{item.quantity}</span>
                      <button className="qty-btn" onClick={() => updateQty(item.service_id, 1)}>+</button>
                    </div>
                    <span className="cart-item-price">{PKR(item.price * item.quantity)}</span>
                    <button className="remove-btn" onClick={() => removeFromCart(item.service_id)}>✕</button>
                  </div>
                ))}
              </div>

              <div className="cart-totals" style={{ marginTop: 14 }}>
                <div className="total-row">
                  <span>Subtotal</span>
                  <span>{PKR(subtotal)}</span>
                </div>
                {discountAmt > 0 && (
                  <div className="total-row">
                    <span>Discount</span>
                    <span style={{ color: 'var(--red)' }}>− {PKR(discountAmt)}</span>
                  </div>
                )}
                <div className="total-row grand">
                  <span>Total</span>
                  <span>{PKR(total)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Discount */}
        <div className="card card-sm">
          <label className="form-label">Discount (Rs.)</label>
          <div className="input-group">
            <span className="input-prefix">Rs.</span>
            <input
              id="discount-input"
              className="form-input"
              type="number"
              min="0"
              placeholder="0"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>
        </div>

        {/* Payment Method */}
        <div className="card card-sm">
          <label className="form-label" style={{ marginBottom: 10 }}>Payment Method</label>
          <div className="payment-methods">
            {PAYMENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                id={`pay-${opt.value}`}
                className={`payment-btn${paymentMethod === opt.value ? ' selected' : ''}`}
                onClick={() => setPaymentMethod(opt.value)}
              >
                <span className="pay-icon">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status message */}
        {statusMsg && (
          <div className={`status-msg ${statusMsg.type}`}>
            {statusMsg.type === 'success' ? '✅' : '❌'} {statusMsg.text}
          </div>
        )}

        {/* Checkout Button */}
        <button
          id="checkout-btn"
          className="btn btn-primary btn-block btn-lg"
          onClick={handleCheckout}
          disabled={!cart.length || loading}
        >
          {loading
            ? <><span className="spinner" /> Processing…</>
            : `🖨️ Charge ${PKR(total)} & Print Receipt`}
        </button>
      </div>

      {/* Receipt Modal */}
      {receiptData && (
        <ReceiptModal
          saleData={receiptData}
          onClose={() => setReceiptData(null)}
        />
      )}
    </div>
  );
}
