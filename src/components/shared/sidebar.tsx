"use client";

import {
  Check,
  ChevronDown,
  ChevronsUpDown,
  LogOut,
  Plus,
  BarChart3,
  Boxes,
  Package,
  Truck,
  Users,
  ShoppingCart,
  ReceiptText,
  FileText,
  RotateCw,
  ShieldCheck,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { signOut } from "@/lib/auth-client";
import { Button } from "../ui/button";
import { setActiveOrganization } from "@/actions/organization";
import { useEffect } from "react";

const navigationItems = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: BarChart3 },
      { title: "Inventory", url: "/inventory", icon: Boxes },
      { title: "Product", url: "/product", icon: Package },
      { title: "Supplier", url: "/supplier", icon: Truck },
      { title: "Customer", url: "/customer", icon: Users },
    ],
  },
  {
    title: "Purchases",
    items: [{ title: "Purchases", url: "/purchase", icon: ShoppingCart }],
  },

  {
    title: "Invoices",
    items: [{ title: "Sale invoice", url: "/sale-invoice", icon: ReceiptText }],
  },
  {
    title: "Reports",
    items: [{ title: "Reports", url: "/reports", icon: FileText }],
  },
  {
    title: "Returns",
    items: [{ title: "Returns", url: "/returns", icon: RotateCw }],
  },
  {
    title: "Settings",
    items: [
      { title: "Users", url: "/users", icon: Users },
      { title: "Permission", url: "/permission", icon: ShieldCheck },
    ],
  },
];

type Organization = {
  id: string;
  name: string;
  slug: string | null;
  logo: string | null;
};

type Session = {
  user: {
    id: string;
    name: string | null;
    email: string;
    image?: string | null | undefined;
    role?: string | null | undefined;
    [key: string]: unknown;
  };
  session: {
    activeOrganizationId?: string | null | undefined;
  } | null;
};

export function AppSidebar({
  session,
  organizations,
  activeOrganization,
}: {
  session: Session | null;
  organizations: Organization[] | null;
  activeOrganization: Organization | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (organizations?.length > 0 && !activeOrganization) {
      setActiveOrganization(organizations[0].id);
    }
  }, [organizations, activeOrganization]);
  const handleOrganizationSwitch = async (organizationId: string) => {
    await setActiveOrganization(organizationId);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 rounded-xs">
                      <AvatarImage
                        src="/placeholder.svg"
                        alt={activeOrganization?.name}
                      />
                      <AvatarFallback>
                        {activeOrganization?.name?.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col text-left text-sm">
                      <span className="font-semibold truncate">
                        {activeOrganization?.name || "Select Organization"}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                align="start"
                side="bottom"
                sideOffset={4}
              >
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Companies
                </DropdownMenuLabel>

                {Array.isArray(organizations) && organizations.length > 0 ? (
                  organizations.map((company) => (
                    <DropdownMenuItem
                      key={company.id}
                      onClick={() => handleOrganizationSwitch(company.id)}
                      className="gap-2 p-2"
                    >
                      <div className="flex size-6 items-center justify-center rounded-sm border bg-background">
                        <Avatar className="h-8 w-8 rounded-xs">
                          <AvatarImage
                            src="/placeholder.svg"
                            alt={company.name}
                          />
                          <AvatarFallback>
                            {company.name?.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex-1">
                        <span className="font-medium">{company.name}</span>
                      </div>
                      {company.id === activeOrganization?.id && (
                        <Check className="size-4" />
                      )}
                    </DropdownMenuItem>
                  ))
                ) : session?.user.role === "member" ? (
                  <SidebarMenuButton size="lg" className="cursor-default">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 rounded-xs">
                        <AvatarImage
                          src="/placeholder.svg"
                          alt={activeOrganization?.name}
                        />
                        <AvatarFallback>
                          {activeOrganization?.name?.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col text-left text-sm">
                        <span className="font-semibold truncate">
                          {activeOrganization?.name || "Organization"}
                        </span>
                      </div>
                    </div>
                  </SidebarMenuButton>
                ) : (
                  <DropdownMenuItem className="p-2 text-muted-foreground">
                    No organizations found
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem className="gap-2 p-0">
                  <Button
                    className="w-full bg-gray-50 text-black"
                    onClick={() => router.push("/register")}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Company
                  </Button>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        {navigationItems.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.url}
                      tooltip={item.title}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage
                      src="/placeholder.svg"
                      alt={session?.user.name}
                    />
                    <AvatarFallback>
                      {session?.user.name?.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col text-left text-sm">
                    <span className="font-semibold truncate">
                      {session?.user.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {session?.user.isOwner ? "Admin" : session?.user.name}
                    </span>
                  </div>
                  <ChevronDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4}>
                <DropdownMenuLabel>
                  <div className="flex items-center gap-2 p-2">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage
                        src="/placeholder.svg"
                        alt={session?.user.name}
                      />
                      <AvatarFallback>
                        {session?.user.name?.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{session?.user.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {session?.user.email}
                      </p>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Link href="/profile">
                  <DropdownMenuItem className="gap-2">
                    <User className="h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                </Link>

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 text-red-600"
                  onClick={() =>
                    signOut({
                      fetchOptions: {
                        onSuccess: () => router.push("/login"),
                      },
                    })
                  }
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
