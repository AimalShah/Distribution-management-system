import React, { useState } from 'react';
import { LowStockProduct } from '../types';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProduct: (product: Partial<LowStockProduct>) => void;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  onAddProduct,
}) => {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('Peripherals');
  const [currentStock, setCurrentStock] = useState(15);
  const [minStock, setMinStock] = useState(5);
  const [price, setPrice] = useState(49.99);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sku.trim()) return;

    onAddProduct({
      name: name.trim(),
      sku: sku.trim(),
      category,
      currentStock,
      minStock,
      price,
      image: '/assets/img/products/mouse.jpg',
      status: currentStock === 0 ? 'Out of Stock' : currentStock <= minStock ? 'Low Stock' : 'Critical',
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 110 }}>
      <div className="modal-box" style={{ maxWidth: '520px', width: '92%' }}>
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                Add New Product
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
                Create a catalog product with stock thresholds
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
          <div className="modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Product Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Ergonomic Bluetooth Trackball"
                className="form-input w-full"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ height: '40px', fontSize: '13px' }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  SKU Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. EBT-042"
                  className="form-input w-full font-mono"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  style={{ height: '40px', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Category
                </label>
                <select
                  className="form-select w-full"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{ height: '40px', fontSize: '13px' }}
                >
                  <option value="Peripherals">Peripherals</option>
                  <option value="Audio">Audio</option>
                  <option value="Accessories">Accessories</option>
                  <option value="Displays">Displays</option>
                  <option value="Networking">Networking</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input w-full"
                  value={price}
                  onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  style={{ height: '40px', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Initial Stock
                </label>
                <input
                  type="number"
                  min="0"
                  className="form-input w-full"
                  value={currentStock}
                  onChange={(e) => setCurrentStock(parseInt(e.target.value) || 0)}
                  style={{ height: '40px', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Min Stock
                </label>
                <input
                  type="number"
                  min="1"
                  className="form-input w-full"
                  value={minStock}
                  onChange={(e) => setMinStock(parseInt(e.target.value) || 1)}
                  style={{ height: '40px', fontSize: '13px' }}
                />
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
              Create Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
