import { useState, useEffect } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  ShoppingCart,
  Package,
  Film,
  Wrench,
  BookOpen,
  Receipt,
  BarChart3,
  ShieldCheck,
  Users,
  LogOut,
  Menu,
  Wifi,
  WifiOff,
  Sun,
  Moon,
  Settings as SettingsIcon,
  Zap,
} from "lucide-react";
import type { ComponentType } from "react";
import { useAuth } from "@/lib/auth-context";
import { useSettings } from "@/lib/settings-context";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { cn } from "@/lib/utils";
import { getInitials, type UserRole } from "@/lib/db";
import { requestNotifyPermission } from "@/lib/notify";

type NavItem = { to: string; label: string; icon: ComponentType<{ className?: string }>; roles: UserRole[] };

export const SOFTWARE_NAME = "BHM POS PRO";

const NAV: NavItem[] = [
  { to: "/sales",      label: "Sales",      icon: ShoppingCart, roles: ["admin", "manager", "cashier", "technician"] },
  { to: "/inventory",  label: "Inventory",  icon: Package,      roles: ["admin", "manager"] },
  { to: "/digital",    label: "Digital",    icon: Film,         roles: ["admin", "manager"] },
  { to: "/services",   label: "Services",   icon: Wrench,       roles: ["admin", "manager", "technician"] },
  { to: "/accounts",   label: "Accounts",   icon: BookOpen,     roles: ["admin", "manager"] },
  { to: "/expenses",   label: "Expenses",   icon: Receipt,      roles: ["admin", "manager"] },
  { to: "/reports",    label: "Reports",    icon: BarChart3,    roles: ["admin", "manager"] },
  { to: "/approvals",  label: "Approvals",  icon: ShieldCheck,  roles: ["admin"] },
  { to: "/users",      label: "Users",      icon: Users,        roles: ["admin"] },
  { to: "/settings",   label: "Settings",   icon: SettingsIcon, roles: ["admin"] },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isLoading } = useAuth();
  const { settings } = useSettings();
  const [collapsed, setCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const isOnline = useNetworkStatus();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (!user && currentPath !== "/auth") {
      navigate({ to: "/auth", replace: true });
    }
  }, [user, isLoading, currentPath, navigate]);

  useEffect(() => {
    if (user) requestNotifyPermission();
  }, [user]);

  // Auth page renders standalone
  if (currentPath === "/auth") return <>{children}</>;

  // Show a centered loader while session hydrates — prevents the
  // "Access Denied" flash and the redirect flicker.
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading {SOFTWARE_NAME}…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const visibleNav = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <div className={cn("min-h-screen flex w-full", isDark ? "dark" : "")}>
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-sidebar transition-all duration-300",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Sidebar header = SOFTWARE branding (not business) */}
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-3">
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded bg-gold/20 flex items-center justify-center text-gold">
                <Zap className="h-4 w-4" />
              </div>
              <span className="truncate text-base font-bold tracking-tight text-gold font-display">
                {SOFTWARE_NAME}
              </span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-md hover:bg-sidebar-accent"
          >
            <Menu className="h-4 w-4 text-sidebar-foreground" />
          </button>
        </div>

        <nav className="flex-1 overflow-auto py-3 scrollbar-thin">
          <ul className="space-y-1 px-2">
            {visibleNav.map((item) => {
              const active = currentPath === item.to || currentPath.startsWith(item.to + "/");
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3">
            {user.photo ? (
              <img src={user.photo} alt={user.displayName} className="h-8 w-8 shrink-0 rounded-full object-cover" />
            ) : (
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: user.avatarColor }}
              >
                {getInitials(user.displayName)}
              </div>
            )}
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-sidebar-foreground">
                  {user.displayName}
                </p>
                <p className="truncate text-xs capitalize text-muted-foreground">
                  {user.role}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={logout}
            className={cn(
              "mt-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent",
              collapsed && "justify-center px-2"
            )}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Log out</span>}
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {isOnline ? (
                <span className="flex items-center gap-1.5 text-profit">
                  <Wifi className="h-3.5 w-3.5" />
                  Online
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-loss">
                  <WifiOff className="h-3.5 w-3.5" />
                  Offline
                </span>
              )}
            </span>
          </div>

          {/* Right side: business identity (customised logo + name) + tools */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 pr-3 border-r border-border">
              {settings.businessLogo ? (
                <img
                  src={settings.businessLogo}
                  alt={settings.businessName}
                  className="h-8 w-8 rounded object-cover bg-background"
                />
              ) : (
                <div className="h-8 w-8 rounded bg-primary/15 flex items-center justify-center text-primary text-xs font-bold">
                  {settings.businessName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="text-sm font-semibold max-w-[180px] truncate">
                {settings.businessName}
              </span>
            </div>

            <button
              onClick={() => setIsDark(!isDark)}
              className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
            >
              {isDark ? (
                <Sun className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Moon className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {user.photo ? (
              <img src={user.photo} alt={user.displayName} className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: user.avatarColor }}
              >
                {getInitials(user.displayName)}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-background p-4 scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  );
}
