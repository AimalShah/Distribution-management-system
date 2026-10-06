import React from 'react';
import { LowStockProduct } from '../../types/invenza';

interface LowStockTableProps {
  products: LowStockProduct[];
  onReorder: (product: LowStockProduct) => void;
  onViewAllProducts: () => void;
}

export const LowStockTable: React.FC<LowStockTableProps> = ({
  products,
  onReorder,
  onViewAllProducts,
}) => {
  const getStatusBadge = (status: LowStockProduct['status']) => {
    switch (status) {
      case 'Critical':
        return <span className="badge badge-danger">Critical</span>;
      case 'Out of Stock':
        return <span className="badge badge-danger">Out of Stock</span>;
      case 'Low Stock':
        return <span className="badge badge-warning">Low Stock</span>;
      default:
        return <span className="badge badge-gray">{status}</span>;
    }
  };

  const getStockColorClass = (status: LowStockProduct['status']) => {
    if (status === 'Critical' || status === 'Out of Stock') {
      return 'text-[var(--danger)]';
    }
    return 'text-[var(--warning)]';
  };

  return (
    <section className="page-section card animate-slideInUp stagger-5" aria-label="Low stock products">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <div className="stat-icon icon-bg-danger w-8 h-8 rounded-lg flex items-center justify-center">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>
          <div>
            <h2 className="card-title">Low Stock Products</h2>
            <p className="card-subtitle">Items requiring restocking</p>
          </div>
          <span className="badge badge-danger">{products.length} items</span>
        </div>
        <button
          type="button"
          onClick={onViewAllProducts}
          className="btn btn-secondary btn-sm cursor-pointer"
          aria-label="View all products"
        >
          View All
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <caption className="sr-only">Products with low stock levels</caption>
          <thead>
            <tr>
              <th>Product</th>
              <th>Current Stock</th>
              <th>Min Stock</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="text-sm font-semibold text-[var(--text)] block">
                        {product.name}
                      </span>
                      <span className="text-xs text-[var(--muted)] font-mono">
                        {product.sku}
                      </span>
                    </div>
                  </div>
                </td>
                <td className={`text-sm font-bold ${getStockColorClass(product.status)}`}>
                  {product.currentStock}
                </td>
                <td className="text-sm text-[var(--muted)]">{product.minStock}</td>
                <td>{getStatusBadge(product.status)}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => onReorder(product)}
                    className="btn btn-outline btn-sm cursor-pointer"
                    aria-label={`Reorder ${product.name}`}
                  >
                    Reorder
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
