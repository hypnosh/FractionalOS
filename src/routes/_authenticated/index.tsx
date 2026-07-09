import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Building2, Users, Target, TrendingUp } from "lucide-react";
import { dashboardCountsQuery, opportunitiesQuery } from "@/lib/queries";
import type { Opportunity } from "@/lib/db-types";

type OppRow = Opportunity & {
  Organization: { name: string | null } | null;
  Channel: { name: string | null } | null;
};

export const Route = createFileRoute("/_authenticated/")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(dashboardCountsQuery);
    context.queryClient.ensureQueryData(opportunitiesQuery);
  },
  component: Dashboard,
});

const currency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function Dashboard() {
  const { data: counts } = useSuspenseQuery(dashboardCountsQuery);
  const { data: opportunities } = useSuspenseQuery(opportunitiesQuery) as { data: OppRow[] };

  const recent = opportunities.slice(0, 6);
  const byStage = opportunities.reduce<Record<string, number>>((acc, o) => {
    const s = (o.stage ?? "unknown").toLowerCase();
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});
  const stages = ["discovery", "qualified", "proposal", "negotiation", "won", "lost"] as const;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted mt-1">Portfolio snapshot across every client.</p>
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Organizations" value={counts.organizations} icon={Building2} to="/organizations" />
        <Kpi label="Contacts" value={counts.contacts} icon={Users} to="/contacts" />
        <Kpi label="Open opportunities" value={counts.openOpportunities} icon={Target} to="/opportunities" />
        <Kpi label="Pipeline value" value={currency(counts.pipelineValue)} icon={TrendingUp} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface ring-1 ring-border rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold">Recent opportunities</h2>
            <Link to="/opportunities" className="text-xs text-muted hover:text-ink">View all</Link>
          </div>
          {recent.length === 0 ? (
            <p className="p-6 text-sm text-muted">No opportunities yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((o) => (
                <li key={o.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{o.title ?? "—"}</p>
                    <p className="text-xs text-muted truncate">
                      {o.Organization?.name ?? "—"} · {o.stage ?? "—"}
                    </p>
                  </div>
                  <span className="text-sm text-muted shrink-0">
                    {o.expected_value ? currency(Number(o.expected_value)) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-surface ring-1 ring-border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">Pipeline by stage</h2>
          <ul className="space-y-3">
            {stages.map((s) => {
              const n = byStage[s] ?? 0;
              const max = Math.max(1, ...Object.values(byStage));
              return (
                <li key={s} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="capitalize">{s}</span>
                    <span className="text-muted">{n}</span>
                  </div>
                  <div className="h-1 bg-ink/5 rounded-full overflow-hidden">
                    <div className="h-full bg-ink/70" style={{ width: `${(n / max) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  to,
}: {
  label: string;
  value: string | number;
  icon: typeof Building2;
  to?: "/organizations" | "/contacts" | "/opportunities";
}) {
  const content = (
    <div className="bg-surface ring-1 ring-border rounded-xl p-4 hover:ring-ink/15 transition-all">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
        <Icon className="size-4 text-muted" />
      </div>
      <div className="mt-2 text-2xl font-medium tracking-tight">{value}</div>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}
