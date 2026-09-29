"use client";

import { SWRProvider } from "@/components/providers/swr";
import { Toaster } from "sonner";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SWRProvider>
      {children}
      <Toaster richColors closeButton />
    </SWRProvider>
  );
}
