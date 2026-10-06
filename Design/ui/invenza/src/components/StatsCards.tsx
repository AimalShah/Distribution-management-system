import React from 'react';

interface StatsCardsProps {
  dateFilter: 'mtd' | 'ytd';
}

export const StatsCards: React.FC<StatsCardsProps> = ({ dateFilter }) => {
  // If YTD is selected, provide slightly higher scaled values
  const multiplier = dateFilter === 'ytd' ? 3.4 : 1.0;
  const totalSales = Math.round(786 * multiplier);
  const revenue = Math.round(17584 * multiplier);
  const cost = Math.round(12487 * multiplier);
  const profit = Math.round(5097 * multiplier);

  return (
    <div className="page-section grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
      {/* Total Sales Card */}
      <div className="dash-stat-card animate-slideInUp stagger-1">
        <div className="dash-stat-top">
          <div className="dash-stat-icon icon-bg-success">
            <svg
              width="22"
              height="22"
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
          <div className="trend-up">↑ 8.2%</div>
        </div>
        <div className="dash-stat-value">{totalSales.toLocaleString()}</div>
        <div className="dash-stat-label">Total Sales</div>
        <div className="dash-stat-bar">
          <div className="dash-stat-bar-fill" style={{ width: '78%', background: 'var(--primary)' }}></div>
        </div>
      </div>

      {/* Revenue Card */}
      <div className="dash-stat-card animate-slideInUp stagger-2">
        <div className="dash-stat-top">
          <div className="dash-stat-icon icon-bg-info">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
          </div>
          <div className="trend-up">↑ 12.5%</div>
        </div>
        <div className="dash-stat-value">${revenue.toLocaleString()}</div>
        <div className="dash-stat-label">Revenue</div>
        <div className="dash-stat-bar">
          <div className="dash-stat-bar-fill" style={{ width: '85%', background: 'var(--info)' }}></div>
        </div>
      </div>

      {/* Cost Card */}
      <div className="dash-stat-card animate-slideInUp stagger-3">
        <div className="dash-stat-top">
          <div className="dash-stat-icon icon-bg-danger">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
              <polyline points="17 18 23 18 23 12" />
            </svg>
          </div>
          <div className="trend-down">↓ 3.1%</div>
        </div>
        <div className="dash-stat-value">${cost.toLocaleString()}</div>
        <div className="dash-stat-label">Cost</div>
        <div className="dash-stat-bar">
          <div className="dash-stat-bar-fill" style={{ width: '62%', background: 'var(--danger)' }}></div>
        </div>
      </div>

      {/* Profit Card */}
      <div className="dash-stat-card animate-slideInUp stagger-4">
        <div className="dash-stat-top">
          <div className="dash-stat-icon icon-bg-warning">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <div className="trend-up">↑ 18.4%</div>
        </div>
        <div className="dash-stat-value dash-stat-profit">${profit.toLocaleString()}</div>
        <div className="dash-stat-label">Profit</div>
        <div className="dash-stat-bar">
          <div className="dash-stat-bar-fill" style={{ width: '45%', background: 'var(--warning)' }}></div>
        </div>
      </div>
    </div>
  );
};
