import React from 'react';
import { SaleItem } from '../types';

interface InvoiceDetailModalProps {
  sale: SaleItem | null;
  onClose: () => void;
  onPrint: (invoiceNum: string) => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  sale,
  onClose,
  onPrint,
}) => {
  if (!sale) return null;

  const items = sale.items || [
    { name: 'Standard Inventory Item', sku: 'SKU-001', qty: 1, unitPrice: sale.amount, total: sale.amount }
  ];

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * 0.08;
  const total = subtotal + tax;

  return (
    <div className="modal-backdrop" style={{ zIndex: 110 }}>
      <div className="modal-box modal-lg" style={{ maxWidth: '640px', width: '92%' }}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                Invoice {sale.invoiceNumber}
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
                Issued on {sale.date}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon cursor-pointer p-1.5"
            onClick={onClose}
            aria-label="Close modal"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ padding: '20px 24px' }}>
          {/* Customer & Payment Meta */}
          <div
            className="grid grid-cols-2 gap-4 p-4 rounded-xl mb-5"
            style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
          >
            <div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Billed To
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <img
                  src={sale.customerAvatar}
                  alt={sale.customerName}
                  className="w-7 h-7 rounded-full object-cover"
                />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                    {sale.customerName}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>customer@example.com</div>
                </div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Payment Method &amp; Status
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                  {sale.paymentMethod}
                </span>
                <span
                  className={`badge ${
                    sale.status === 'Paid'
                      ? 'badge-success'
                      : sale.status === 'Pending'
                      ? 'badge-warning'
                      : sale.status === 'Cancelled'
                      ? 'badge-danger'
                      : 'badge-info'
                  }`}
                >
                  {sale.status}
                </span>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text)' }}>
            Purchased Items
          </div>
          <table className="data-table" style={{ fontSize: '12px' }}>
            <thead>
              <tr>
                <th>Item</th>
                <th>SKU</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Unit Price</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td className="font-medium text-[var(--text)]">{item.name}</td>
                  <td className="font-mono text-[var(--muted)]">{item.sku}</td>
                  <td className="text-right">{item.qty}</td>
                  <td className="text-right">${item.unitPrice.toFixed(2)}</td>
                  <td className="text-right font-semibold text-[var(--text)]">
                    ${item.total.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals Summary */}
          <div className="flex justify-end mt-4">
            <div style={{ width: '220px', fontSize: '13px' }}>
              <div className="flex justify-between py-1 text-[var(--muted)]">
                <span>Subtotal:</span>
                <span className="font-medium text-[var(--text)]">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 text-[var(--muted)]">
                <span>Tax (8%):</span>
                <span className="font-medium text-[var(--text)]">${tax.toFixed(2)}</span>
              </div>
              <div
                className="flex justify-between py-2 border-t mt-1 font-bold"
                style={{ borderColor: 'var(--border)', color: 'var(--primary)', fontSize: '15px' }}
              >
                <span>Total:</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary cursor-pointer"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="btn btn-primary cursor-pointer flex items-center gap-2"
            onClick={() => onPrint(sale.invoiceNumber)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print Invoice
          </button>
        </div>
      </div>
    </div>
  );
};
