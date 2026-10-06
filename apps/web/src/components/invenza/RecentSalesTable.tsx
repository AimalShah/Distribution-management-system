import React, { useState } from 'react';
import { SaleItem } from '../../types/invenza';

interface RecentSalesTableProps {
  sales: SaleItem[];
  onViewInvoice: (sale: SaleItem) => void;
  onViewAllSales: () => void;
}

export const RecentSalesTable: React.FC<RecentSalesTableProps> = ({
  sales,
  onViewInvoice,
  onViewAllSales,
}) => {
  const [sortField, setSortField] = useState<'saleCode' | 'date' | 'amount'>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const handleSort = (field: 'saleCode' | 'date' | 'amount') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedSales = [...sales].sort((a, b) => {
    if (sortField === 'amount') {
      return sortAsc ? a.amount - b.amount : b.amount - a.amount;
    }
    if (sortField === 'saleCode') {
      return sortAsc
        ? a.saleCode.localeCompare(b.saleCode)
        : b.saleCode.localeCompare(a.saleCode);
    }
    return sortAsc ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
  });

  const getStatusBadge = (status: SaleItem['status']) => {
    switch (status) {
      case 'Paid':
        return <span className="badge badge-success">Paid</span>;
      case 'Pending':
        return <span className="badge badge-warning">Pending</span>;
      case 'Partial':
        return <span className="badge badge-info">Partial</span>;
      case 'Cancelled':
        return <span className="badge badge-danger">Cancelled</span>;
      default:
        return <span className="badge badge-gray">{status}</span>;
    }
  };

  return (
    <section className="page-section card animate-slideInUp stagger-4" aria-label="Recent sales">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <div className="stat-card-icon icon-bg-primary w-8 h-8 rounded-lg flex items-center justify-center">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div>
            <h2 className="card-title">Recent Sales</h2>
            <p className="card-subtitle">Latest transactions</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onViewAllSales}
          className="btn btn-secondary btn-sm cursor-pointer"
          aria-label="View all sales"
        >
          View All Sales
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <caption className="sr-only">Recent sales transactions</caption>
          <thead>
            <tr>
              <th>Customer</th>
              <th onClick={() => handleSort('date')} className="cursor-pointer select-none">
                Date {sortField === 'date' && (sortAsc ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('amount')} className="cursor-pointer select-none">
                Amount {sortField === 'amount' && (sortAsc ? '↑' : '↓')}
              </th>
              <th>Payment Method</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedSales.map((sale) => (
              <tr key={sale.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <div>
                      <span className="font-semibold text-xs text-[var(--text)] block">{sale.customerName}</span>
                      <span className="font-mono text-xs text-primary-strong font-medium">{sale.saleCode}</span>
                    </div>
                  </div>
                </td>
                <td className="text-xs text-[var(--muted)]">{sale.date}</td>
                <td className="font-bold text-xs">${sale.amount.toFixed(2)}</td>
                <td className="text-xs">{sale.paymentMethod}</td>
                <td>{getStatusBadge(sale.status)}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => onViewInvoice(sale)}
                    className="btn btn-secondary btn-sm cursor-pointer"
                    aria-label={`View invoice for ${sale.customerName}`}
                  >
                    View
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
