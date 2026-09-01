import React, { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const PKR = (n) => `Rs. ${Number(n).toFixed(0)}`;
const PK_TIMEZONE = 'Asia/Karachi';
const formatPkDate = (value, options = {}) => new Date(value).toLocaleDateString('en-PK', { timeZone: PK_TIMEZONE, ...options });
const formatPkTime = (value, options = {}) => new Date(value).toLocaleTimeString('en-PK', { timeZone: PK_TIMEZONE, hour: '2-digit', minute: '2-digit', ...options });

export default function ReceiptModal({ saleData, onClose, adminActions = false, autoAction = null }) {
  const printRef = useRef();
  const [downloadError, setDownloadError] = useState('');

  const sale = saleData?.sale;

  useEffect(() => {
    if (!sale || !autoAction) return;
    const timer = window.setTimeout(() => {
      if (autoAction === 'print') handlePrint();
      if (autoAction === 'download') handleDownload();
    }, 100);
    return () => window.clearTimeout(timer);
  }, [sale, autoAction]);

  if (!saleData) return null;

  const { items, branch } = saleData;

  // Derive branch info — could come from sale directly (from getSale) or passed as branch obj
  const branchName = branch?.name || sale.branch_name || 'Tiger Car Wash';
  const branchAddress = branch?.address || sale.branch_address || '';
  const branchPhone = branch?.phone || sale.branch_phone || '';
  const customerName = sale.customer_name || '';
  const vehicleNumber = sale.vehicle_number || '';
  const vehicleModel = sale.vehicle_model || '';

  function handlePrint() {
    window.print();
  }

  async function handleDownload() {
    setDownloadError('');
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, backgroundColor: '#ffffff' });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
      const width = 130;
      const height = (canvas.height * width) / canvas.width;
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 14, 14, width, height);
      pdf.save(`Tiger-Car-Wash-${sale.receipt_number}.pdf`);
    } catch {
      setDownloadError('Could not download the receipt PDF.');
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 420 }}>
        {/* Header — hidden on print */}
        <div className="modal-header no-print">
          <h2 className="modal-title">🧾 Receipt</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Printable receipt area */}
        <div ref={printRef} className="print-area">
          <div className="receipt-preview">
            {/* Shop Header */}
            <div className="receipt-shop-name">✦ {branchName} ✦</div>
            {branchAddress && <div className="receipt-branch">{branchAddress}</div>}
            {branchPhone && <div className="receipt-branch">📞 {branchPhone}</div>}

            <div className="receipt-divider" />

            {/* Receipt meta */}
            <div className="receipt-row">
              <span>Receipt #</span>
              <span style={{ fontWeight: 'bold' }}>{sale.receipt_number}</span>
            </div>
            <div className="receipt-row">
              <span>Date</span>
              <span>{formatPkDate(sale.created_at)}</span>
            </div>
            <div className="receipt-row">
              <span>Time</span>
              <span>{formatPkTime(sale.created_at)}</span>
            </div>

            {/* Customer info if available */}
            {(customerName || vehicleNumber) && (
              <>
                <div className="receipt-divider" />
                {customerName && (
                  <div className="receipt-row">
                    <span>Customer</span>
                    <span>{customerName}</span>
                  </div>
                )}
                {vehicleNumber && (
                  <div className="receipt-row">
                    <span>Vehicle</span>
                    <span>{vehicleNumber}{vehicleModel ? ` (${vehicleModel})` : ''}</span>
                  </div>
                )}
              </>
            )}

            <div className="receipt-divider-solid" />

            {/* Line Items */}
            <div style={{ marginBottom: 4 }}>
              {(items || []).map((item, i) => (
                <div key={i}>
                  <div style={{ fontWeight: 'bold', fontSize: 12 }}>
                    {item.service_name}
                  </div>
                  <div className="receipt-row" style={{ paddingLeft: 8, color: '#444', fontSize: 11 }}>
                    <span>{item.quantity} × {PKR(item.unit_price)}</span>
                    <span>{PKR(item.line_total)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="receipt-divider" />

            {/* Totals */}
            <div className="receipt-row">
              <span>Subtotal</span>
              <span>{PKR(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="receipt-row">
                <span>Discount</span>
                <span style={{ color: '#c00' }}>− {PKR(sale.discount)}</span>
              </div>
            )}
            {sale.tax > 0 && (
              <div className="receipt-row">
                <span>Tax</span>
                <span>{PKR(sale.tax)}</span>
              </div>
            )}

            <div className="receipt-divider-solid" />

            <div className="receipt-row-total">
              <span>TOTAL</span>
              <span>{PKR(sale.total)}</span>
            </div>

            <div className="receipt-row" style={{ marginTop: 6 }}>
              <span>Payment</span>
              <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
                {sale.payment_method === 'upi' ? 'Bank Transfer' : sale.payment_method}
              </span>
            </div>

            <div className="receipt-divider" />

            <div className="receipt-footer">
              Thank you for choosing {branchName}!<br />
              Come back again 🚗✨
            </div>
          </div>
        </div>

        {/* Actions — hidden on print */}
        <div className="modal-footer no-print">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button
            id="print-receipt-btn"
            className="btn btn-primary"
            onClick={handlePrint}
          >
            🖨️ Print Receipt
          </button>
          {adminActions && (
            <button id="download-receipt-btn" className="btn btn-secondary" onClick={handleDownload}>
              📥 Download PDF
            </button>
          )}
          {downloadError && <div className="status-msg error">{downloadError}</div>}
        </div>
      </div>
    </div>
  );
}
