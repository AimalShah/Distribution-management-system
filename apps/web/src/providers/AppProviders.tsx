import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { Toaster } from "@dms/ui";
import { fetcher } from "../lib/fetcher";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ fetcher, revalidateOnFocus: false }}>
      {children}
      <Toaster richColors position="top-right" />
    </SWRConfig>
  );
}
