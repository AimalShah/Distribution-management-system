import React from 'react';

export const PurchaseOverview: React.FC = () => {
  return (
    <div className="card animate-slideInUp stagger-4">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <div className="stat-icon icon-bg-warning w-8 h-8 rounded-lg flex items-center justify-center">
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
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
          </div>
          <h2 className="card-title">Purchase Overview</h2>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {/* No. of Purchases */}
        <div className="dash-purchase-item">
          <div className="flex items-center gap-3">
            <div className="dash-purchase-icon icon-bg-purple flex items-center justify-center">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] font-medium">No. of Purchases</span>
                <span className="text-[15px] font-bold">45</span>
              </div>
              <div className="dash-progress-track">
                <div className="dash-progress-fill" style={{ width: '65%', background: '#8B5CF6' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Purchase Cost */}
        <div className="dash-purchase-item">
          <div className="flex items-center gap-3">
            <div className="dash-purchase-icon icon-bg-warning flex items-center justify-center">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] font-medium">Purchase Cost</span>
                <span className="text-[15px] font-bold">$786</span>
              </div>
              <div className="dash-progress-track">
                <div className="dash-progress-fill" style={{ width: '40%', background: 'var(--warning)' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Cancelled Orders */}
        <div className="dash-purchase-item">
          <div className="flex items-center gap-3">
            <div className="dash-purchase-icon icon-bg-danger flex items-center justify-center">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] font-medium">Cancelled Orders</span>
                <span className="text-[15px] font-bold text-[var(--danger)]">04</span>
              </div>
              <div className="dash-progress-track">
                <div className="dash-progress-fill" style={{ width: '12%', background: 'var(--danger)' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Returns */}
        <div className="dash-purchase-item">
          <div className="flex items-center gap-3">
            <div className="dash-purchase-icon icon-bg-success flex items-center justify-center">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] font-medium">Returns</span>
                <span className="text-[15px] font-bold">07</span>
              </div>
              <div className="dash-progress-track">
                <div className="dash-progress-fill" style={{ width: '18%', background: 'var(--primary)' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
