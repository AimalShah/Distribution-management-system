import React, { useState } from 'react';
import { LowStockProduct } from '../types';

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
    <div className="modal-backdrop" style={{ zIndex: 110 }}>
      <div className="modal-box" style={{ maxWidth: '480px', width: '92%' }}>
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
            </div>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                Restock Purchase Order
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
                Create purchase order for {product.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon cursor-pointer p-1.5"
            onClick={onClose}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

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
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Supplier
              </label>
              <select
                className="form-select w-full"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                style={{ height: '40px', fontSize: '13px' }}
              >
                <option value="Shenzhen Tech Supply Co.">Shenzhen Tech Supply Co.</option>
                <option value="Apex Global Electronics">Apex Global Electronics</option>
                <option value="Pacific Rim Logistics">Pacific Rim Logistics</option>
                <option value="Prime Precision Components">Prime Precision Components</option>
              </select>
            </div>

            <div className="mb-4">
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Restock Quantity
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="500"
                  className="form-input flex-1"
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ height: '40px', fontSize: '13px' }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setQty(10)}
                >
                  +10
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setQty(25)}
                >
                  +25
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setQty(50)}
                >
                  +50
                </button>
              </div>
            </div>

            <div
              className="p-3 rounded-xl"
              style={{ background: 'var(--background)', fontSize: '13px' }}
            >
              <div className="flex justify-between py-1 text-[var(--muted)]">
                <span>Unit Cost:</span>
                <span className="font-medium text-[var(--text)]">${unitCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 text-[var(--muted)]">
                <span>Estimated Delivery:</span>
                <span className="font-medium text-[var(--text)]">2-3 Business Days</span>
              </div>
              <div
                className="flex justify-between py-1 border-t mt-1 font-bold"
                style={{ borderColor: 'var(--border)', color: 'var(--primary)' }}
              >
                <span>Estimated PO Total:</span>
                <span>${totalCost.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary cursor-pointer"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary cursor-pointer"
            >
              Confirm Reorder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
