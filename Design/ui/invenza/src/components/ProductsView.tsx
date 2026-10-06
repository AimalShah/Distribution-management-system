import React, { useState } from 'react';
import { LowStockProduct } from '../types';

interface ProductsViewProps {
  products: LowStockProduct[];
  onBackToDashboard: () => void;
  onOpenAddProduct: () => void;
  onReorder: (product: LowStockProduct) => void;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  products,
  onBackToDashboard,
  onOpenAddProduct,
  onReorder,
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [search, setSearch] = useState<string>('');

  const categories = ['All', 'Peripherals', 'Audio', 'Accessories'];

  const filtered = products.filter((p) => {
    const matchesCat = filterCategory === 'All' || p.category === filterCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-5 animate-slideInUp">
      {/* Breadcrumb & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[var(--muted)] mb-1">
            <button
              type="button"
              onClick={onBackToDashboard}
              className="hover:text-[var(--primary)] cursor-pointer bg-transparent border-none p-0 text-xs"
            >
              Dashboard
            </button>
            <span>/</span>
            <span className="text-[var(--text)] font-medium">Inventory</span>
            <span>/</span>
            <span className="text-[var(--text)] font-semibold">Products</span>
          </div>
          <h1 className="text-xl font-bold text-[var(--text)]">Products Catalog</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="btn btn-secondary btn-sm cursor-pointer"
          >
            ← Back to Dashboard
          </button>
          <button
            type="button"
            onClick={onOpenAddProduct}
            className="btn btn-primary btn-sm cursor-pointer flex items-center gap-1.5"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Product
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterCategory(cat)}
              className={`btn btn-sm ${filterCategory === cat ? 'btn-primary' : 'btn-secondary'} cursor-pointer`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Filter products..."
            className="form-input w-full text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Products Table Card */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>SKU</th>
                <th>Current Stock</th>
                <th>Min Stock</th>
                <th>Price</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((prod) => (
                <tr key={prod.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <img
                        src={prod.image}
                        alt={prod.name}
                        className="w-10 h-10 rounded-[10px] object-cover bg-slate-100"
                      />
                      <span className="text-[13px] font-semibold text-[var(--text)]">
                        {prod.name}
                      </span>
                    </div>
                  </td>
                  <td className="text-[13px] text-[var(--muted)]">{prod.category}</td>
                  <td className="text-xs text-[var(--muted)] font-mono">{prod.sku}</td>
                  <td className="text-sm font-bold text-[var(--text)]">{prod.currentStock}</td>
                  <td className="text-[13px] text-[var(--muted)]">{prod.minStock}</td>
                  <td className="text-[13px] font-semibold text-[var(--text)]">
                    ${prod.price.toFixed(2)}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        prod.status === 'Critical' || prod.status === 'Out of Stock'
                          ? 'badge-danger'
                          : 'badge-warning'
                      }`}
                    >
                      {prod.status}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => onReorder(prod)}
                      className="btn btn-outline btn-sm cursor-pointer"
                    >
                      Reorder
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
