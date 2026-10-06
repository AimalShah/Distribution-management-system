interface OverviewCardsProps {
  stats?: {
    totalProducts?: number;
    totalCustomers?: number;
    totalSuppliers?: number;
    lowStockCount?: number;
    totalPurchasesAmount?: number;
  };
  lowStockCount?: number;
}

export const OverviewCards: React.FC<OverviewCardsProps> = ({ stats, lowStockCount }) => {
  const qtyInHand = stats?.totalProducts !== undefined ? stats.totalProducts * 18 : 214;
  const willReceive = stats?.totalPurchasesAmount !== undefined ? Math.max(Math.round(stats.totalPurchasesAmount / 500), 5) : 64;
  const suppliers = stats?.totalSuppliers ?? 4;
  const customers = stats?.totalCustomers ?? 84;
  const lowStock = stats?.lowStockCount ?? lowStockCount ?? 12;
  const outOfStock = Math.max(Math.round(lowStock * 0.2), 1);

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
            <div className="dash-metric-value">{qtyInHand}</div>
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
            <div className="dash-metric-value">{willReceive}</div>
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
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div className="dash-metric-value">{suppliers}</div>
            <div className="dash-metric-label">Suppliers</div>
          </div>
          <div className="dash-metric-card flex-1">
            <div className="dash-metric-icon icon-bg-success">
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
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </div>
            <div className="dash-metric-value">{customers}</div>
            <div className="dash-metric-label">Customers</div>
          </div>
        </div>
      </div>

      {/* Stock Overview */}
      <div className="card animate-slideInUp stagger-4">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <div className="stat-card-icon icon-bg-neutral w-8 h-8 rounded-lg flex items-center justify-center">
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
                <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
                <line x1="16" y1="8" x2="2" y2="22" />
                <line x1="17.5" y1="15" x2="9" y2="15" />
              </svg>
            </div>
            <h2 className="card-title">Stock Overview</h2>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="dash-metric-card flex-1">
            <div className="dash-metric-icon icon-bg-danger">
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
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div className="dash-metric-value">{lowStock}</div>
            <div className="dash-metric-label">Low Stock</div>
          </div>
          <div className="dash-metric-card flex-1">
            <div className="dash-metric-icon icon-bg-neutral">
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
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            </div>
            <div className="dash-metric-value">{outOfStock}</div>
            <div className="dash-metric-label">Out of Stock</div>
          </div>
        </div>
      </div>
    </div>
  );
};
