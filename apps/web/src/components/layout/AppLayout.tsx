import { Outlet } from "react-router-dom";
import { Separator, SidebarInset, SidebarProvider, SidebarTrigger } from "@dms/ui";
import { AppSidebar } from "./AppSidebar";

export function AppLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm font-medium">DistroManager</span>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
