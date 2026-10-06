import React, { useState } from 'react';
import { SaleItem } from '../types';

interface InvoicesViewProps {
  sales: SaleItem[];
  onBackToDashboard: () => void;
  onViewInvoice: (sale: SaleItem) => void;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  sales,
  onBackToDashboard,
  onViewInvoice,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [search, setSearch] = useState<string>('');

  const statuses = ['All', 'Paid', 'Pending', 'Partial', 'Cancelled'];

  const filtered = sales.filter((s) => {
    const matchesStatus = statusFilter === 'All' || s.status === statusFilter;
    const matchesSearch =
      s.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      s.customerName.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const totalBilled = filtered.reduce((acc, curr) => acc + curr.amount, 0);

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
            <span className="text-[var(--text)] font-semibold">Invoices</span>
          </div>
          <h1 className="text-xl font-bold text-[var(--text)]">Invoices &amp; Billing</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-xs text-[var(--muted)]">Filtered Volume: </span>
            <span className="text-sm font-bold text-[var(--primary)]">
              ${totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="btn btn-secondary btn-sm cursor-pointer"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto">
          {statuses.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'} cursor-pointer`}
            >
              {st}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search invoice or customer..."
            className="form-input w-full text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Invoices Table Card */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Payment Method</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sale) => (
                <tr key={sale.id}>
                  <td>
                    <button
                      type="button"
                      onClick={() => onViewInvoice(sale)}
                      className="text-[13px] font-semibold text-[var(--primary)] no-underline hover:underline cursor-pointer bg-transparent border-none p-0"
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
                  <td>
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
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => onViewInvoice(sale)}
                      className="btn btn-secondary btn-sm cursor-pointer"
                    >
                      View
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
