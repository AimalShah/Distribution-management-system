import type React from "react";
import type { Metadata } from "next";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/shared/sidebar";
import { DashboardHeader } from "@/components/shared/header";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  getCurrentActiveOrganization,
  getUserOrganization,
} from "@/actions/organization";
import { getCurrentUserSession } from "@/actions/session";

export const metadata: Metadata = {
  title: "DistroManager - Distribution Management System",
  description: "Comprehensive distribution management dashboard",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentUserSession();
  const organizations = await getUserOrganization();
  const activeOrganizationData = await getCurrentActiveOrganization();
  const activeOrganization = activeOrganizationData?.data;

  // Auth check temporarily disabled
  // if (!session?.user) {
  //   redirect("/login");
  // }

  return (
    <SidebarProvider>
      <AppSidebar
        session={session}
        organizations={organizations}
        activeOrganization={activeOrganization}
      />
      <SidebarInset>
        {" "}
        <DashboardHeader />
        <main className="pt-16">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
