import React, { useState } from 'react';

interface SidebarProps {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  activePage: string;
  onNavigate: (page: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  isMobileOpen,
  onCloseMobile,
  activePage,
  onNavigate,
}) => {
  const [openSubmenus, setOpenSubmenus] = useState<{ [key: string]: boolean }>({
    inventory: false,
    purchases: false,
    sales: false,
    reports: false,
    users: false,
    settings: false,
  });

  const toggleSubmenu = (menu: string) => {
    setOpenSubmenus((prev) => ({ ...prev, [menu]: !prev[menu] }));
  };

  const handleLinkClick = (page: string) => {
    onNavigate(page);
    if (isMobileOpen) {
      onCloseMobile();
    }
  };

  return (
    <aside
      id="sidebar"
      className={`${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}
    >
      {/* Sidebar Logo */}
      <div
        id="sidebar-logo"
        className="flex items-center h-16 px-4 border-b cursor-pointer select-none"
        style={{
          borderColor: 'var(--border)',
          flexShrink: 0,
          textDecoration: 'none',
          transition: 'background 0.15s',
        }}
        onClick={() => handleLinkClick('dashboard')}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg,#22B573 0%,#16A34A 100%)',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(34,181,115,0.3)',
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="white" fillOpacity="0.2" />
              <path
                d="M12 2L3 7v10l9 5 9-5V7l-9-5z"
                stroke="white"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path d="M12 22V12" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M3 7l9 5 9-5" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="2.5" fill="white" stroke="white" strokeWidth="0.5" />
            </svg>
          </div>
          <div
            className="sidebar-label"
            style={{ borderLeft: '1px solid var(--border)', paddingLeft: '12px' }}
          >
            <div
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--text)',
                lineHeight: 1.1,
                letterSpacing: '-0.3px',
              }}
            >
              Invenza
            </div>
            <div
              style={{
                fontSize: '9.5px',
                color: 'var(--primary)',
                fontWeight: 600,
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
                marginTop: '2px',
              }}
            >
              Inventory Management
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar Nav */}
      <nav id="sidebar-nav" className="flex-1 overflow-y-auto py-3 px-3" style={{ gap: '2px' }}>
        <div className="sidebar-section-label">MAIN</div>

        <button
          type="button"
          onClick={() => handleLinkClick('dashboard')}
          className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`}
        >
          <svg
            className="flex-shrink-0"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          <span className="sidebar-label flex-1 text-left">Dashboard</span>
        </button>

        <div className="sidebar-section-label">INVENTORY</div>

        {/* Inventory Submenu */}
        <div className="submenu-group">
          <button
            type="button"
            className="nav-item submenu-toggle"
            onClick={() => toggleSubmenu('inventory')}
          >
            <svg
              className="flex-shrink-0"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            <span className="sidebar-label flex-1 text-left">Inventory</span>
            <span className="nav-toggle-icon sidebar-label">
              {openSubmenus.inventory ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              )}
            </span>
          </button>
          <div className={`submenu ${openSubmenus.inventory ? 'open' : ''}`}>
            <button
              type="button"
              onClick={() => handleLinkClick('products')}
              className={`submenu-item w-full text-left ${activePage === 'products' ? 'active' : ''}`}
            >
              Products
            </button>
            <button
              type="button"
              onClick={() => handleLinkClick('add-product')}
              className={`submenu-item w-full text-left ${activePage === 'add-product' ? 'active' : ''}`}
            >
              Add Product
            </button>
            <button
              type="button"
              onClick={() => handleLinkClick('categories')}
              className={`submenu-item w-full text-left ${activePage === 'categories' ? 'active' : ''}`}
            >
              Categories
            </button>
            <button
              type="button"
              onClick={() => handleLinkClick('brands')}
              className={`submenu-item w-full text-left ${activePage === 'brands' ? 'active' : ''}`}
            >
              Brands
            </button>
            <button
              type="button"
              onClick={() => handleLinkClick('units')}
              className={`submenu-item w-full text-left ${activePage === 'units' ? 'active' : ''}`}
            >
              Units
            </button>
            <button
              type="button"
              onClick={() => handleLinkClick('stock-adjustment')}
              className={`submenu-item w-full text-left ${activePage === 'stock-adjustment' ? 'active' : ''}`}
            >
              Stock Adjustment
            </button>
          </div>
        </div>

        {/* Purchases Submenu */}
        <div className="submenu-group">
          <button
            type="button"
            className="nav-item submenu-toggle"
            onClick={() => toggleSubmenu('purchases')}
          >
            <svg
              className="flex-shrink-0"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span className="sidebar-label flex-1 text-left">Purchases</span>
            <span className="nav-toggle-icon sidebar-label">
              {openSubmenus.purchases ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              )}
            </span>
          </button>
          <div className={`submenu ${openSubmenus.purchases ? 'open' : ''}`}>
            <button
              type="button"
              onClick={() => handleLinkClick('purchases')}
              className={`submenu-item w-full text-left ${activePage === 'purchases' ? 'active' : ''}`}
            >
              All Purchases
            </button>
            <button
              type="button"
              onClick={() => handleLinkClick('add-purchase')}
              className={`submenu-item w-full text-left ${activePage === 'add-purchase' ? 'active' : ''}`}
            >
              Add Purchase
            </button>
            <button
              type="button"
              onClick={() => handleLinkClick('purchase-returns')}
              className={`submenu-item w-full text-left ${activePage === 'purchase-returns' ? 'active' : ''}`}
            >
              Purchase Returns
            </button>
          </div>
        </div>

        {/* Sales Submenu */}
        <div className="submenu-group">
          <button
            type="button"
            className="nav-item submenu-toggle"
            onClick={() => toggleSubmenu('sales')}
          >
            <svg
              className="flex-shrink-0"
              width="18"
              height="18"
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
            <span className="sidebar-label flex-1 text-left">Sales</span>
            <span className="nav-toggle-icon sidebar-label">
              {openSubmenus.sales ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              )}
            </span>
          </button>
          <div className={`submenu ${openSubmenus.sales ? 'open' : ''}`}>
            <button
              type="button"
              onClick={() => handleLinkClick('all-sales')}
              className={`submenu-item w-full text-left ${activePage === 'all-sales' ? 'active' : ''}`}
            >
              All Sales
            </button>
            <button
              type="button"
              onClick={() => handleLinkClick('pos')}
              className={`submenu-item w-full text-left ${activePage === 'pos' ? 'active' : ''}`}
            >
              Point of Sale
            </button>
            <button
              type="button"
              onClick={() => handleLinkClick('sales-returns')}
              className={`submenu-item w-full text-left ${activePage === 'sales-returns' ? 'active' : ''}`}
            >
              Sales Returns
            </button>
          </div>
        </div>

        {/* Invoices */}
        <button
          type="button"
          onClick={() => handleLinkClick('invoices')}
          className={`nav-item ${activePage === 'invoices' ? 'active' : ''}`}
        >
          <svg
            className="flex-shrink-0"
            width="18"
            height="18"
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
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <span className="sidebar-label flex-1 text-left">Invoices</span>
        </button>

        <div className="sidebar-section-label">CRM</div>

        {/* Customers */}
        <button
          type="button"
          onClick={() => handleLinkClick('customers')}
          className={`nav-item ${activePage === 'customers' ? 'active' : ''}`}
        >
          <svg
            className="flex-shrink-0"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span className="sidebar-label flex-1 text-left">Customers</span>
        </button>

        {/* Suppliers */}
        <button
          type="button"
          onClick={() => handleLinkClick('suppliers')}
          className={`nav-item ${activePage === 'suppliers' ? 'active' : ''}`}
        >
          <svg
            className="flex-shrink-0"
            width="18"
            height="18"
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
          <span className="sidebar-label flex-1 text-left">Suppliers</span>
        </button>

        {/* Expenses */}
        <button
          type="button"
          onClick={() => handleLinkClick('expenses')}
          className={`nav-item ${activePage === 'expenses' ? 'active' : ''}`}
        >
          <svg
            className="flex-shrink-0"
            width="18"
            height="18"
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
          <span className="sidebar-label flex-1 text-left">Expenses</span>
        </button>

        <div className="sidebar-section-label">ANALYTICS</div>

        {/* Reports Submenu */}
        <div className="submenu-group">
          <button
            type="button"
            className="nav-item submenu-toggle"
            onClick={() => toggleSubmenu('reports')}
          >
            <svg
              className="flex-shrink-0"
              width="18"
              height="18"
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
            <span className="sidebar-label flex-1 text-left">Reports</span>
            <span className="nav-toggle-icon sidebar-label">
              {openSubmenus.reports ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              )}
            </span>
          </button>
          <div className={`submenu ${openSubmenus.reports ? 'open' : ''}`}>
            <button
              type="button"
              onClick={() => handleLinkClick('quick-report')}
              className="submenu-item w-full text-left font-medium text-[var(--primary)] cursor-pointer"
            >
              Quick Reports (PDF)
            </button>
            <button
              type="button"
              onClick={() => handleLinkClick('sales-report')}
              className={`submenu-item w-full text-left ${activePage === 'sales-report' ? 'active' : ''}`}
            >
              Sales Report
            </button>
            <button
              type="button"
              onClick={() => handleLinkClick('purchase-report')}
              className={`submenu-item w-full text-left ${activePage === 'purchase-report' ? 'active' : ''}`}
            >
              Purchase Report
            </button>
            <button
              type="button"
              onClick={() => handleLinkClick('inventory-report')}
              className={`submenu-item w-full text-left ${activePage === 'inventory-report' ? 'active' : ''}`}
            >
              Inventory Report
            </button>
            <button
              type="button"
              onClick={() => handleLinkClick('profit-loss')}
              className={`submenu-item w-full text-left ${activePage === 'profit-loss' ? 'active' : ''}`}
            >
              Profit &amp; Loss
            </button>
          </div>
        </div>

        <div className="sidebar-section-label">ADMIN</div>

        {/* Users Submenu */}
        <div className="submenu-group">
          <button
            type="button"
            className="nav-item submenu-toggle"
            onClick={() => toggleSubmenu('users')}
          >
            <svg
              className="flex-shrink-0"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className="sidebar-label flex-1 text-left">Users</span>
            <span className="nav-toggle-icon sidebar-label">
              {openSubmenus.users ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              )}
            </span>
          </button>
          <div className={`submenu ${openSubmenus.users ? 'open' : ''}`}>
            <button
              type="button"
              onClick={() => handleLinkClick('all-users')}
              className={`submenu-item w-full text-left ${activePage === 'all-users' ? 'active' : ''}`}
            >
              All Users
            </button>
            <button
              type="button"
              onClick={() => handleLinkClick('roles')}
              className={`submenu-item w-full text-left ${activePage === 'roles' ? 'active' : ''}`}
            >
              Roles &amp; Permissions
            </button>
          </div>
        </div>

        {/* Settings Submenu */}
        <div className="submenu-group">
          <button
            type="button"
            className="nav-item submenu-toggle"
            onClick={() => toggleSubmenu('settings')}
          >
            <svg
              className="flex-shrink-0"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.07 4.93l-1.41 1.41M5.34 18.66l-1.41 1.41M2 12h2M20 12h2M6.34 5.34L4.93 4.93M19.07 19.07l-1.41-1.41M12 2v2M12 20v2M18.66 6.34l-1.41 1.41M6.34 18.66l-1.41 1.41" />
            </svg>
            <span className="sidebar-label flex-1 text-left">Settings</span>
            <span className="nav-toggle-icon sidebar-label">
              {openSubmenus.settings ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              )}
            </span>
          </button>
          <div className={`submenu ${openSubmenus.settings ? 'open' : ''}`}>
            <button
              type="button"
              onClick={() => handleLinkClick('settings-general')}
              className={`submenu-item w-full text-left ${activePage === 'settings-general' ? 'active' : ''}`}
            >
              General
            </button>
            <button
              type="button"
              onClick={() => handleLinkClick('settings-inventory')}
              className={`submenu-item w-full text-left ${activePage === 'settings-inventory' ? 'active' : ''}`}
            >
              Inventory
            </button>
            <button
              type="button"
              onClick={() => handleLinkClick('settings-sales')}
              className={`submenu-item w-full text-left ${activePage === 'settings-sales' ? 'active' : ''}`}
            >
              Sales
            </button>
          </div>
        </div>
      </nav>

      {/* Sidebar User Profile */}
      <div id="sidebar-user" className="p-3 border-t" style={{ borderColor: 'var(--border)', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => handleLinkClick('profile')}
          className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--background)] transition-colors w-full text-left border-none bg-transparent cursor-pointer"
        >
          <div
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm"
            style={{ background: 'var(--primary)' }}
          >
            JS
          </div>
          <div className="sidebar-label min-w-0">
            <div
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              John Smith
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Administrator</div>
          </div>
        </button>
      </div>
    </aside>
  );
};
