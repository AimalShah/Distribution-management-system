import { NavLink, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@dms/ui";
import { signOut } from "../../lib/auth-client";
import { useActiveOrganization, useAuth } from "../../hooks/use-auth";
import { NAV } from "./nav";

export function AppSidebar() {
  const { data: session } = useAuth();
  const { data: organization } = useActiveOrganization();
  const navigate = useNavigate();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="px-2 py-1.5">
          <div className="truncate text-sm font-semibold">{organization?.name ?? "Inventioo"}</div>
          <div className="truncate text-xs text-muted-foreground">{session?.user.email}</div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {NAV.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <NavLink to={item.url}>
                      {({ isActive }) => (
                        <SidebarMenuButton isActive={isActive} tooltip={item.title}>
                          <item.icon />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      )}
                    </NavLink>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={async () => {
                await signOut();
                navigate("/login", { replace: true });
              }}
            >
              <LogOut />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
