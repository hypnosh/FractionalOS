import { useMemo, useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { LogActivityDialog } from "@/components/log-activity-dialog";
import { supabase } from "@/lib/supabase";
import {
  activitiesForEntityQuery,
  invoiceQuery,
  engagementQuery,
  proposalQuery,
  opportunityQuery,
  type ActivityRow,
  type EntityType,
} from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { Invoice, Payment, Proposal } from "@/lib/db-types";

type DerivedEvent = {
  id: string;
  ts: string;
  title: string;
  category: string;
  detail?: string | null;
  href?: string;
};

type Props = {
  entityType: EntityType;
  parentId: number;
};

export function EntityTimeline({ entityType, parentId }: Props) {
  const qc = useQueryClient();
  const { data: activities } = useSuspenseQuery(activitiesForEntityQuery(entityType, parentId));
  const [logOpen, setLogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ActivityRow | null>(null);

  const derived = useDerivedEvents(entityType, parentId);

  const combined = useMemo(() => {
    const rows: Array<
      | { kind: "activity"; ts: string; act: ActivityRow }
      | { kind: "derived"; ts: string; ev: DerivedEvent }
    > = [];
    for (const a of activities) {
      const ts = a.activity_date ?? a.created_at;
      rows.push({ kind: "activity", ts, act: a });
    }
    for (const ev of derived) rows.push({ kind: "derived", ts: ev.ts, ev });
    rows.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    return rows;
  }, [activities, derived]);

  const del = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("Activity").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities", entityType, parentId] });
      qc.invalidateQueries({ queryKey: ["timeline", "global"] });
      setConfirmDelete(null);
      toast.success("Activity deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="bg-surface ring-1 ring-border rounded-xl">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Timeline</h2>
          <p className="text-[11px] text-muted mt-0.5">
            {combined.length} {combined.length === 1 ? "event" : "events"}
          </p>
        </div>
        <Button
          className="h-8 bg-ink text-canvas hover:bg-ink/90"
          onClick={() => setLogOpen(true)}
        >
          <Plus className="size-3.5" />
          Log activity
        </Button>
      </div>

      {combined.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted">
          No events yet.{" "}
          <button className="underline text-ink" onClick={() => setLogOpen(true)}>
            Log the first activity
          </button>
          .
        </div>
      ) : (
        <ol className="relative">
          {combined.map((row, i) => (
            <TimelineRow
              key={row.kind === "activity" ? `a-${row.act.id}` : `d-${row.ev.id}`}
              row={row}
              first={i === 0}
              last={i === combined.length - 1}
              onDelete={row.kind === "activity" ? () => setConfirmDelete(row.act) : undefined}
            />
          ))}
        </ol>
      )}

      <LogActivityDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        entityType={entityType}
        parentId={parentId}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this activity?</AlertDialogTitle>
            <AlertDialogDescription>
              Derived timeline events (created / sent / paid) can't be deleted here — they follow the
              underlying record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && del.mutate(confirmDelete.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TimelineRow({
  row,
  first,
  last,
  onDelete,
}: {
  row:
    | { kind: "activity"; ts: string; act: ActivityRow }
    | { kind: "derived"; ts: string; ev: DerivedEvent };
  first: boolean;
  last: boolean;
  onDelete?: () => void;
}) {
  const ts = row.ts;
  const category = row.kind === "activity" ? row.act.ActivityMaster?.category ?? "note" : row.ev.category;
  const label =
    row.kind === "activity" ? row.act.ActivityMaster?.name ?? "Activity" : row.ev.title;
  const title = row.kind === "activity" ? row.act.summary : row.ev.detail ?? null;
  const details = row.kind === "activity" ? row.act.details : null;

  return (
    <li className="relative pl-12 pr-5 py-4 group hover:bg-ink/[0.015]">
      <span
        className={cn(
          "absolute left-[22px] w-px bg-border",
          first ? "top-6" : "top-0",
          last ? "bottom-1/2" : "bottom-0",
        )}
      />
      <span
        className={cn(
          "absolute left-[15px] top-6 size-3.5 rounded-full ring-2 ring-surface",
          dotColor(category, row.kind === "derived"),
        )}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-full font-medium",
                chipColor(category, row.kind === "derived"),
              )}
            >
              {label}
            </span>
            {row.kind === "derived" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-ink/[0.05] text-muted uppercase tracking-wider">
                system
              </span>
            )}
            <span className="text-xs text-muted" title={new Date(ts).toLocaleString()}>
              {relativeTime(ts)} · {new Date(ts).toLocaleString()}
            </span>
          </div>
          {title && <p className="mt-1 text-sm font-medium text-ink">{title}</p>}
          {details && <p className="mt-1 text-sm text-muted whitespace-pre-wrap">{details}</p>}
          {row.kind === "derived" && row.ev.href && (
            <Link to={row.ev.href} className="mt-1 inline-block text-xs text-ink/70 underline">
              Open record →
            </Link>
          )}
        </div>
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md hover:bg-red-50 text-muted hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Delete activity"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </li>
  );
}

// ---------- Derived events per entity ----------

function useDerivedEvents(entityType: EntityType, parentId: number): DerivedEvent[] {
  switch (entityType) {
    case "Opportunity":
      return useOpportunityDerived(parentId);
    case "Proposal":
      return useProposalDerived(parentId);
    case "Engagement":
      return useEngagementDerived(parentId);
    case "Invoice":
      return useInvoiceDerived(parentId);
    default:
      return [];
  }
}

function useOpportunityDerived(oppId: number): DerivedEvent[] {
  const { data } = useSuspenseQuery(opportunityQuery(oppId)) as { data: import("@/lib/db-types").Opportunity };
  const proposals = useSuspenseQuery(proposalsForOppQuery(oppId));
  const evs: DerivedEvent[] = [];
  for (const p of proposals.data) evs.push(...proposalEvents(p));
  if (data.opened_date) {
    evs.push({
      id: `opp-opened-${data.id}`,
      ts: data.opened_date,
      title: "Opportunity opened",
      category: "system",
    });
  }
  return evs;
}

function useProposalDerived(propId: number): DerivedEvent[] {
  const { data } = useSuspenseQuery(proposalQuery(propId)) as { data: Proposal };
  return proposalEvents(data);
}

function useEngagementDerived(engId: number): DerivedEvent[] {
  const { data } = useSuspenseQuery(engagementQuery(engId)) as { data: import("@/lib/db-types").Engagement };
  const invoices = useSuspenseQuery(invoicesForEngagementQuery(engId));
  const evs: DerivedEvent[] = [];
  if (data.start_date) {
    evs.push({
      id: `eng-start-${data.id}`,
      ts: data.start_date,
      title: "Engagement started",
      category: "delivery",
    });
  }
  if (data.actual_end_date) {
    evs.push({
      id: `eng-end-${data.id}`,
      ts: data.actual_end_date,
      title: "Engagement ended",
      category: "delivery",
    });
  }
  for (const inv of invoices.data) {
    evs.push(...invoiceEvents(inv));
    for (const p of inv.Payments) evs.push(paymentEvent(p, inv));
  }
  return evs;
}

function useInvoiceDerived(invId: number): DerivedEvent[] {
  const { data } = useSuspenseQuery(invoiceQuery(invId));
  const payments = useSuspenseQuery(paymentsForInvoiceQuery(invId));
  return [
    ...invoiceEvents(data as Invoice),
    ...payments.data.map((p) => paymentEvent(p, data as Invoice)),
  ];
}

function proposalEvents(
  p: Pick<Proposal, "id" | "title" | "status" | "sent_date" | "created_at" | "updated_at" | "opp_id">,
): DerivedEvent[] {
  const evs: DerivedEvent[] = [];
  evs.push({
    id: `prop-created-${p.id}`,
    ts: p.created_at,
    title: "Proposal created",
    category: "proposal",
    detail: p.title ?? "Untitled proposal",
    href: `/proposals/${p.id}`,
  });
  if (p.sent_date) {
    evs.push({
      id: `prop-sent-${p.id}`,
      ts: p.sent_date,
      title: "Proposal sent",
      category: "proposal",
      detail: p.title ?? null,
      href: `/proposals/${p.id}`,
    });
  }
  const s = (p.status ?? "").toLowerCase();
  if (s === "accepted" || s === "won") {
    evs.push({
      id: `prop-accepted-${p.id}`,
      ts: p.updated_at ?? p.created_at,
      title: "Proposal accepted",
      category: "proposal-accepted",
      href: `/proposals/${p.id}`,
    });
  } else if (s === "rejected" || s === "lost") {
    evs.push({
      id: `prop-rejected-${p.id}`,
      ts: p.updated_at ?? p.created_at,
      title: "Proposal rejected",
      category: "proposal-rejected",
      href: `/proposals/${p.id}`,
    });
  }
  return evs;
}

function invoiceEvents(inv: Invoice): DerivedEvent[] {
  const evs: DerivedEvent[] = [];
  evs.push({
    id: `inv-created-${inv.id}`,
    ts: inv.created_at,
    title: "Invoice created",
    category: "invoice",
    detail: `#${inv.invoice_no ?? inv.id}`,
    href: `/invoices/${inv.id}`,
  });
  const s = (inv.status ?? "").toLowerCase();
  if (s === "sent" && inv.invoice_date) {
    evs.push({
      id: `inv-sent-${inv.id}`,
      ts: inv.invoice_date,
      title: "Invoice sent",
      category: "invoice",
      detail: `#${inv.invoice_no ?? inv.id}`,
      href: `/invoices/${inv.id}`,
    });
  }
  if (s === "paid") {
    evs.push({
      id: `inv-paid-${inv.id}`,
      ts: inv.updated_at ?? inv.created_at,
      title: "Invoice paid",
      category: "paid",
      detail: `#${inv.invoice_no ?? inv.id}`,
      href: `/invoices/${inv.id}`,
    });
  }
  return evs;
}

function paymentEvent(
  p: Pick<Payment, "id" | "amount" | "payment_date" | "mode" | "created_at">,
  inv: Pick<Invoice, "id" | "invoice_no">,
): DerivedEvent {
  return {
    id: `pay-${p.id}`,
    ts: p.payment_date ?? p.created_at,
    title: "Payment received",
    category: "paid",
    detail: `${p.amount != null ? "₹" + Number(p.amount).toLocaleString("en-IN") : ""}${p.mode ? " · " + p.mode : ""} on invoice #${inv.invoice_no ?? inv.id}`,
    href: `/invoices/${inv.id}`,
  };
}

// Focused helper queries for derived events
import { queryOptions } from "@tanstack/react-query";

const proposalsForOppQuery = (oppId: number) =>
  queryOptions({
    queryKey: ["proposals", "opp", oppId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("Proposal")
        .select("id, title, status, sent_date, created_at, updated_at, opp_id")
        .eq("opp_id", oppId);
      if (error) throw error;
      return (data ?? []) as Array<
        Pick<Proposal, "id" | "title" | "status" | "sent_date" | "created_at" | "updated_at" | "opp_id">
      >;
    },
  });

const invoicesForEngagementQuery = (engId: number) =>
  queryOptions({
    queryKey: ["invoices", "eng", engId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("Invoice")
        .select("*, Payments:Payment(id, amount, payment_date, mode, created_at)")
        .eq("engagement_id", engId);
      if (error) throw error;
      return (data ?? []) as Array<
        Invoice & { Payments: Array<Pick<Payment, "id" | "amount" | "payment_date" | "mode" | "created_at">> }
      >;
    },
  });

const paymentsForInvoiceQuery = (invId: number) =>
  queryOptions({
    queryKey: ["payments", "inv", invId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("Payment")
        .select("id, amount, payment_date, mode, created_at")
        .eq("invoice_id", invId);
      if (error) throw error;
      return (data ?? []) as Array<
        Pick<Payment, "id" | "amount" | "payment_date" | "mode" | "created_at">
      >;
    },
  });

// ---------- Styling helpers ----------

export function dotColor(category: string, derived = false): string {
  if (derived) {
    switch (category) {
      case "proposal-accepted":
      case "paid":
        return "bg-emerald-500";
      case "proposal-rejected":
        return "bg-red-500";
      case "proposal":
        return "bg-sky-500";
      case "invoice":
        return "bg-teal-500";
      case "delivery":
        return "bg-indigo-500";
      default:
        return "bg-ink/40";
    }
  }
  switch (category) {
    case "call":
      return "bg-indigo-500";
    case "meeting":
      return "bg-indigo-500";
    case "email":
    case "message":
      return "bg-amber-500";
    case "follow-up":
      return "bg-violet-500";
    case "proposal":
      return "bg-sky-500";
    case "delivery":
      return "bg-indigo-500";
    case "invoice":
      return "bg-teal-500";
    case "channel":
      return "bg-pink-500";
    default:
      return "bg-ink/40";
  }
}

export function chipColor(category: string, derived = false): string {
  if (derived) {
    switch (category) {
      case "proposal-accepted":
      case "paid":
        return "bg-emerald-100 text-emerald-800";
      case "proposal-rejected":
        return "bg-red-100 text-red-800";
      case "proposal":
        return "bg-sky-100 text-sky-800";
      case "invoice":
        return "bg-teal-100 text-teal-800";
      case "delivery":
        return "bg-indigo-100 text-indigo-800";
      default:
        return "bg-ink/[0.06] text-ink/70";
    }
  }
  switch (category) {
    case "call":
    case "meeting":
      return "bg-indigo-100 text-indigo-800";
    case "email":
    case "message":
      return "bg-amber-100 text-amber-800";
    case "follow-up":
      return "bg-violet-100 text-violet-800";
    case "proposal":
      return "bg-sky-100 text-sky-800";
    case "delivery":
      return "bg-indigo-100 text-indigo-800";
    case "invoice":
      return "bg-teal-100 text-teal-800";
    case "channel":
      return "bg-pink-100 text-pink-800";
    default:
      return "bg-ink/[0.06] text-ink/70";
  }
}

export function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const abs = Math.abs(diff);
  const suffix = diff >= 0 ? "ago" : "from now";
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  const wk = 7 * day;
  const mo = 30 * day;
  const yr = 365 * day;
  const pick = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"} ${suffix}`;
  if (abs < min) return "just now";
  if (abs < hr) return pick(Math.floor(abs / min), "minute");
  if (abs < day) return pick(Math.floor(abs / hr), "hour");
  if (abs < wk) return pick(Math.floor(abs / day), "day");
  if (abs < mo) return pick(Math.floor(abs / wk), "week");
  if (abs < yr) return pick(Math.floor(abs / mo), "month");
  return pick(Math.floor(abs / yr), "year");
}
