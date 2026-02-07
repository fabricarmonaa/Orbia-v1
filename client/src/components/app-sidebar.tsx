import { useLocation, Link } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  ClipboardList,
  Wallet,
  Package,
  Building2,
  Settings,
  LogOut,
  Lock,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { usePlan } from "@/lib/plan";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  feature?: string;
}

const menuItems: MenuItem[] = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard },
  { title: "Pedidos", url: "/app/orders", icon: ClipboardList },
  { title: "Caja", url: "/app/cash", icon: Wallet },
  { title: "Productos", url: "/app/products", icon: Package, feature: "products" },
  { title: "Sucursales", url: "/app/branches", icon: Building2, feature: "branches" },
  { title: "Configuración", url: "/app/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { plan, hasFeature } = usePlan();

  function isActive(url: string) {
    if (url === "/app") return location === "/app";
    return location.startsWith(url);
  }

  function handleLogout() {
    logout();
    window.location.href = "/login";
  }

  const initials = user?.fullName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase() || "U";

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-primary-foreground font-bold text-sm">O</span>
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm tracking-tight truncate">ORBIA</p>
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-muted-foreground truncate">{user?.role === "admin" ? "Administrador" : "Staff"}</p>
              {plan && (
                <Badge variant="secondary" className="text-[10px]" data-testid="badge-plan-name">
                  {plan.name}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menú</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const blocked = item.feature && !hasFeature(item.feature);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link
                        href={item.url}
                        data-testid={`nav-${item.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}
                      >
                        <item.icon className="w-4 h-4" />
                        <span className={blocked ? "text-muted-foreground" : ""}>{item.title}</span>
                        {blocked && <Lock className="w-3 h-3 ml-auto text-muted-foreground" />}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{user?.fullName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
