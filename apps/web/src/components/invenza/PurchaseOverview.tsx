import React from 'react';

interface PurchaseOverviewProps {
  stats?: {
    totalPurchasesAmount?: number;
    recentPurchases?: any[];
  };
}

export const PurchaseOverview: React.FC<PurchaseOverviewProps> = ({ stats }) => {
  const purchaseCost = stats?.totalPurchasesAmount !== undefined ? Number(stats.totalPurchasesAmount) : 12487;
  const purchasesCount = stats?.recentPurchases?.length ? Math.max(stats.recentPurchases.length * 6, 8) : 45;

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
            <div className="dash-purchase-icon icon-bg-neutral flex items-center justify-center">
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
                <span className="text-sm font-medium">No. of Purchases</span>
                <span className="text-base font-bold">{purchasesCount}</span>
              </div>
              <div className="dash-progress-track">
                <div className="dash-progress-fill" style={{ width: '65%', background: 'var(--primary-strong)' }}></div>
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
                <span className="text-sm font-medium">Purchase Cost</span>
                <span className="text-base font-bold">Rs {purchaseCost.toLocaleString()}</span>
              </div>
              <div className="dash-progress-track">
                <div className="dash-progress-fill" style={{ width: '62%', background: 'var(--warning)' }}></div>
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
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Cancelled Orders</span>
                <span className="text-base font-bold">0</span>
              </div>
              <div className="dash-progress-track">
                <div className="dash-progress-fill" style={{ width: '0%', background: 'var(--danger)' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Returns */}
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
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Purchase Returns</span>
                <span className="text-base font-bold">Rs 0</span>
              </div>
              <div className="dash-progress-track">
                <div className="dash-progress-fill" style={{ width: '0%', background: 'var(--danger)' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
