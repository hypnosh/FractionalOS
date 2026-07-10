import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  activityMastersQuery,
  channelsQuery,
  engagementsQuery,
  ENTITY_FK,
  globalTimelineQuery,
  invoicesQuery,
  opportunitiesMinimalQuery,
  proposalsQuery,
  type EntityType,
} from "@/lib/queries";
import { PageHeader } from "@/components/crud";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { chipColor, dotColor, relativeTime } from "@/components/entity-timeline";
import { cn } from "@/lib/utils";
import type { ActivityRow } from "@/lib/queries";
import { assertUpdatedRows } from "@/lib/mutation-guards";

const ENTITY_TYPES: EntityType[] = ["Channel", "Opportunity", "Proposal", "Engagement", "Invoice"];

type UnifiedEvent = {
  id: string;
  ts: string;
  kind: "activity" | "derived";
  entityType: EntityType | "Payment";
  label: string;
  category: string;
  title?: string | null;
  details?: string | null;
  parentLabel: string;
  href?: string;
};

export const Route = createFileRoute("/_authenticated/timeline")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(globalTimelineQuery);
    context.queryClient.ensureQueryData(activityMastersQuery);
  },
  component: TimelinePage,
});

const FILTER_OPTIONS = ["All", ...ENTITY_TYPES, "Payment"] as const;
type Filter = (typeof FILTER_OPTIONS)[number];

