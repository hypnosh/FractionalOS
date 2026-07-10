import { createFileRoute, Link, useRouter, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { activitiesForEntityQuery, activityMastersQuery, engagementQuery } from "@/lib/queries";
import { EntityTimeline } from "@/components/entity-timeline";

export const Route = createFileRoute("/_authenticated/engagements/$engagementId")({
  loader: ({ context, params }) => {
    const id = Number(params.engagementId);
    if (!Number.isFinite(id)) throw notFound();
    context.queryClient.ensureQueryData(engagementQuery(id));
    context.queryClient.ensureQueryData(activitiesForEntityQuery("Engagement", id));
    context.queryClient.ensureQueryData(activityMastersQuery);
  },
  component: EngagementDetail,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <h1 className="text-xl font-semibold">Couldn't load engagement</h1>
        <p className="text-sm text-muted mt-1">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-4 px-3 py-1.5 rounded-md bg-ink text-canvas text-sm"
        >
          Try again
        </button>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="max-w-lg mx-auto text-center py-16">
      <h1 className="text-xl font-semibold">Engagement not found</h1>
      <Link to="/engagements" className="text-sm text-ink underline mt-4 inline-block">
        Back to engagements
      </Link>
    </div>
  ),
});

const currency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

type EngagementDetailRow = import("@/lib/db-types").Engagement & {
  Proposal:
    | {
        id: number;
        title: string | null;
        opp_id: number | null;
        Opportunity: { id: number; title: string | null; Organization: { name: string | null } | null } | null;
      }
    | null;
};

function EngagementDetail() {
  const { engagementId } = Route.useParams();
  const id = Number(engagementId);
  const { data: e } = useSuspenseQuery(engagementQuery(id)) as { data: EngagementDetailRow };
  const opp = e.Proposal?.Opportunity ?? null;

  return (
    <div className="space-y-6">
      <Link to="/engagements" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-3.5" />
        Engagements
      </Link>
      <header>
        <h1 className="text-2xl font-medium tracking-tight">{e.title ?? "—"}</h1>
        <p className="text-sm text-muted mt-1">
          {opp?.Organization?.name ?? "—"} · {e.status ?? "no status"}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-6">
          <div className="bg-surface ring-1 ring-border rounded-xl p-6 grid sm:grid-cols-2 gap-4">
            <Row label="Status" value={e.status} />
            <Row label="Delivery status" value={e.delivery_status} />
            <Row label="Start date" value={e.start_date} />
            <Row label="Expected end" value={e.expected_end_date} />
            <Row label="Actual end" value={e.actual_end_date} />
            <Row label="Actual value" value={e.actual_value != null ? currency(Number(e.actual_value)) : null} />
            <Row
              label="Opportunity"
              value={opp?.title ?? null}
              href={opp ? `/opportunities/${opp.id}` : undefined}
            />
            <Row
              label="Proposal"
              value={e.Proposal?.title ?? null}
              href={e.Proposal ? `/proposals/${e.Proposal.id}` : undefined}
            />
          </div>
          {e.notes && (
            <div className="bg-surface ring-1 ring-border rounded-xl p-6">
              <h2 className="text-sm font-semibold mb-2">Notes</h2>
              <p className="text-sm whitespace-pre-wrap">{e.notes}</p>
            </div>
          )}
        </section>
        <section>
          <EntityTimeline entityType="Engagement" parentId={id} />
        </section>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  href,
}: {
  label: string;
  value: string | null;
  href?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="text-sm mt-0.5">
        {value == null ? "—" : href ? <a href={href} className="hover:underline">{value}</a> : value}
      </div>
    </div>
  );
}
