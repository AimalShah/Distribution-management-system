import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { SWRConfig } from "swr";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthProvider } from "./lib/auth";
import { I18nProvider } from "./lib/i18n";
import { fetcher } from "./lib/api";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SWRConfig
      value={{
        fetcher,
        // Cached data is refetched when a mount asks for a key that has data
        // already; the invalidation helper (lib/mutation.ts) covers the rest.
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        keepPreviousData: true,
      }}
    >
      <BrowserRouter>
        <ErrorBoundary>
          <I18nProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </I18nProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </SWRConfig>
  </StrictMode>
);

