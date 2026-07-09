import { useMemo, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, Pencil, Trash2, Building2, Calendar } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { activitiesForOppQuery, opportunityQuery } from "@/lib/queries";
import { PageHeader } from "@/components/crud";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import type { Activity } from "@/lib/db-types";

const ACTIVITY_TYPES = [
  "Intro Call",
  "Discovery Call",
  "Follow-up",
  "Meeting",
  "Proposal Sent",
  "Proposal Accepted",
  "Proposal Rejected",
  "Email",
  "WhatsApp",
  "Note",
  "Other",
] as const;
type ActivityType = (typeof ACTIVITY_TYPES)[number];

const OVERRIDE_STATUSES = ["Lost", "On Hold", "Cancelled", "Abandoned"] as const;

// Which activity types drive derived opportunity stage.
const derivedStageFor = (type: string): string | null => {
  switch (type) {
    case "Proposal Sent":
      return "proposal sent";
    case "Proposal Accepted":
      return "won";
    case "Proposal Rejected":
      return "lost";
    default:
      return null;
  }
};

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
    context.queryClient.ensureQueryData(activitiesForOppQuery(params.oppId));
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
  const { data: activities } = useSuspenseQuery(activitiesForOppQuery(oppId));
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Activity | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["activities", "opp", oppId] });
    qc.invalidateQueries({ queryKey: ["opportunity", oppId] });
    qc.invalidateQueries({ queryKey: ["opportunities"] });
    qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
  };

  const upsertActivity = useMutation({
    mutationFn: async (payload: {
      id?: number;
      activity_type: ActivityType;
      activity_date: string;
      summary: string;
      details: string | null;
    }) => {
      const row = {
        opp_id: oppId,
        activity_type: payload.activity_type,
        activity_date: payload.activity_date,
        summary: payload.summary || null,
        details: payload.details,
      };

      if (payload.id) {
        const { error } = await supabase
          .from("Activity")
          .update(row)
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("Activity").insert(row);
        if (error) throw error;
      }

      // Derived stage engine — only on new activities that map to a stage.
      if (!payload.id) {
        const nextStage = derivedStageFor(payload.activity_type);
        if (nextStage) {
          const { error: uErr } = await supabase
            .from("Opportunity")
            .update({ stage: nextStage })
            .eq("id", oppId);
          if (uErr) throw uErr;
        }
      }
    },
    onSuccess: () => {
      invalidateAll();
      setDialogOpen(false);
      setEditing(null);
      toast.success(editing ? "Activity updated" : "Activity logged");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteActivity = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("Activity").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      setConfirmDelete(null);
      toast.success("Activity deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyOverride = useMutation({
    mutationFn: async (payload: { status: (typeof OVERRIDE_STATUSES)[number]; reason: string }) => {
      const stagePatch =
        payload.status === "Lost" ? { stage: "lost" as string } : {};
      const { error } = await supabase
        .from("Opportunity")
        .update({ status: payload.status, ...stagePatch })
        .eq("id", oppId);
      if (error) throw error;

      // Also drop a Note activity capturing the override + reason.
      const summary = `Status set to ${payload.status}`;
      const { error: aErr } = await supabase.from("Activity").insert({
        opp_id: oppId,
        activity_type: "Note",
        activity_date: new Date().toISOString(),
        summary,
        details: payload.reason || null,
      });
      if (aErr) throw aErr;
    },
    onSuccess: () => {
      invalidateAll();
      setOverrideOpen(false);
      toast.success("Status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lastActivity = activities[0] ?? null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const activity_type = String(fd.get("activity_type") ?? "") as ActivityType;
    const activity_date = String(fd.get("activity_date") ?? "");
    const summary = String(fd.get("summary") ?? "").trim();
    const details = String(fd.get("details") ?? "").trim() || null;
    if (!activity_type || !activity_date) {
      toast.error("Type and date are required");
      return;
    }
    upsertActivity.mutate({
      id: editing?.id,
      activity_type,
      activity_date: new Date(activity_date).toISOString(),
      summary,
      details,
    });
  };

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
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-9"
              onClick={() => setOverrideOpen(true)}
            >
              Override status
            </Button>
            <Button
              className="h-9 bg-ink text-canvas hover:bg-ink/90"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4 mr-1" /> New activity
            </Button>
          </div>
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
        <Stat
          label="Last activity"
          value={
            lastActivity
              ? relativeTime(lastActivity.activity_date ?? lastActivity.created_at)
              : "—"
          }
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface ring-1 ring-border rounded-xl">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold">Activity timeline</h2>
            <span className="text-xs text-muted">
              {activities.length} {activities.length === 1 ? "entry" : "entries"}
            </span>
          </div>
          {activities.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted">
              <p>No activities yet.</p>
              <Button
                variant="link"
                className="mt-1 text-ink"
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                Log your first activity
              </Button>
            </div>
          ) : (
            <ol className="relative">
              {activities.map((a, i) => (
                <TimelineItem
                  key={a.id}
                  activity={a}
                  first={i === 0}
                  last={i === activities.length - 1}
                  onEdit={() => {
                    setEditing(a);
                    setDialogOpen(true);
                  }}
                  onDelete={() => setConfirmDelete(a)}
                />
              ))}
            </ol>
          )}
        </div>

        <div className="space-y-6">
          <PlaceholderCard title="Tasks" note="Task management arrives in a later increment." />
          <PlaceholderCard title="Proposal" note="Proposal versioning arrives in a later increment." />
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

      <ActivityDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditing(null);
        }}
        editing={editing}
        onSubmit={handleSubmit}
        submitting={upsertActivity.isPending}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this activity?</AlertDialogTitle>
            <AlertDialogDescription>
              This can't be undone. The activity will be removed from the timeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteActivity.mutate(confirmDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

function ActivityDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Activity | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  submitting: boolean;
}) {
  const defaultDate = useMemo(() => {
    const iso = editing?.activity_date ?? new Date().toISOString();
    // datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, [editing]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit activity" : "New activity"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" key={editing?.id ?? "new"}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="activity_type">Type *</Label>
              <select
                id="activity_type"
                name="activity_type"
                autoFocus
                defaultValue={(editing?.activity_type as ActivityType) ?? "Follow-up"}
                className="w-full h-9 px-3 rounded-md border border-border bg-surface text-sm"
              >
                {ACTIVITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="activity_date">When *</Label>
              <Input
                id="activity_date"
                name="activity_date"
                type="datetime-local"
                defaultValue={defaultDate}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="summary">Title</Label>
            <Input
              id="summary"
              name="summary"
              defaultValue={editing?.summary ?? ""}
              placeholder="Short summary"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="details">Notes</Label>
            <Textarea
              id="details"
              name="details"
              rows={4}
              defaultValue={editing?.details ?? ""}
              placeholder="Details, quotes, next steps…"
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-ink text-canvas hover:bg-ink/90"
            >
              {submitting ? "Saving…" : editing ? "Save changes" : "Log activity"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TimelineItem({
  activity,
  first,
  last,
  onEdit,
  onDelete,
}: {
  activity: Activity;
  first: boolean;
  last: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const ts = activity.activity_date ?? activity.created_at;
  const type = activity.activity_type ?? "Other";
  return (
    <li className="relative pl-12 pr-5 py-4 group hover:bg-ink/[0.015]">
      {/* rail */}
      <span
        className={cn(
          "absolute left-[22px] top-0 w-px bg-border",
          first ? "top-6" : "top-0",
          last ? "bottom-1/2" : "bottom-0",
        )}
      />
      <span
        className={cn(
          "absolute left-[15px] top-6 size-3.5 rounded-full ring-2 ring-surface",
          dotColor(type),
        )}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", chipColor(type))}>
              {type}
            </span>
            <span className="text-xs text-muted" title={new Date(ts).toLocaleString()}>
              {relativeTime(ts)} · {new Date(ts).toLocaleString()}
            </span>
          </div>
          {activity.summary && (
            <p className="mt-1 text-sm font-medium text-ink">{activity.summary}</p>
          )}
          {activity.details && (
            <p className="mt-1 text-sm text-muted whitespace-pre-wrap">{activity.details}</p>
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-md hover:bg-ink/[0.06] text-muted hover:text-ink"
            aria-label="Edit activity"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md hover:bg-red-50 text-muted hover:text-red-600"
            aria-label="Delete activity"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </li>
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

function PlaceholderCard({ title, note }: { title: string; note: string }) {
  return (
    <div className="bg-surface ring-1 ring-border rounded-xl p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-xs text-muted">{note}</p>
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

function relativeTime(iso: string | null): string {
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

function dotColor(type: string): string {
  switch (type) {
    case "Proposal Sent":
      return "bg-sky-500";
    case "Proposal Accepted":
      return "bg-emerald-500";
    case "Proposal Rejected":
      return "bg-red-500";
    case "Intro Call":
    case "Discovery Call":
    case "Meeting":
      return "bg-indigo-500";
    case "Email":
    case "WhatsApp":
      return "bg-amber-500";
    case "Follow-up":
      return "bg-violet-500";
    case "Note":
      return "bg-ink/40";
    default:
      return "bg-ink/40";
  }
}

function chipColor(type: string): string {
  switch (type) {
    case "Proposal Sent":
      return "bg-sky-100 text-sky-800";
    case "Proposal Accepted":
      return "bg-emerald-100 text-emerald-800";
    case "Proposal Rejected":
      return "bg-red-100 text-red-800";
    case "Intro Call":
    case "Discovery Call":
    case "Meeting":
      return "bg-indigo-100 text-indigo-800";
    case "Email":
    case "WhatsApp":
      return "bg-amber-100 text-amber-800";
    case "Follow-up":
      return "bg-violet-100 text-violet-800";
    case "Note":
      return "bg-ink/[0.06] text-ink/70";
    default:
      return "bg-ink/[0.06] text-ink/70";
  }
}
