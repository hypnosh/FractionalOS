import { createFileRoute, Link, useRouter, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { activitiesForEntityQuery, activityMastersQuery, proposalQuery } from "@/lib/queries";
import { EntityTimeline } from "@/components/entity-timeline";
import type { Proposal } from "@/lib/db-types";

type ProposalDetailRow = Proposal & {
  Opportunity: { id: number; title: string | null; Organization: { name: string | null } | null } | null;
};

export const Route = createFileRoute("/_authenticated/proposals/$proposalId")({
  parseParams: (p) => {
    const n = Number(p.proposalId);
    if (!Number.isFinite(n)) throw notFound();
    return { proposalId: n };
  },
  loader: ({ context, params }) => {
    context.queryClient.ensureQueryData(proposalQuery(params.proposalId));
    context.queryClient.ensureQueryData(activitiesForEntityQuery("Proposal", params.proposalId));
    context.queryClient.ensureQueryData(activityMastersQuery);
  },
  component: ProposalDetail,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <h1 className="text-xl font-semibold">Couldn't load proposal</h1>
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
      <h1 className="text-xl font-semibold">Proposal not found</h1>
      <Link to="/proposals" className="text-sm text-ink underline mt-4 inline-block">
        Back to proposals
      </Link>
    </div>
  ),
});

function ProposalDetail() {
  const { proposalId } = Route.useParams();
  const { data: p } = useSuspenseQuery(proposalQuery(proposalId)) as { data: ProposalDetailRow };
  const opp = p.Opportunity;

  return (
    <div className="space-y-6">
      <Link to="/proposals" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-3.5" />
        Proposals
      </Link>
      <header>
        <h1 className="text-2xl font-medium tracking-tight">{p.title ?? "Untitled proposal"}</h1>
        <p className="text-sm text-muted mt-1">
          {opp?.Organization?.name ?? "—"} · {p.status ?? "draft"}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-6">
          <div className="bg-surface ring-1 ring-border rounded-xl p-6 grid sm:grid-cols-2 gap-4">
            <Row label="Status" value={p.status} />
            <Row
              label="Amount"
              value={
                p.proposed_amount != null
                  ? `${p.currency ?? "INR"} ${Number(p.proposed_amount).toLocaleString("en-IN")}`
                  : null
              }
            />
            <Row label="Sent date" value={p.sent_date} />
            <Row label="Valid until" value={p.valid_until} />
            <Row
              label="Opportunity"
              value={opp?.title ?? null}
              href={opp ? `/opportunities/${opp.id}` : undefined}
            />
            <Row label="Commercial type" value={p.commercial_type} />
          </div>
          {p.notes && (
            <div className="bg-surface ring-1 ring-border rounded-xl p-6">
              <h2 className="text-sm font-semibold mb-2">Notes</h2>
              <p className="text-sm whitespace-pre-wrap">{p.notes}</p>
            </div>
          )}
        </section>
        <section>
          <EntityTimeline entityType="Proposal" parentId={proposalId} />
        </section>
      </div>
    </div>
  );
}

function Row({ label, value, href }: { label: string; value: string | null; href?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="text-sm mt-0.5">
        {value == null ? "—" : href ? <a href={href} className="hover:underline">{value}</a> : value}
      </div>
    </div>
  );
}
