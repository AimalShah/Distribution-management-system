import React, { useState } from 'react';
import { SaleItem } from '../types';

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
  const [sortField, setSortField] = useState<'invoiceNumber' | 'date' | 'amount'>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const handleSort = (field: 'invoiceNumber' | 'date' | 'amount') => {
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
    if (sortField === 'invoiceNumber') {
      return sortAsc
        ? a.invoiceNumber.localeCompare(b.invoiceNumber)
        : b.invoiceNumber.localeCompare(a.invoiceNumber);
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
              <th
                onClick={() => handleSort('invoiceNumber')}
                className="cursor-pointer select-none"
              >
                Invoice {sortField === 'invoiceNumber' && (sortAsc ? '↑' : '↓')}
              </th>
              <th>Customer</th>
              <th onClick={() => handleSort('date')} className="cursor-pointer select-none">
                Date {sortField === 'date' && (sortAsc ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('amount')} className="cursor-pointer select-none">
                Amount {sortField === 'amount' && (sortAsc ? '↑' : '↓')}
              </th>
              <th>Payment</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedSales.map((sale) => (
              <tr key={sale.id}>
                <td>
                  <button
                    type="button"
                    onClick={() => onViewInvoice(sale)}
                    className="text-[13px] font-semibold text-[var(--primary)] no-underline hover:underline cursor-pointer bg-transparent border-none p-0 text-left"
                  >
                    {sale.invoiceNumber}
                  </button>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <img
                      src={sale.customerAvatar}
                      alt={sale.customerName}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <span className="text-[13px] font-medium text-[var(--text)]">
                      {sale.customerName}
                    </span>
                  </div>
                </td>
                <td className="text-[13px] text-[var(--muted)]">{sale.date}</td>
                <td className="text-[13px] font-semibold text-[var(--text)]">
                  ${sale.amount.toFixed(2)}
                </td>
                <td className="text-[13px] text-[var(--muted)]">{sale.paymentMethod}</td>
                <td>{getStatusBadge(sale.status)}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => onViewInvoice(sale)}
                    className="btn btn-secondary btn-sm cursor-pointer"
                    aria-label={`View invoice ${sale.invoiceNumber}`}
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
