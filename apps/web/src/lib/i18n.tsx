import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Language = "en" | "ur";

export interface Translations {
  [key: string]: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    // Navigation
    "nav.dashboard": "Dashboard",
    "nav.products": "Products",
    "nav.sales": "Sales",
    "nav.purchases": "Purchases",
    "nav.inventory": "Inventory",
    "nav.customers": "Customers",
    "nav.suppliers": "Suppliers",
    "nav.returns": "Returns",
    "nav.payments": "Payments",
    "nav.reports": "Reports",
    "nav.settings": "Settings",
    "nav.team": "Team & Permissions",

    // Common Actions
    "action.save": "Save",
    "action.cancel": "Cancel",
    "action.delete": "Delete",
    "action.edit": "Edit",
    "action.create": "Create",
    "action.search": "Search…",
    "action.export": "Export CSV",
    "action.filter": "Filter",
    "action.refresh": "Refresh",
    "action.submit": "Submit",
    "action.signIn": "Sign In",
    "action.signOut": "Sign Out",
    "action.confirm": "Confirm",
    "action.back": "Back",
    "action.remove": "Remove",

    // Common Labels
    "label.total": "Total",
    "label.balance": "Balance",
    "label.status": "Status",
    "label.quantity": "Quantity",
    "label.price": "Price",
    "label.amount": "Amount",
    "label.date": "Date",
    "label.code": "Code",
    "label.name": "Name",
    "label.email": "Email",
    "label.role": "Role",
    "label.active": "Active",
    "label.deactivated": "Deactivated",
    "label.pending": "Pending",
    "label.loading": "Loading…",
  },
  ur: {
    // Navigation
    "nav.dashboard": "ڈیش بورڈ",
    "nav.products": "پروڈکٹس",
    "nav.sales": "سیلز / فروخت",
    "nav.purchases": "خریداری",
    "nav.inventory": "اسٹاک / انوینٹری",
    "nav.customers": "گاہک / کسٹمرز",
    "nav.suppliers": "سپلائرز",
    "nav.returns": "واپسی / ریٹرنز",
    "nav.payments": "ادائیگیاں",
    "nav.reports": "رپورٹس",
    "nav.settings": "سیٹنگز",
    "nav.team": "ٹیم اور اجازتیں",

    // Common Actions
    "action.save": "محفوظ کریں",
    "action.cancel": "منسوخ کریں",
    "action.delete": "حذف کریں",
    "action.edit": "تبدیل کریں",
    "action.create": "نیا بنائیں",
    "action.search": "تلاش کریں…",
    "action.export": "ایکسپورٹ CSV",
    "action.filter": "فلٹر",
    "action.refresh": "تازہ کریں",
    "action.submit": "جمع کرائیں",
    "action.signIn": "لاگ ان کریں",
    "action.signOut": "لاگ آؤٹ کریں",
    "action.confirm": "تصدیق کریں",
    "action.back": "واپس",
    "action.remove": "ہٹائیں",

    // Common Labels
    "label.total": "کل رقم",
    "label.balance": "بقایا رقم",
    "label.status": "حیثیت",
    "label.quantity": "تعداد",
    "label.price": "قیمت",
    "label.amount": "رقم",
    "label.date": "تاریخ",
    "label.code": "کوڈ",
    "label.name": "نام",
    "label.email": "ای میل",
    "label.role": "عہدہ / کردار",
    "label.active": "فعال",
    "label.deactivated": "غیر فعال",
    "label.pending": "زیر التواء",
    "label.loading": "لوڈ ہو رہا ہے…",
  },
};

const I18N_STORAGE_KEY = "dms_language";

interface I18nContextValue {
  language: Language;
  direction: "ltr" | "rtl";
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem(I18N_STORAGE_KEY);
      if (stored === "ur" || stored === "en") return stored;
    } catch {}
    return "en";
  });

  const direction = language === "ur" ? "rtl" : "ltr";

  useEffect(() => {
    try {
      localStorage.setItem(I18N_STORAGE_KEY, language);
      document.documentElement.lang = language;
      document.documentElement.dir = direction;
    } catch {}
  }, [language, direction]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => (prev === "en" ? "ur" : "en"));
  }, []);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const currentDict = translations[language] || translations.en;
      return currentDict[key] ?? fallback ?? translations.en[key] ?? key;
    },
    [language]
  );

  return (
    <I18nContext.Provider
      value={{
        language,
        direction,
        setLanguage,
        toggleLanguage,
        t,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    return {
      language: "en",
      direction: "ltr",
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: (key: string, fallback?: string) => translations.en[key] ?? fallback ?? key,
    };
  }
  return context;
}
