import React, { useState } from 'react';
import { LowStockProduct } from '../../types/invenza';
import { ModalShell, ModalFooter } from './ModalShell';

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
    <ModalShell
      zIndex={110}
      maxWidth="520px"
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      }
      title="Add New Product"
      subtitle="Create a catalog product with stock thresholds"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <div className="modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
              Product Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ergonomic Bluetooth Trackball"
              className="form-input w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ height: '40px', fontSize: '14px' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                SKU Code
              </label>
              <input
                type="text"
                required
                placeholder="e.g. PER-099"
                className="form-input w-full"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                style={{ height: '40px', fontSize: '14px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                Category
              </label>
              <select
                className="form-input form-select w-full"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ height: '40px', fontSize: '14px' }}
              >
                <option value="Peripherals">Peripherals</option>
                <option value="Audio">Audio</option>
                <option value="Accessories">Accessories</option>
                <option value="Display">Display</option>
                <option value="Networking">Networking</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                Selling Price (Rs)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                className="form-input w-full"
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                style={{ height: '40px', fontSize: '14px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                Opening Stock
              </label>
              <input
                type="number"
                min="0"
                required
                className="form-input w-full"
                value={currentStock}
                onChange={(e) => setCurrentStock(parseInt(e.target.value) || 0)}
                style={{ height: '40px', fontSize: '14px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                Safety Min Stock
              </label>
              <input
                type="number"
                min="1"
                required
                className="form-input w-full"
                value={minStock}
                onChange={(e) => setMinStock(parseInt(e.target.value) || 1)}
                style={{ height: '40px', fontSize: '14px' }}
              />
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
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Save Product
            </button>
          }
        />
      </form>
    </ModalShell>
  );
};
