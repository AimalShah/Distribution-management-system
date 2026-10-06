import React from 'react';
import { SaleItem } from '../../types/invenza';
import { ModalShell, ModalFooter } from './ModalShell';

interface InvoiceDetailModalProps {
  sale: SaleItem | null;
  onClose: () => void;
  onPrint: (saleCode: string) => void;
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
    <ModalShell
      zIndex={110}
      boxClassName="modal-box modal-lg"
      maxWidth="640px"
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      }
      title={<>Invoice {sale.saleCode}</>}
      subtitle={<>Issued on {sale.date}</>}
      onClose={onClose}
      closeLabel="Close modal"
      footer={
        <ModalFooter
          left={
            <button
              type="button"
              className="btn btn-secondary btn-sm cursor-pointer"
              onClick={onClose}
            >
              Close
            </button>
          }
          right={
            <button
              type="button"
              className="btn btn-primary btn-sm flex items-center gap-2 cursor-pointer"
              onClick={() => onPrint(sale.saleCode)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Print / Download PDF
            </button>
          }
        />
      }
    >
      {/* Modal Body */}
      <div className="modal-body" style={{ padding: '20px 24px' }}>
        {/* Customer & Payment Meta */}
        <div
          className="grid grid-cols-2 gap-4 p-4 rounded-xl mb-5"
          style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
        >
          <div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Billed To
            </div>
            <div className="flex items-center gap-2 mt-2">
              <img
                src={sale.customerAvatar}
                alt={sale.customerName}
                className="w-7 h-7 rounded-full object-cover"
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
                  {sale.customerName}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>customer@example.com</div>
              </div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Payment Method &amp; Status
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
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
        <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: 'var(--text)' }}>
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
          <div style={{ width: '220px', fontSize: '14px' }}>
            <div className="flex justify-between py-1 text-[var(--muted)]">
              <span>Subtotal:</span>
              <span className="font-medium text-[var(--text)]">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-1 text-[var(--muted)]">
              <span>Tax (8%):</span>
              <span className="font-medium text-[var(--text)]">${tax.toFixed(2)}</span>
            </div>
            <div
              className="flex justify-between py-2 border-t mt-1 font-bold text-base"
              style={{ borderColor: 'var(--border)', color: 'var(--primary-strong)' }}
            >
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  );
};
