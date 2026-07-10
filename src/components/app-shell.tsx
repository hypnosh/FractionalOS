import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Building2,
  Users,
  Target,
  Radio,
  Briefcase,
  FileText,
  Receipt,
  Activity as ActivityIcon,
  Settings as SettingsIcon,
  Wrench,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type NavPath =
  | "/"
  | "/organizations"
  | "/contacts"
  | "/channels"
  | "/opportunities"
  | "/engagements"
  | "/proposals"
  | "/invoices"
  | "/timeline"
  | "/settings"
  | "/dev";

type NavItem = { to: NavPath; label: string; icon: typeof LayoutDashboard; exact?: boolean; devOnly?: boolean };
type NavGroup = { label?: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { to: "/timeline", label: "Timeline", icon: ActivityIcon },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { to: "/organizations", label: "Organizations", icon: Building2 },
      { to: "/contacts", label: "Contacts", icon: Users },
      { to: "/channels", label: "Channels", icon: Radio },
      { to: "/opportunities", label: "Opportunities", icon: Target },
    ],
  },
  {
    label: "Delivery",
    items: [
      { to: "/proposals", label: "Proposals", icon: FileText },
      { to: "/engagements", label: "Engagements", icon: Briefcase },
      { to: "/invoices", label: "Invoices", icon: Receipt },
    ],
  },
  {
    label: "Settings",
    items: [
      { to: "/settings", label: "Settings", icon: SettingsIcon },
      { to: "/dev", label: "Developer Settings", icon: Wrench, devOnly: true },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDev = import.meta.env.DEV;

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const visibleGroups = groups.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.devOnly || isDev),
  }));

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.to : pathname.startsWith(item.to);

  return (
    <div className="min-h-screen bg-canvas text-ink flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-border bg-surface/50 sticky top-0 h-screen">
        <div className="h-14 flex items-center px-5 border-b border-border">
          <Link to="/" className="text-sm font-semibold tracking-tight">
            FractionalOS
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {visibleGroups.map((group, i) => (
            <div key={group.label ?? `g-${i}`} className="space-y-1">
              {group.label && (
                <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted/80 mb-1.5">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
                const active = isActive(item);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors",
                      active
                        ? "bg-ink/[0.08] text-ink font-medium"
                        : "text-muted hover:text-ink hover:bg-ink/[0.03]",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted hover:text-ink hover:bg-ink/[0.03]"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 bg-canvas/85 backdrop-blur border-b border-border h-14 flex items-center justify-between px-4">
        <Link to="/" className="text-sm font-semibold tracking-tight" onClick={() => setMobileOpen(false)}>
          FractionalOS
        </Link>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="p-1.5 rounded-md hover:bg-ink/5"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-14 z-20 bg-canvas overflow-y-auto">
          <nav className="p-4 space-y-5">
            {visibleGroups.map((group, i) => (
              <div key={group.label ?? `g-${i}`} className="space-y-1">
                {group.label && (
                  <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted/80 mb-1.5">
                    {group.label}
                  </p>
                )}
                {group.items.map((item) => {
                  const active = isActive(item);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 px-2 py-2 rounded-md text-sm",
                        active ? "bg-ink/[0.08] text-ink font-medium" : "text-muted",
                      )}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-muted"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </nav>
        </div>
      )}

      <main className="flex-1 min-w-0 pt-14 md:pt-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
