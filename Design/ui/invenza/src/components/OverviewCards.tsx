import React from 'react';

export const OverviewCards: React.FC = () => {
  return (
    <div className="page-section grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
      {/* Inventory Overview */}
      <div className="card animate-slideInUp stagger-2">
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
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
            <h2 className="card-title">Inventory Overview</h2>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="dash-metric-card flex-1">
            <div className="dash-metric-icon icon-bg-primary">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            </div>
            <div className="dash-metric-value">214</div>
            <div className="dash-metric-label">Qty in Hand</div>
          </div>
          <div className="dash-metric-card flex-1">
            <div className="dash-metric-icon icon-bg-warning">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="dash-metric-value">64</div>
            <div className="dash-metric-label">Will Be Received</div>
          </div>
        </div>
      </div>

      {/* Users Overview */}
      <div className="card animate-slideInUp stagger-3">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <div className="stat-icon icon-bg-info w-8 h-8 rounded-lg flex items-center justify-center">
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
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h2 className="card-title">No. of Users</h2>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="dash-metric-card flex-1">
            <div className="dash-metric-icon icon-bg-info">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </div>
            <div className="dash-metric-value">1.8K</div>
            <div className="dash-metric-label">Total Customers</div>
          </div>
          <div className="dash-metric-card flex-1">
            <div className="dash-metric-icon icon-bg-purple">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="1" y="3" width="15" height="13" />
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            </div>
            <div className="dash-metric-value">27</div>
            <div className="dash-metric-label">Total Suppliers</div>
          </div>
        </div>
      </div>

      {/* Stock Overview */}
      <div className="card animate-slideInUp stagger-4">
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
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h2 className="card-title">Stock Overview</h2>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="dash-stock-item">
            <div className="flex items-center justify-between mb-2">
              <div className="dash-stock-info">
                <div className="dash-stock-dot" style={{ background: 'var(--danger)' }}></div>
                <span className="text-[13px] font-medium">Low Stock Items</span>
              </div>
              <span className="text-[18px] font-bold text-[var(--danger)]">02</span>
            </div>
            <div className="dash-progress-track">
              <div className="dash-progress-fill" style={{ width: '20%', background: 'var(--danger)' }}></div>
            </div>
          </div>
          <div className="dash-stock-item">
            <div className="flex items-center justify-between mb-2">
              <div className="dash-stock-info">
                <div className="dash-stock-dot" style={{ background: 'var(--info)' }}></div>
                <span className="text-[13px] font-medium">Item Groups</span>
              </div>
              <span className="text-[18px] font-bold">14</span>
            </div>
            <div className="dash-progress-track">
              <div className="dash-progress-fill" style={{ width: '55%', background: 'var(--info)' }}></div>
            </div>
          </div>
          <div className="dash-stock-item">
            <div className="flex items-center justify-between mb-2">
              <div className="dash-stock-info">
                <div className="dash-stock-dot" style={{ background: 'var(--primary)' }}></div>
                <span className="text-[13px] font-medium">No. of Items</span>
              </div>
              <span className="text-[18px] font-bold">104</span>
            </div>
            <div className="dash-progress-track">
              <div className="dash-progress-fill" style={{ width: '85%', background: 'var(--primary)' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
