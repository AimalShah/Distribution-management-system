import React, { useState } from 'react';

interface CustomersViewProps {
  onBackToDashboard: () => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({ onBackToDashboard }) => {
  const [search, setSearch] = useState('');

  const customers = [
    { id: '1', name: 'John Smith', email: 'john.smith@techcorp.io', avatar: '/assets/img/avator/1.jpg', orders: 18, spent: 14250, status: 'Active' },
    { id: '2', name: 'Michael Brown', email: 'mbrown@globalsys.net', avatar: '/assets/img/avator/2.jpg', orders: 12, spent: 9800, status: 'Active' },
    { id: '3', name: 'Sarah Wilson', email: 'swilson@designworks.com', avatar: '/assets/img/avator/3.jpg', orders: 8, spent: 5400, status: 'Active' },
    { id: '4', name: 'David Miller', email: 'david@millerelec.co', avatar: '/assets/img/avator/1.jpg', orders: 4, spent: 2100, status: 'Inactive' },
    { id: '5', name: 'Emma Johnson', email: 'emma@frontierlabs.org', avatar: '/assets/img/avator/2.jpg', orders: 24, spent: 22600, status: 'Active' },
  ];

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-slideInUp">
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
            <span className="text-[var(--text)] font-semibold">Customers</span>
          </div>
          <h1 className="text-xl font-bold text-[var(--text)]">Customer Directory</h1>
        </div>
        <button
          type="button"
          onClick={onBackToDashboard}
          className="btn btn-secondary btn-sm cursor-pointer"
        >
          ← Back to Dashboard
        </button>
      </div>

      <div className="card p-4 flex justify-between items-center">
        <div className="text-xs text-[var(--muted)]">
          Total Customers: <strong className="text-[var(--text)]">1,824</strong>
        </div>
        <input
          type="text"
          placeholder="Search customers..."
          className="form-input text-xs w-64"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Email</th>
                <th>Orders</th>
                <th>Total Spent</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <img
                        src={c.avatar}
                        alt={c.name}
                        className="w-9 h-9 rounded-full object-cover"
                      />
                      <span className="text-[13px] font-semibold text-[var(--text)]">
                        {c.name}
                      </span>
                    </div>
                  </td>
                  <td className="text-[13px] text-[var(--muted)]">{c.email}</td>
                  <td className="text-[13px] font-bold text-[var(--text)]">{c.orders}</td>
                  <td className="text-[13px] font-semibold text-[var(--primary)]">
                    ${c.spent.toLocaleString()}
                  </td>
                  <td>
                    <span
                      className={`badge ${c.status === 'Active' ? 'badge-success' : 'badge-gray'}`}
                    >
                      {c.status}
                    </span>
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
