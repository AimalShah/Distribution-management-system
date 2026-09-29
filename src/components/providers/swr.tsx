"use client";

import { fetcher } from "@/lib/utils";
import * as React from "react";
import { SWRConfig, type SWRConfiguration } from "swr";
const swrConfig: SWRConfiguration = {
  fetcher,

  // Behavior flags
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  revalidateOnMount: true,

  // Timing
  dedupingInterval: 2_000,
  errorRetryCount: 3,
  errorRetryInterval: 5_000,
  refreshInterval: 30_000,
};

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={swrConfig}>{children}</SWRConfig>;
}
