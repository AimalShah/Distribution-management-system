import React from 'react';

export const RevenueBreakdown: React.FC = () => {
  return (
    <div className="card animate-slideInUp stagger-4">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <div className="stat-card-icon icon-bg-success w-8 h-8 rounded-lg flex items-center justify-center">
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
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <h2 className="card-title">Revenue Breakdown</h2>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="dash-revenue-item">
          <div className="flex items-center gap-3">
            <div className="dash-revenue-dot" style={{ background: 'var(--primary)' }}></div>
            <div>
              <div className="dash-revenue-label">Total Sales</div>
              <div className="dash-revenue-desc">786 transactions</div>
            </div>
          </div>
          <div className="dash-revenue-amount">$17,584</div>
        </div>
        <div className="dash-revenue-item">
          <div className="flex items-center gap-3">
            <div className="dash-revenue-dot" style={{ background: 'var(--info)' }}></div>
            <div>
              <div className="dash-revenue-label">Revenue</div>
              <div className="dash-revenue-desc">Net income</div>
            </div>
          </div>
          <div className="dash-revenue-amount">$17,584</div>
        </div>
        <div className="dash-revenue-item">
          <div className="flex items-center gap-3">
            <div className="dash-revenue-dot" style={{ background: 'var(--danger)' }}></div>
            <div>
              <div className="dash-revenue-label">Cost</div>
              <div className="dash-revenue-desc">Operating expenses</div>
            </div>
          </div>
          <div className="dash-revenue-amount">$12,487</div>
        </div>
        <div className="dash-revenue-item">
          <div className="flex items-center gap-3">
            <div className="dash-revenue-dot" style={{ background: 'var(--warning)' }}></div>
            <div>
              <div className="dash-revenue-label">Profit</div>
              <div className="dash-revenue-desc">Net profit margin</div>
            </div>
          </div>
          <div className="dash-revenue-amount dash-stat-profit">$5,097</div>
        </div>
      </div>
    </div>
  );
};
