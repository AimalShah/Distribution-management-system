import React from 'react';

interface WelcomeBannerProps {
  dateFilter: 'mtd' | 'ytd';
  onDateFilterChange: (filter: 'mtd' | 'ytd') => void;
  onExport: () => void;
  onOpenQuickReport: () => void;
  lowStockCount: number;
}

export const WelcomeBanner: React.FC<WelcomeBannerProps> = ({
  dateFilter,
  onDateFilterChange,
  onExport,
  onOpenQuickReport,
  lowStockCount,
}) => {
  return (
    <div className="welcome-banner animate-slideInUp">
      <div className="welcome-banner-content">
        <div className="welcome-banner-icon">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <div>
          <h1 className="welcome-title">Welcome back, John!</h1>
          <p className="welcome-subtitle">
            Here's what's happening with your inventory today. You have{' '}
            <strong>{lowStockCount} items</strong> running low on stock.
          </p>
        </div>
      </div>
      <div className="welcome-actions flex-wrap">
        <button
          type="button"
          onClick={() => onDateFilterChange('mtd')}
          className={`btn-welcome-outline ${dateFilter === 'mtd' ? 'active' : ''}`}
          style={
            dateFilter === 'mtd'
              ? { background: 'rgba(255,255,255,0.95)', color: '#0E7A4F', borderColor: 'rgba(255,255,255,0.95)' }
              : {}
          }
          aria-label="Filter by month to date"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Month to Date
        </button>
        <button
          type="button"
          onClick={() => onDateFilterChange('ytd')}
          className={`btn-welcome-outline ${dateFilter === 'ytd' ? 'active' : ''}`}
          style={
            dateFilter === 'ytd'
              ? { background: 'rgba(255,255,255,0.95)', color: '#0E7A4F', borderColor: 'rgba(255,255,255,0.95)' }
              : {}
          }
          aria-label="Filter by year to date"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          Year to Date
        </button>
        <button
          type="button"
          className="btn-welcome-outline cursor-pointer"
          onClick={onOpenQuickReport}
          style={{ background: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.35)' }}
          aria-label="Generate printable quick report"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          Quick Report
        </button>
        <button
          type="button"
          className="btn-welcome-export cursor-pointer"
          onClick={onExport}
          aria-label="Export dashboard data"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export
        </button>
      </div>
    </div>
  );
};
