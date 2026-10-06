import React, { useState } from 'react';
import { LowStockProduct } from '../../types/invenza';
import { ModalShell, ModalFooter } from './ModalShell';

interface ReorderModalProps {
  product: LowStockProduct | null;
  onClose: () => void;
  onConfirmReorder: (productId: string, reorderQty: number) => void;
}

export const ReorderModal: React.FC<ReorderModalProps> = ({
  product,
  onClose,
  onConfirmReorder,
}) => {
  const [qty, setQty] = useState<number>(20);
  const [supplier, setSupplier] = useState<string>('Shenzhen Tech Supply Co.');

  if (!product) return null;

  const unitCost = Math.round(product.price * 0.55);
  const totalCost = unitCost * qty;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmReorder(product.id, qty);
    onClose();
  };

  return (
    <ModalShell
      zIndex={110}
      maxWidth="480px"
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
      }
      title="Restock Purchase Order"
      subtitle={<>Create purchase order for {product.name}</>}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <div className="modal-body" style={{ padding: '20px 24px' }}>
          <div
            className="flex items-center gap-3 p-3 rounded-xl mb-4"
            style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
          >
            <img
              src={product.image}
              alt={product.name}
              className="w-12 h-12 rounded-lg object-cover bg-slate-100"
            />
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
                {product.name}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                SKU: {product.sku} · Current: {product.currentStock} / Min: {product.minStock}
              </div>
            </div>
          </div>

          <div className="mb-3">
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
              Supplier
            </label>
            <select
              className="form-input form-select w-full"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              style={{ height: '40px', fontSize: '14px' }}
            >
              <option value="Shenzhen Tech Supply Co.">Shenzhen Tech Supply Co.</option>
              <option value="Apex Global Electronics">Apex Global Electronics</option>
              <option value="Pacific Rim Logistics">Pacific Rim Logistics</option>
              <option value="Prime Precision Components">Prime Precision Components</option>
            </select>
          </div>

          <div className="mb-4">
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
              Order Quantity (Units)
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                style={{ width: '40px', height: '40px', fontSize: '16px' }}
                onClick={() => setQty((prev) => Math.max(5, prev - 5))}
              >
                -
              </button>
              <input
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="form-input text-center flex-1 font-bold"
                style={{ height: '40px', fontSize: '16px' }}
              />
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                style={{ width: '40px', height: '40px', fontSize: '16px' }}
                onClick={() => setQty((prev) => prev + 5)}
              >
                +
              </button>
            </div>
          </div>

          {/* Financial Summary */}
          <div
            className="p-3 rounded-xl"
            style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
          >
            <div className="flex justify-between py-1 text-xs text-[var(--muted)]">
              <span>Estimated Unit Cost:</span>
              <span className="font-medium text-[var(--text)]">${unitCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-1 text-xs text-[var(--muted)]">
              <span>Units to Replenish:</span>
              <span className="font-medium text-[var(--text)]">{qty} units</span>
            </div>
            <div className="flex justify-between py-2 border-t mt-1 font-bold text-sm text-[var(--text)]" style={{ borderColor: 'var(--border)' }}>
              <span>Estimated Total PO:</span>
              <span style={{ color: 'var(--primary-strong)' }}>${totalCost.toLocaleString()}.00</span>
            </div>
          </div>
        </div>

        <ModalFooter
          left={
            <button
              type="button"
              className="btn btn-secondary btn-sm cursor-pointer"
              onClick={onClose}
            >
              Cancel
            </button>
          }
          right={
            <button
              type="submit"
              className="btn btn-primary btn-sm flex items-center gap-2 cursor-pointer"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Confirm Purchase Order
            </button>
          }
        />
      </form>
    </ModalShell>
  );
};
