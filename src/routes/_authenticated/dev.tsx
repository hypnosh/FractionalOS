import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/crud";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

// Tables in dependency-safe delete order (children first, parents last).
type ResetTable =
  | "Activity"
  | "Task"
  | "Payment"
  | "Invoice"
  | "Engagement"
  | "Proposal"
  | "OpportunityContact"
  | "Opportunity"
  | "Contact"
  | "Organization"
  | "Channel"
  | "Expense";

const RESET_ORDER: ResetTable[] = [
  "Activity",
  "Task",
  "Payment",
  "Invoice",
  "Engagement",
  "Proposal",
  "OpportunityContact",
  "Opportunity",
  "Contact",
  "Organization",
  "Channel",
  "Expense",
];

// Direct dependents (tables holding FKs pointing at the key).
const DEPENDENTS: Record<ResetTable, ResetTable[]> = {
  Activity: [],
  Task: [],
  Payment: [],
  Invoice: ["Activity", "Payment"],
  Engagement: ["Activity", "Invoice", "Expense"],
  Proposal: ["Activity", "Engagement"],
  OpportunityContact: [],
  Opportunity: ["Task", "Activity", "Proposal", "OpportunityContact"],
  Contact: ["OpportunityContact"],
  Organization: ["Contact", "Opportunity", "Engagement", "Expense"],
  Channel: ["Activity", "Opportunity"],
  Expense: [],
};

// Target + all transitive dependents, ordered children-first via RESET_ORDER.
function chainFor(table: ResetTable): ResetTable[] {
  const set = new Set<ResetTable>();
  const walk = (t: ResetTable) => {
    if (set.has(t)) return;
    set.add(t);
    for (const d of DEPENDENTS[t]) walk(d);
  };
  walk(table);
  return RESET_ORDER.filter((t) => set.has(t));
}

const COUNT_TABLES: ResetTable[] = [
  "Organization",
  "Contact",
  "Channel",
  "Opportunity",
  "OpportunityContact",
  "Proposal",
  "Task",
  "Activity",
  "Engagement",
  "Invoice",
  "Payment",
  "Expense",
];

export const Route = createFileRoute("/_authenticated/dev")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: "/settings" });
  },
  component: DevSettingsPage,
});

function DevSettingsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const supabaseUrl =
    (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
    "https://mqqsltwseyklrjkzhlsa.supabase.co";
  const environment = import.meta.env.DEV ? "development" : "production";
  const mode = import.meta.env.MODE;

  const loadCounts = async () => {
    const entries = await Promise.all(
      COUNT_TABLES.map(async (t) => {
        const { count, error } = await supabase.from(t).select("id", { count: "exact", head: true });
        return [t, error ? null : (count ?? 0)] as const;
      }),
    );
    setCounts(Object.fromEntries(entries));
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    loadCounts();
  }, []);

  const deleteAllFrom = async (table: ResetTable) => {
    setLoading(true);
    try {
      const chain = chainFor(table);
      for (const t of chain) {
        const { error } = await supabase.from(t).delete().gt("id", 0);
        if (error) throw new Error(`${t}: ${error.message}`);
      }
      const extra = chain.length > 1 ? ` (plus dependents: ${chain.slice(0, -1).join(", ")})` : "";
      toast.success(`Cleared all ${table} rows${extra}`);
      await loadCounts();
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Failed to clear ${table}`);
    } finally {
      setLoading(false);
    }
  };

  const resetEverything = async () => {
    setLoading(true);
    try {
      for (const table of RESET_ORDER) {
        const { error } = await supabase.from(table).delete().gt("id", 0);
        if (error) throw new Error(`${table}: ${error.message}`);
      }
      toast.success("All data cleared in dependency-safe order");
      await loadCounts();
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Developer Settings"
        subtitle="Development-only utilities. Hidden in production builds."
      />

      <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm">
        <AlertTriangle className="size-4 mt-0.5 shrink-0" />
        <p>
          Destructive actions on this page cannot be undone. Only your own rows (per RLS) will be affected.
        </p>
      </div>

      <section className="bg-surface ring-1 ring-border rounded-xl p-6 space-y-3">
        <h2 className="text-sm font-semibold">Environment</h2>
        <Row label="Authenticated user ID" value={userId ?? "—"} mono />
        <Row label="Environment" value={environment} />
        <Row label="Vite mode" value={mode} />
        <Row label="Supabase URL" value={supabaseUrl} mono />
      </section>

      <section className="bg-surface ring-1 ring-border rounded-xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Row counts</h2>
          <button
            onClick={loadCounts}
            className="text-xs text-muted hover:text-ink"
          >
            Refresh
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {COUNT_TABLES.map((t) => (
            <div key={t} className="rounded-md ring-1 ring-border p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted">{t}</div>
              <div className="text-lg font-medium mt-0.5">
                {counts[t] == null ? "…" : counts[t]}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-surface ring-1 ring-border rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Reset data</h2>
          <p className="text-xs text-muted mt-1">
            Deletes are executed in dependency-safe order (children first). Only affects rows visible to you.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ConfirmDelete
            trigger="Delete all Activities"
            table="Activity"
            onConfirm={() => deleteAllFrom("Activity")}
            disabled={loading}
          />
          <ConfirmDelete
            trigger="Delete all Opportunities"
            table="Opportunity"
            note="Also clears dependent Tasks, Activities, Engagements, and Invoices."
            onConfirm={() => deleteAllFrom("Opportunity")}
            disabled={loading}
          />
          <ConfirmDelete
            trigger="Delete all Contacts"
            table="Contact"
            onConfirm={() => deleteAllFrom("Contact")}
            disabled={loading}
          />
          <ConfirmDelete
            trigger="Delete all Organizations"
            table="Organization"
            onConfirm={() => deleteAllFrom("Organization")}
            disabled={loading}
          />
          <ConfirmDelete
            trigger="Delete all Channels"
            table="Channel"
            onConfirm={() => deleteAllFrom("Channel")}
            disabled={loading}
          />
          <ConfirmDelete
            trigger="Delete all Engagements"
            table="Engagement"
            onConfirm={() => deleteAllFrom("Engagement")}
            disabled={loading}
          />
          <ConfirmDelete
            trigger="Delete all Proposals"
            table="Proposal"
            note="Proposal table is not present in the current schema; this action is a no-op placeholder."
            onConfirm={() => toast.info("Proposal table not present — nothing to delete.")}
            disabled={loading}
          />
          <ConfirmDelete
            trigger="Delete all Invoices"
            table="Invoice"
            onConfirm={() => deleteAllFrom("Invoice")}
            disabled={loading}
          />
        </div>

        <div className="pt-3 border-t border-border">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                disabled={loading}
                className="bg-danger text-canvas hover:bg-danger/90"
              >
                Reset ALL data (dependency-safe)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset all data?</AlertDialogTitle>
                <AlertDialogDescription>
                  Deletes rows from Activity, Task, Invoice, Engagement, Opportunity, Contact,
                  Organization and Channel in that order. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={resetEverything}
                  className="bg-danger text-canvas hover:bg-danger/90"
                >
                  Reset everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>
    </div>
  );
}

function ConfirmDelete({
  trigger,
  table,
  note,
  onConfirm,
  disabled,
}: {
  trigger: string;
  table: string;
  note?: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          disabled={disabled}
          className="text-xs px-3 py-1.5 rounded-md ring-1 ring-border hover:bg-ink/[0.03] disabled:opacity-50"
        >
          {trigger}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{trigger}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will delete every {table} row visible to you. This cannot be undone.
            {note && <span className="block mt-2 text-xs text-muted">{note}</span>}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-danger text-canvas hover:bg-danger/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-1 sm:gap-4">
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className={mono ? "text-xs font-mono break-all" : "text-sm"}>{value}</div>
    </div>
  );
}
