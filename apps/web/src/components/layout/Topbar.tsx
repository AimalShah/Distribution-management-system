import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { ThemeSwitch } from "./ThemeSwitch";
import type { NotificationItem } from "../../data/mockData";

interface TopbarProps {
  onToggleSidebar?: () => void;
  isDark?: boolean;
  onToggleDarkMode?: () => void;
  notifications?: NotificationItem[];
  onMarkNotificationsRead?: () => void;
  unreadCount?: number;
  sales?: any[];
  lowStock?: any[];
  onShowToast?: (title: string, message: string) => void;
}

export function Topbar({
  onToggleSidebar = () => {},
  isDark = false,
  onToggleDarkMode = () => {},
  notifications = [],
  onMarkNotificationsRead = () => {},
  unreadCount = 0,
  sales = [],
  lowStock = [],
  onShowToast = () => {},
}: TopbarProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showUser, setShowUser] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearch(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setShowUser(false);
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);

  const displayName = user?.name ?? "User";
  const initials = displayName
    .split(/\s+/)
    .map((p: string) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const filteredSales = sales.filter(
    (s) =>
      s.saleCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.customerName && s.customerName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredProducts = lowStock.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <header className="sticky w-full  top-0 z-30 flex items-center justify-between gap-3 h-14 px-4 border-b border-stone-200 bg-white/90 backdrop-blur-sm">
      {/* Burger */}
      <button
        className="p-2 rounded-lg hover:bg-stone-100 transition-colors"
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-stone-500">
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Search */}
      <div className="flex-1 max-w-md relative" ref={searchRef}>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearch(e.target.value.trim().length > 0);
            }}
            onFocus={() => setShowSearch(true)}
            placeholder="Search orders, products, customers..."
            className="w-full h-9 pl-9 pr-3 text-sm border border-stone-200 rounded-lg bg-stone-50 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>

        {showSearch && (searchQuery.trim().length > 0) && (
          <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-stone-200 bg-white shadow-lg overflow-hidden z-40">
            {filteredProducts.length > 0 && (
              <div className="border-b border-stone-100">
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase text-stone-400">Products</div>
                {filteredProducts.slice(0, 4).map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-stone-50 flex items-center justify-between text-sm"
                    onClick={() => { setShowSearch(false); setSearchQuery(""); navigate("/products"); }}
                  >
                    <div>
                      <div className="font-medium text-stone-900">{p.name}</div>
                      <div className="text-xs text-stone-400">SKU: {p.sku}</div>
                    </div>
                    <span className="text-xs font-semibold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full">{p.currentStock} left</span>
                  </button>
                ))}
              </div>
            )}
            {filteredSales.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase text-stone-400">Recent Sales</div>
                {filteredSales.slice(0, 4).map((s: any) => (
                  <button
                    key={s.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-stone-50 flex items-center justify-between text-sm"
                    onClick={() => { setShowSearch(false); setSearchQuery(""); navigate("/sales"); }}
                  >
                    <div>
                      <div className="font-medium text-stone-900">{s.saleCode}</div>
                      <div className="text-xs text-stone-400">{s.customerName}</div>
                    </div>
                    <span className="text-sm font-semibold text-amber-600">Rs {(s.amount ?? s.total ?? 0).toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}
            {filteredProducts.length === 0 && filteredSales.length === 0 && (
              <div className="p-4 text-center text-sm text-stone-400">No results found</div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            className="relative p-2 rounded-lg hover:bg-stone-100 transition-colors"
            onClick={() => setShowNotif(!showNotif)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-stone-500">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-amber-500 text-[10px] font-bold text-white flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotif && (
            <div className="absolute right-0 top-full mt-1 w-72 rounded-lg border border-stone-200 bg-white shadow-lg overflow-hidden z-40">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-stone-100">
                <span className="text-sm font-semibold text-stone-900">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                    onClick={onMarkNotificationsRead}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.map((n: NotificationItem) => (
                  <div key={n.id} className={`px-3 py-2.5 border-b border-stone-50 flex items-start gap-3 text-sm ${
                    n.unread ? "bg-amber-50/50" : ""
                  }`}>
                    <span className={`mt-0.5 h-2 w-2 rounded-full inline-block ${
                      n.type === "warning" ? "bg-amber-500" : "bg-stone-400"
                    }`} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-stone-900">{n.title}</p>
                      <p className="text-xs text-stone-500 mt-0.5">{n.desc}</p>
                      <p className="text-xs text-stone-400 mt-0.5">{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User */}
        <div className="relative" ref={userRef}>
          <button
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
            onClick={() => setShowUser(!showUser)}
          >
            <div className="h-7 w-7 rounded-full bg-amber-500 text-stone-900 text-xs font-bold flex items-center justify-center">
              {initials}
            </div>
            <span className="hidden sm:inline text-sm font-medium text-stone-700">{displayName}</span>
          </button>

          {showUser && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-stone-200 bg-white shadow-lg overflow-hidden z-40">
              <div className="px-3 py-2.5 border-b border-stone-100">
                <p className="text-sm font-semibold text-stone-900">{displayName}</p>
                <p className="text-xs text-stone-400">{user?.username ?? "user@example.com"}</p>
              </div>
              <button
                className="w-full text-left px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 text-left"
                onClick={() => { setShowUser(false); navigate("/profile"); }}
              >
                Profile
              </button>
              <button
                className="w-full text-left px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 text-left"
                onClick={() => { setShowUser(false); navigate("/users"); }}
              >
                Team & Users
              </button>
              <button
                className="w-full text-left px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 text-left"
                onClick={() => { setShowUser(false); navigate("/billing"); }}
              >
                Billing
              </button>
              <div className="border-t border-stone-100">
                <button
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 text-left"
                  onClick={async () => {
                    setShowUser(false);
                    await logout();
                    navigate("/login", { replace: true });
                  }}
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
