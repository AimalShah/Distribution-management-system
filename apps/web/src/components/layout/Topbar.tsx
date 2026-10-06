import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { NotificationItem, SaleItem, LowStockProduct } from "../../types/invenza";
import { useAuth } from "../../lib/auth";

interface TopbarProps {
  onToggleSidebar?: () => void;
  isDark?: boolean;
  onToggleDarkMode?: () => void;
  notifications?: NotificationItem[];
  onMarkNotificationsRead?: () => void;
  onSelectSearchResult?: (type: "invoice" | "product" | "page", id: string) => void;
  sales?: SaleItem[];
  lowStock?: LowStockProduct[];
  onShowToast?: (title: string, message: string, type: "info" | "success") => void;
  onOpenQuickReport?: () => void;
}

export function Topbar({
  onToggleSidebar = () => {},
  isDark = false,
  onToggleDarkMode = () => {},
  notifications = [],
  onMarkNotificationsRead = () => {},
  onSelectSearchResult,
  sales = [],
  lowStock = [],
  onShowToast = () => {},
  onOpenQuickReport,
}: TopbarProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const searchBoxRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

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
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => n.unread).length;

  // The signed-in account is the source of truth; the literals are what the
  // shell falls back to before a session resolves.
  const displayName = user?.name ?? "IJAZ";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const filteredSales = sales.filter(
    (s) =>
      s.saleCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
        style={{ color: "var(--muted)" }}
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
          type="text"
          id="global-search-input"
          placeholder="Search inventory, sales, products... (Ctrl+K)"
          aria-label="Global search"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowSearchDropdown(e.target.value.trim().length > 0);
          }}
          onFocus={() => {
            if (searchQuery.trim().length > 0) setShowSearchDropdown(true);
          }}
          className="search-input"
        />

        {showSearchDropdown && (
          <div
            id="search-results-dropdown"
            className="search-dropdown"
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              left: 0,
              right: 0,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              boxShadow: "var(--shadow-lg)",
              zIndex: 100,
              maxHeight: "360px",
              overflowY: "auto",
              padding: "8px",
            }}
          >
            {filteredProducts.length > 0 && (
              <div className="mb-2">
                <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", padding: "4px 8px", textTransform: "uppercase" }}>
                  Products
                </div>
                {filteredProducts.slice(0, 4).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setShowSearchDropdown(false);
                      setSearchQuery("");
                      if (onSelectSearchResult) onSelectSearchResult("product", p.id);
                      else navigate("/products");
                    }}
                    className="w-full text-left p-2 rounded-lg hover:bg-[var(--background)] flex items-center justify-between cursor-pointer border-none bg-transparent"
                  >
                    <div className="flex items-center gap-2">
                      <img src={p.image} alt={p.name} className="w-7 h-7 rounded-md object-cover bg-slate-100" />
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>{p.name}</div>
                        <div style={{ fontSize: "12px", color: "var(--muted)" }}>SKU: {p.sku}</div>
                      </div>
                    </div>
                    <span className="badge badge-warning text-xs">{p.currentStock} left</span>
                  </button>
                ))}
              </div>
            )}

            {filteredSales.length > 0 && (
              <div>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", padding: "4px 8px", textTransform: "uppercase" }}>
                  Sales &amp; Invoices
                </div>
                {filteredSales.slice(0, 4).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setShowSearchDropdown(false);
                      setSearchQuery("");
                      if (onSelectSearchResult) onSelectSearchResult("invoice", s.id);
                      else navigate("/sales");
                    }}
                    className="w-full text-left p-2 rounded-lg hover:bg-[var(--background)] flex items-center justify-between cursor-pointer border-none bg-transparent"
                  >
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>{s.saleCode}</div>
                      <div style={{ fontSize: "12px", color: "var(--muted)" }}>{s.customerName} • {s.date}</div>
                    </div>
                    <span className="font-bold text-sm text-primary-strong">Rs {s.amount.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}

            {filteredProducts.length === 0 && filteredSales.length === 0 && (
              <div className="p-4 text-center text-sm text-[var(--muted)]">
                No matching products or sales found.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-2 sm:gap-3 ml-auto">
        {onOpenQuickReport && (
          <button
            type="button"
            className="hidden md:flex items-center gap-2 btn btn-primary btn-sm cursor-pointer"
            onClick={onOpenQuickReport}
            aria-label="Generate Quick Report PDF"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Quick Report
          </button>
        )}

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            id="notifications-btn"
            type="button"
            className="btn btn-ghost btn-icon relative cursor-pointer"
            aria-label="View notifications"
            onClick={() => setShowNotifications((prev) => !prev)}
          >
            <svg
              width="19"
              height="19"
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
            {unreadCount > 0 && <span className="notification-dot" />}
          </button>

          {showNotifications && (
            <div
              id="notifications-dropdown"
              style={{
                position: "absolute",
                top: "calc(100% + 10px)",
                right: 0,
                width: "320px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "16px",
                boxShadow: "var(--shadow-lg)",
                zIndex: 100,
                overflow: "hidden",
              }}
            >
              <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>Notifications</span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={onMarkNotificationsRead}
                    className="text-xs text-primary-strong hover:underline cursor-pointer border-none bg-transparent"
                  >
                    Mark all as read
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3 border-b flex items-start gap-3 transition-colors ${
                      n.unread ? "bg-[var(--primary-light)]/40" : ""
                    }`}
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div className="mt-1">
                      <span className={`badge badge-${n.type === "primary" ? "info" : n.type} text-xs`}>•</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)" }}>{n.title}</div>
                      <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>{n.message}</div>
                      <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>{n.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Theme Switch */}
        <button
          id="theme-toggle-btn"
          type="button"
          className="btn btn-ghost btn-icon cursor-pointer"
          onClick={onToggleDarkMode}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        {/* User Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            className="flex items-center gap-2 p-2 rounded-xl hover:bg-[var(--background)] transition-colors cursor-pointer border-none bg-transparent"
            onClick={() => setShowUserMenu((prev) => !prev)}
            aria-label="User account menu"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ background: "var(--primary)" }}
            >
              {initials}
            </div>
            <span className="hidden sm:inline text-xs font-semibold text-[var(--text)]">{displayName}</span>
          </button>

          {showUserMenu && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 10px)",
                right: 0,
                width: "200px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "14px",
                boxShadow: "var(--shadow-lg)",
                zIndex: 100,
                padding: "8px",
              }}
            >
              <div className="p-2 border-b mb-1" style={{ borderColor: "var(--border)" }}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>{displayName}</div>
                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                  {user?.username ?? "alex.morgan@inventioo.test"}
                </div>
              </div>
              <button
                type="button"
                className="w-full text-left p-2 rounded-lg hover:bg-[var(--background)] text-xs text-[var(--text)] cursor-pointer border-none bg-transparent font-medium"
                onClick={() => {
                  setShowUserMenu(false);
                  navigate("/profile");
                }}
              >
                Profile Information
              </button>
              <button
                type="button"
                className="w-full text-left p-2 rounded-lg hover:bg-[var(--background)] text-xs text-[var(--text)] cursor-pointer border-none bg-transparent font-medium"
                onClick={() => {
                  setShowUserMenu(false);
                  navigate("/users");
                }}
              >
                Team &amp; Users
              </button>
              <button
                type="button"
                className="w-full text-left p-2 rounded-lg hover:bg-[var(--background)] text-xs text-[var(--text)] cursor-pointer border-none bg-transparent font-medium"
                onClick={() => {
                  setShowUserMenu(false);
                  navigate("/billing");
                }}
              >
                Billing &amp; Subscription
              </button>
              <button
                type="button"
                className="w-full text-left p-2 rounded-lg hover:bg-[var(--background)] text-xs text-[var(--danger)] cursor-pointer border-none bg-transparent font-medium"
                onClick={async () => {
                  setShowUserMenu(false);
                  await logout();
                  navigate("/login", { replace: true });
                }}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
