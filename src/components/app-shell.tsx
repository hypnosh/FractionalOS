import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Building2, Users, Target, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const nav: { to: "/" | "/organizations" | "/contacts" | "/opportunities"; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/organizations", label: "Organizations", icon: Building2 },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/opportunities", label: "Opportunities", icon: Target },
];

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-20 bg-canvas/85 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <Link to="/" className="text-sm font-semibold tracking-tight shrink-0">
              Nexus CXO
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {nav.map((item) => {
                const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-sm transition-colors",
                      active ? "bg-ink/[0.06] text-ink font-medium" : "text-muted hover:text-ink",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs text-muted hover:text-ink inline-flex items-center gap-1.5"
            aria-label="Sign out"
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        </div>
        <nav className="md:hidden border-t border-border overflow-x-auto">
          <div className="flex px-2">
            {nav.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px]",
                    active ? "text-ink font-medium" : "text-muted",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
