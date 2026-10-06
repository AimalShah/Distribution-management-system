import React, { useState, useRef, useEffect } from 'react';
import { NotificationItem, SaleItem, LowStockProduct } from '../types';

interface HeaderProps {
  onToggleSidebar: () => void;
  isDark: boolean;
  onToggleDarkMode: () => void;
  notifications: NotificationItem[];
  onMarkNotificationsRead: () => void;
  onSelectSearchResult: (type: 'invoice' | 'product' | 'page', id: string) => void;
  sales: SaleItem[];
  lowStock: LowStockProduct[];
  onShowToast: (title: string, message: string, type: 'info' | 'success') => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  isDark,
  onToggleDarkMode,
  notifications,
  onMarkNotificationsRead,
  onSelectSearchResult,
  sales,
  lowStock,
  onShowToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const searchBoxRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const filteredSales = sales.filter(
    (s) =>
      s.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.customerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProducts = lowStock.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <header id="app-header">
      {/* Sidebar Toggle Button */}
      <button
        id="sidebar-toggle-btn"
        className="p-2 rounded-lg hover:bg-[var(--background)] transition-colors cursor-pointer border-none bg-transparent flex-shrink-0"
        style={{ color: 'var(--muted)' }}
        aria-label="Toggle Sidebar"
        onClick={onToggleSidebar}
      >
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
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Global Search */}
      <div className="flex-1 max-w-md relative search-box" id="global-search-box" ref={searchBoxRef}>
        <svg
          className="search-icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          id="global-search-input"
          type="text"
          placeholder="Search products, customers, invoices..."
          className="form-input"
          style={{ height: '40px', fontSize: '13px', background: 'var(--background)' }}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowSearchDropdown(e.target.value.trim().length > 0);
          }}
          onFocus={() => {
            if (searchQuery.trim().length > 0) setShowSearchDropdown(true);
          }}
          autoComplete="off"
        />

        {/* Global Search Dropdown */}
        {showSearchDropdown && (
          <div
            id="global-search-dropdown"
            className="global-search-dropdown"
            style={{
              display: 'block',
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
              zIndex: 100,
              maxHeight: '340px',
              overflowY: 'auto',
            }}
          >
            {filteredSales.length === 0 && filteredProducts.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                No matching results found for "{searchQuery}"
              </div>
            ) : (
              <div style={{ padding: '8px' }}>
                {filteredSales.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--muted)',
                        padding: '6px 10px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Invoices &amp; Customers
                    </div>
                    {filteredSales.map((sale) => (
                      <div
                        key={sale.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--background)] cursor-pointer"
                        onClick={() => {
                          onSelectSearchResult('invoice', sale.id);
                          setShowSearchDropdown(false);
                          setSearchQuery('');
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={sale.customerAvatar}
                            alt={sale.customerName}
                            className="w-7 h-7 rounded-full object-cover"
                          />
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                              {sale.invoiceNumber} — {sale.customerName}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                              {sale.date} · {sale.paymentMethod}
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>
                          ${sale.amount.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {filteredProducts.length > 0 && (
                  <div style={{ marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--muted)',
                        padding: '6px 10px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Products
                    </div>
                    {filteredProducts.map((prod) => (
                      <div
                        key={prod.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--background)] cursor-pointer"
                        onClick={() => {
                          onSelectSearchResult('product', prod.id);
                          setShowSearchDropdown(false);
                          setSearchQuery('');
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={prod.image}
                            alt={prod.name}
                            className="w-7 h-7 rounded-md object-cover bg-slate-100"
                          />
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                              {prod.name}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                              SKU: {prod.sku} · Stock: {prod.currentStock}
                            </div>
                          </div>
                        </div>
                        <span className={`badge ${prod.status === 'Critical' || prod.status === 'Out of Stock' ? 'badge-danger' : 'badge-warning'}`}>
                          {prod.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Dark Mode Toggle */}
        <button
          id="dark-mode-btn"
          className="p-2 rounded-lg hover:bg-[var(--background)] transition-colors cursor-pointer border-none bg-transparent"
          style={{ color: 'var(--muted)' }}
          aria-label="Toggle dark mode"
          onClick={onToggleDarkMode}
        >
          {isDark ? (
            <svg
              id="dark-mode-icon-sun"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg
              id="dark-mode-icon-moon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        {/* Notifications */}
        <div className="relative" id="notification-dropdown-wrapper" ref={notifRef}>
          <button
            id="notification-btn"
            className="p-2 rounded-lg hover:bg-[var(--background)] transition-colors relative cursor-pointer border-none bg-transparent"
            style={{ color: 'var(--muted)' }}
            aria-label="Notifications"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span
                className="absolute top-1 right-1 w-2 h-2 rounded-full"
                style={{ background: '#EF4444' }}
              />
            )}
          </button>

          {showNotifications && (
            <div
              id="notification-dropdown"
              className="dropdown-menu"
              style={{
                display: 'block',
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '340px',
                maxHeight: '440px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '14px',
                boxShadow: '0 12px 35px rgba(0,0,0,0.12)',
                zIndex: 100,
              }}
            >
              <div
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>
                  Notifications
                </span>
                <span
                  className="badge badge-danger cursor-pointer"
                  onClick={onMarkNotificationsRead}
                  title="Mark all as read"
                >
                  {unreadCount} New
                </span>
              </div>
              <div style={{ overflowY: 'auto', maxHeight: '320px' }}>
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`notification-item ${n.unread ? 'unread' : ''}`}
                    style={{
                      display: 'flex',
                      gap: '12px',
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: n.unread ? 'var(--primary-light)' : 'transparent',
                    }}
                    onClick={() => {
                      onShowToast('Notification Clicked', n.title, 'info');
                    }}
                  >
                    <div
                      className={`stat-icon icon-bg-${n.type === 'danger' ? 'danger' : n.type === 'warning' ? 'warning' : n.type === 'success' ? 'success' : 'info'} flex-shrink-0`}
                      style={{ width: '36px', height: '36px', borderRadius: '10px' }}
                    >
                      {n.type === 'warning' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                      )}
                      {n.type === 'success' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="1" x2="12" y2="23" />
                          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                      )}
                      {n.type === 'info' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                          <line x1="1" y1="10" x2="23" y2="10" />
                        </svg>
                      )}
                      {n.type === 'danger' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      )}
                      {n.type === 'primary' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{n.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{n.message}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>{n.time}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    onMarkNotificationsRead();
                    onShowToast('Notifications', 'All notifications marked as read', 'success');
                    setShowNotifications(false);
                  }}
                  style={{
                    fontSize: '13px',
                    color: 'var(--primary)',
                    fontWeight: 500,
                    textDecoration: 'none',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Mark all as read
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative" id="user-dropdown-wrapper" ref={userMenuRef}>
          <button
            id="user-menu-btn"
            className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-[var(--background)] transition-colors cursor-pointer border-none bg-transparent"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <img
              src="/assets/img/avator/1.jpg"
              alt="John Smith"
              className="w-8 h-8 rounded-full flex-shrink-0"
              style={{ objectFit: 'cover' }}
            />
            <div className="text-left hidden sm:block">
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>
                John Smith
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Admin</div>
            </div>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: 'var(--muted)' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showUserMenu && (
            <div
              id="user-dropdown"
              className="dropdown-menu"
              style={{
                display: 'block',
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                minWidth: '210px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                boxShadow: '0 12px 35px rgba(0,0,0,0.12)',
                zIndex: 100,
                padding: '6px 0',
              }}
            >
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>John Smith</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>john@invenza.com</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSelectSearchResult('page', 'profile');
                  setShowUserMenu(false);
                }}
                className="dropdown-item w-full text-left"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 16px',
                  fontSize: '13px',
                  color: 'var(--text)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                My Profile
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectSearchResult('page', 'settings-general');
                  setShowUserMenu(false);
                }}
                className="dropdown-item w-full text-left"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 16px',
                  fontSize: '13px',
                  color: 'var(--text)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.07 4.93l-1.41 1.41M5.34 18.66l-1.41 1.41M2 12h2M20 12h2M6.34 5.34L4.93 4.93M19.07 19.07l-1.41-1.41M12 2v2M12 20v2" />
                </svg>
                Settings
              </button>
              <div className="dropdown-divider" style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
              <button
                type="button"
                onClick={() => {
                  onShowToast('Session', 'Sign out simulated. You are logged in as John Smith.', 'info');
                  setShowUserMenu(false);
                }}
                className="dropdown-item danger w-full text-left"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 16px',
                  fontSize: '13px',
                  color: 'var(--danger)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
