import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, Calendar } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { activitiesForEntityQuery, activityMastersQuery, opportunityQuery } from "@/lib/queries";
import { PageHeader } from "@/components/crud";
import { EntityTimeline } from "@/components/entity-timeline";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { assertUpdatedRows } from "@/lib/mutation-guards";

const OVERRIDE_STATUSES = ["Lost", "On Hold", "Cancelled", "Abandoned"] as const;

const currency = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

export const Route = createFileRoute("/_authenticated/opportunities/$oppId")({
  parseParams: (p) => {
    const n = Number(p.oppId);
    if (!Number.isFinite(n)) throw notFound();
    return { oppId: n };
  },
  loader: ({ context, params }) => {
    context.queryClient.ensureQueryData(opportunityQuery(params.oppId));
    context.queryClient.ensureQueryData(activitiesForEntityQuery("Opportunity", params.oppId));
    context.queryClient.ensureQueryData(activityMastersQuery);
  },
  component: OpportunityDetail,
  notFoundComponent: () => (
    <div className="py-24 text-center text-sm text-muted">
      Opportunity not found.{" "}
      <Link to="/opportunities" className="underline">
        Back to opportunities
      </Link>
    </div>
  ),
});

function OpportunityDetail() {
  const { oppId } = Route.useParams();
  const { data: opp } = useSuspenseQuery(opportunityQuery(oppId)) as {
    data: import("@/lib/db-types").Opportunity & {
      Organization: { id: number; name: string | null } | null;
      Channel: { id: number; name: string | null } | null;
    };
  };
  const { data: masters } = useSuspenseQuery(activityMastersQuery);
  const qc = useQueryClient();
  const [overrideOpen, setOverrideOpen] = useState(false);

  const applyOverride = useMutation({
    mutationFn: async (payload: { status: (typeof OVERRIDE_STATUSES)[number]; reason: string }) => {
      const stagePatch =
        payload.status === "Lost" ? { stage: "lost" as string } : {};
      const result = await supabase
        .from("Opportunity")
        .update({ status: payload.status, ...stagePatch })
        .eq("id", oppId)
        .select("id");
      assertUpdatedRows(result, "Opportunity");

      // Log a Note activity capturing the override + reason.
      const noteMaster = masters.masters.find(
        (m) =>
          m.name === "Note" &&
          masters.mappings.some(
            (x) => x.activity_master_id === m.id && x.entity_type === "Opportunity",
          ),
      );
      if (noteMaster) {
        const { error: aErr } = await supabase.from("Activity").insert({
          opp_id: oppId,
          activity_master_id: noteMaster.id,
          activity_date: new Date().toISOString(),
          summary: `Status set to ${payload.status}`,
          details: payload.reason || null,
        });
        if (aErr) throw aErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities", "Opportunity", oppId] });
      qc.invalidateQueries({ queryKey: ["opportunity", oppId] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["timeline", "global"] });
      setOverrideOpen(false);
      toast.success("Status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleOverrideSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const status = String(fd.get("status") ?? "") as (typeof OVERRIDE_STATUSES)[number];
    const reason = String(fd.get("reason") ?? "").trim();
    if (!status) return;
    applyOverride.mutate({ status, reason });
  };

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/opportunities"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink"
        >
          <ArrowLeft className="size-3.5" /> All opportunities
        </Link>
      </div>

      <PageHeader
        title={opp.title ?? "Untitled opportunity"}
        subtitle={
          [
            opp.Organization?.name,
            opp.Channel?.name,
            opp.stage ? `Stage: ${opp.stage}` : null,
            opp.status ? `Status: ${opp.status}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Opportunity detail"
        }
        action={
          <Button
            variant="outline"
            className="h-9"
            onClick={() => setOverrideOpen(true)}
          >
            Override status
          </Button>
        }
      />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Stat label="Stage" value={opp.stage ?? "—"} />
        <Stat
          label="Expected value"
          value={opp.expected_value ? currency(Number(opp.expected_value)) : "—"}
        />
        <Stat
          label="Probability"
          value={opp.probability != null ? `${opp.probability}%` : "—"}
        />
        <Stat label="Opened" value={fmtDate(opp.opened_date)} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <EntityTimeline entityType="Opportunity" parentId={oppId} />
        </div>

        <div className="space-y-6">
          <div className="bg-surface ring-1 ring-border rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-3">Opportunity</h3>
            <dl className="space-y-2 text-xs">
              <Row icon={Building2} label="Organization" value={opp.Organization?.name ?? "—"} />
              <Row icon={Calendar} label="Opened" value={fmtDate(opp.opened_date)} />
              <Row icon={Calendar} label="Expected close" value={fmtDate(opp.expected_close_date)} />
            </dl>
            {opp.notes && (
              <p className="mt-4 text-xs text-muted whitespace-pre-wrap border-t border-border pt-3">
                {opp.notes}
              </p>
            )}
          </div>
        </div>
      </section>

      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Override status</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleOverrideSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={opp.status ?? "On Hold"}
                className="w-full h-9 px-3 rounded-md border border-border bg-surface text-sm"
              >
                {OVERRIDE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea id="reason" name="reason" rows={3} placeholder="Why is this changing?" />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={applyOverride.isPending}
                className="bg-ink text-canvas hover:bg-ink/90"
              >
                {applyOverride.isPending ? "Saving…" : "Apply"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface ring-1 ring-border rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 text-lg font-medium tracking-tight truncate">{value}</div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-1.5 text-muted">
        <Icon className="size-3.5" /> {label}
      </span>
      <span className="text-ink truncate">{value}</span>
    </div>
  );
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString();
}