function TimelinePage() {
  const { data } = useSuspenseQuery(globalTimelineQuery);
  const [filter, setFilter] = useState<Filter>("All");
  const [dialogOpen, setDialogOpen] = useState(false);

  const events = useMemo<UnifiedEvent[]>(() => {
    const out: UnifiedEvent[] = [];

    for (const a of data.activities as ActivityRow[]) {
      const et = detectActivityEntity(a);
      if (!et) continue;
      out.push({
        id: `a-${a.id}`,
        ts: a.activity_date ?? a.created_at,
        kind: "activity",
        entityType: et.type,
        label: a.ActivityMaster?.name ?? "Activity",
        category: a.ActivityMaster?.category ?? "note",
        title: a.summary,
        details: a.details,
        parentLabel: `${et.type} #${et.id}`,
        href: entityHref(et.type, et.id),
      });
    }

    for (const p of data.proposals) {
      out.push({
        id: `p-created-${p.id}`,
        ts: p.created_at,
        kind: "derived",
        entityType: "Proposal",
        label: "Proposal created",
        category: "proposal",
        title: p.title,
        parentLabel:
          p.Opportunity?.title ?? p.Opportunity?.Organization?.name ?? `Proposal #${p.id}`,
        href: `/proposals/${p.id}`,
      });
      if (p.sent_date) {
        out.push({
          id: `p-sent-${p.id}`,
          ts: p.sent_date,
          kind: "derived",
          entityType: "Proposal",
          label: "Proposal sent",
          category: "proposal",
          title: p.title,
          parentLabel:
            p.Opportunity?.title ?? p.Opportunity?.Organization?.name ?? `Proposal #${p.id}`,
          href: `/proposals/${p.id}`,
        });
      }
      const s = (p.status ?? "").toLowerCase();
      if (s === "accepted" || s === "won") {
        out.push({
          id: `p-accepted-${p.id}`,
          ts: p.updated_at ?? p.created_at,
          kind: "derived",
          entityType: "Proposal",
          label: "Proposal accepted",
          category: "proposal-accepted",
          title: p.title,
          parentLabel:
            p.Opportunity?.title ?? p.Opportunity?.Organization?.name ?? `Proposal #${p.id}`,
          href: `/proposals/${p.id}`,
        });
      } else if (s === "rejected" || s === "lost") {
        out.push({
          id: `p-rejected-${p.id}`,
          ts: p.updated_at ?? p.created_at,
          kind: "derived",
          entityType: "Proposal",
          label: "Proposal rejected",
          category: "proposal-rejected",
          title: p.title,
          parentLabel:
            p.Opportunity?.title ?? p.Opportunity?.Organization?.name ?? `Proposal #${p.id}`,
          href: `/proposals/${p.id}`,
        });
      }
    }

    for (const inv of data.invoices) {
      out.push({
        id: `i-created-${inv.id}`,
        ts: inv.created_at,
        kind: "derived",
        entityType: "Invoice",
        label: "Invoice created",
        category: "invoice",
        title: `#${inv.invoice_no ?? inv.id}`,
        parentLabel: inv.Engagement?.title ?? `Invoice #${inv.invoice_no ?? inv.id}`,
        href: `/invoices/${inv.id}`,
      });
      const s = (inv.status ?? "").toLowerCase();
      if (s === "sent" && inv.invoice_date) {
        out.push({
          id: `i-sent-${inv.id}`,
          ts: inv.invoice_date,
          kind: "derived",
          entityType: "Invoice",
          label: "Invoice sent",
          category: "invoice",
          title: `#${inv.invoice_no ?? inv.id}`,
          parentLabel: inv.Engagement?.title ?? `Invoice #${inv.invoice_no ?? inv.id}`,
          href: `/invoices/${inv.id}`,
        });
      }
      if (s === "paid") {
        out.push({
          id: `i-paid-${inv.id}`,
          ts: inv.updated_at ?? inv.created_at,
          kind: "derived",
          entityType: "Invoice",
          label: "Invoice paid",
          category: "paid",
          title: `#${inv.invoice_no ?? inv.id}`,
          parentLabel: inv.Engagement?.title ?? `Invoice #${inv.invoice_no ?? inv.id}`,
          href: `/invoices/${inv.id}`,
        });
      }
    }

    for (const pay of data.payments) {
      out.push({
        id: `pay-${pay.id}`,
        ts: pay.payment_date ?? pay.created_at,
        kind: "derived",
        entityType: "Payment",
        label: "Payment received",
        category: "paid",
        title:
          (pay.amount != null ? `₹${Number(pay.amount).toLocaleString("en-IN")}` : "") +
          (pay.mode ? ` · ${pay.mode}` : ""),
        parentLabel:
          pay.Invoice?.Engagement?.title ??
          (pay.Invoice ? `Invoice #${pay.Invoice.invoice_no ?? pay.Invoice.id}` : "Payment"),
        href: pay.Invoice ? `/invoices/${pay.Invoice.id}` : undefined,
      });
    }

    out.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    return out;
  }, [data]);

  const filtered = filter === "All" ? events : events.filter((e) => e.entityType === filter);

  return (
    <div>
      <PageHeader
        title="Activity Timeline"
        subtitle="Every activity and lifecycle event across your pipeline."
        action={
          <Button className="h-9 bg-ink text-canvas hover:bg-ink/90" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            New activity
          </Button>
        }
      />

      <div className="flex flex-wrap gap-1.5 mb-4">
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full transition-colors",
              filter === f
                ? "bg-ink text-canvas"
                : "bg-surface ring-1 ring-border text-muted hover:text-ink",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="bg-surface ring-1 ring-border rounded-xl">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted">No events yet.</div>
        ) : (
          <ol className="relative">
            {filtered.map((e, i) => (
              <li key={e.id} className="relative pl-12 pr-5 py-4 group hover:bg-ink/[0.015]">
                <span
                  className={cn(
                    "absolute left-[22px] w-px bg-border",
                    i === 0 ? "top-6" : "top-0",
                    i === filtered.length - 1 ? "bottom-1/2" : "bottom-0",
                  )}
                />
                <span
                  className={cn(
                    "absolute left-[15px] top-6 size-3.5 rounded-full ring-2 ring-surface",
                    dotColor(e.category, e.kind === "derived"),
                  )}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-medium",
                        chipColor(e.category, e.kind === "derived"),
                      )}
                    >
                      {e.label}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-ink/[0.05] text-muted uppercase tracking-wider">
                      {e.entityType}
                    </span>
                    <span className="text-xs text-muted">
                      {relativeTime(e.ts)} · {new Date(e.ts).toLocaleString()}
                    </span>
                  </div>
                  {e.title && <p className="mt-1 text-sm font-medium text-ink">{e.title}</p>}
                  {e.details && <p className="mt-1 text-sm text-muted whitespace-pre-wrap">{e.details}</p>}
                  <div className="mt-1 text-xs text-muted">
                    On{" "}
                    {e.href ? (
                      <Link to={e.href} className="text-ink/70 underline">
                        {e.parentLabel}
                      </Link>
                    ) : (
                      e.parentLabel
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <NewActivityDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

function detectActivityEntity(a: ActivityRow): { type: EntityType; id: number } | null {
  if (a.channel_id != null) return { type: "Channel", id: a.channel_id };
  if (a.opp_id != null) return { type: "Opportunity", id: a.opp_id };
  if (a.proposal_id != null) return { type: "Proposal", id: a.proposal_id };
  if (a.engagement_id != null) return { type: "Engagement", id: a.engagement_id };
  if (a.invoice_id != null) return { type: "Invoice", id: a.invoice_id };
  return null;
}

function entityHref(type: EntityType, id: number): string {
  switch (type) {
    case "Channel":
      return `/channels/${id}`;
    case "Opportunity":
      return `/opportunities/${id}`;
    case "Proposal":
      return `/proposals/${id}`;
    case "Engagement":
      return `/engagements/${id}`;
    case "Invoice":
      return `/invoices/${id}`;
  }
}

// ---------- Standalone New Activity dialog ----------

function NewActivityDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const { data: masters } = useSuspenseQuery(activityMastersQuery);
  const [entityType, setEntityType] = useState<EntityType>("Opportunity");

  const availableMasters = useMemo(() => {
    const allowed = new Set(
      masters.mappings.filter((m) => m.entity_type === entityType).map((m) => m.activity_master_id),
    );
    return masters.masters
      .filter((m) => allowed.has(m.id))
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }, [masters, entityType]);

  // Load possible parents lazily based on entity type
  const parents = useEntityParents(entityType, open);

  const [parentId, setParentId] = useState<string>("");
  const [masterId, setMasterId] = useState<string>("");

  const selectedMaster = availableMasters.find((m) => m.id === (masterId || availableMasters[0]?.id));

  const save = useMutation({
    mutationFn: async (payload: {
      parentId: number;
      masterId: string;
      when: string;
      summary: string;
      details: string;
    }) => {
      const row: Record<string, unknown> = {
        activity_master_id: payload.masterId,
        activity_date: new Date(payload.when).toISOString(),
        summary: payload.summary.trim() || null,
        details: payload.details.trim() || null,
      };
      row[ENTITY_FK[entityType]] = payload.parentId;
      const { error } = await supabase.from("Activity").insert(row as never);
      if (error) throw error;

      if (selectedMaster?.changes_stage && selectedMaster.target_stage && entityType === "Opportunity") {
        const result = await supabase
          .from("Opportunity")
          .update({ stage: selectedMaster.target_stage })
          .eq("id", payload.parentId)
          .select("id");
        assertUpdatedRows(result, "Opportunity stage");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timeline", "global"] });
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["opportunity"] });
      onOpenChange(false);
      setParentId("");
      setMasterId("");
      toast.success("Activity logged");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!parentId) {
      toast.error("Pick a parent record");
      return;
    }
    if (!selectedMaster) {
      toast.error("Pick an activity type");
      return;
    }
    const fd = new FormData(e.currentTarget);
    save.mutate({
      parentId: Number(parentId),
      masterId: selectedMaster.id,
      when: String(fd.get("when") ?? ""),
      summary: String(fd.get("summary") ?? ""),
      details: String(fd.get("details") ?? ""),
    });
  };

  const now = (() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New activity</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="entityType">Entity *</Label>
              <select
                id="entityType"
                value={entityType}
                onChange={(e) => {
                  setEntityType(e.target.value as EntityType);
                  setParentId("");
                  setMasterId("");
                }}
                className="w-full h-9 px-3 rounded-md border border-border bg-surface text-sm"
              >
                {ENTITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="parentId">Record *</Label>
              <select
                id="parentId"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                required
                className="w-full h-9 px-3 rounded-md border border-border bg-surface text-sm"
              >
                <option value="">— choose —</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="master">Type *</Label>
              <select
                id="master"
                value={masterId || availableMasters[0]?.id || ""}
                onChange={(e) => setMasterId(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-border bg-surface text-sm"
              >
                {availableMasters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="when">When *</Label>
              <Input id="when" name="when" type="datetime-local" defaultValue={now} required />
            </div>
          </div>

          {selectedMaster?.changes_stage && selectedMaster.target_stage && entityType === "Opportunity" && (
            <p className="text-xs text-muted bg-ink/[0.03] p-2.5 rounded-md ring-1 ring-border">
              This activity will also move the opportunity stage to{" "}
              <span className="font-medium text-ink">{selectedMaster.target_stage}</span>.
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="summary">Title (optional)</Label>
            <Input id="summary" name="summary" placeholder="Short summary" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="details">Notes</Label>
            <Textarea id="details" name="details" rows={4} />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={save.isPending}
              className="bg-ink text-canvas hover:bg-ink/90"
            >
              {save.isPending ? "Saving…" : "Log activity"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function useEntityParents(entityType: EntityType, _enabled: boolean): Array<{ id: number; label: string }> {
  const channels = useSuspenseQuery(channelsQuery);
  const opps = useSuspenseQuery(opportunitiesMinimalQuery);
  const props = useSuspenseQuery(proposalsQuery);
  const engs = useSuspenseQuery(engagementsQuery);
  const invs = useSuspenseQuery(invoicesQuery);

  switch (entityType) {
    case "Channel":
      return (channels.data as Array<{ id: number; name: string | null }>).map((c) => ({
        id: c.id,
        label: c.name ?? `Channel #${c.id}`,
      }));
    case "Opportunity":
      return (opps.data as Array<{ id: number; title: string | null }>).map((o) => ({
        id: o.id,
        label: o.title ?? `Opportunity #${o.id}`,
      }));
    case "Proposal":
      return (props.data as Array<{ id: number; title: string | null }>).map((p) => ({
        id: p.id,
        label: p.title ?? `Proposal #${p.id}`,
      }));
    case "Engagement":
      return (engs.data as Array<{ id: number; title: string | null }>).map((e) => ({
        id: e.id,
        label: e.title ?? `Engagement #${e.id}`,
      }));
    case "Invoice":
      return (invs.data as Array<{ id: number; invoice_no: number | null }>).map((i) => ({
        id: i.id,
        label: `Invoice #${i.invoice_no ?? i.id}`,
      }));
  }
}
