import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { channelsQuery, opportunitiesQuery, organizationsQuery } from "@/lib/queries";
import { PageHeader, NewButton, RecordDialog, RowActions, EmptyState, useDialogState } from "@/components/crud";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Opportunity } from "@/lib/db-types";
import { assertUpdatedRows } from "@/lib/mutation-guards";

type OppRow = Opportunity & {
  Organization: { name: string | null } | null;
  Channel: { name: string | null } | null;
};

const STAGES = ["discovery", "qualified", "proposal", "negotiation", "won", "lost"] as const;

const stageColor: Record<string, string> = {
  discovery: "bg-ink/[0.06] text-ink/70",
  qualified: "bg-amber-100 text-amber-800",
  proposal: "bg-sky-100 text-sky-800",
  negotiation: "bg-indigo-100 text-indigo-800",
  won: "bg-success-bg text-success",
  lost: "bg-red-100 text-red-800",
};

export const Route = createFileRoute("/_authenticated/opportunities/")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(opportunitiesQuery);
    context.queryClient.ensureQueryData(organizationsQuery);
    context.queryClient.ensureQueryData(channelsQuery);
  },
  component: OpportunitiesPage,
});

const currency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function OpportunitiesPage() {
  const { data: opps } = useSuspenseQuery(opportunitiesQuery) as { data: OppRow[] };
  const { data: orgs } = useSuspenseQuery(organizationsQuery);
  const { data: channels } = useSuspenseQuery(channelsQuery);
  const qc = useQueryClient();
  const d = useDialogState<OppRow>();

  const upsert = useMutation({
    mutationFn: async (payload: Partial<Opportunity>) => {
      if (d.editing) {
        const result = await supabase.from("Opportunity").update(payload).eq("id", d.editing.id).select("id");
        assertUpdatedRows(result, "Opportunity");
      } else {
        const { error } = await supabase.from("Opportunity").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
      d.close();
      toast.success(d.editing ? "Opportunity updated" : "Opportunity created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("Opportunity").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
      toast.success("Opportunity deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const val = String(fd.get("expected_value") ?? "");
    const prob = String(fd.get("probability") ?? "");
    const org = String(fd.get("org_id") ?? "");
    const ch = String(fd.get("source_channel_id") ?? "");
    upsert.mutate({
      title: String(fd.get("title") ?? "").trim() || null,
      stage: (fd.get("stage") as string) || null,
      status: (fd.get("status") as string) || null,
      expected_value: val ? Number(val) : null,
      probability: prob ? Number(prob) : null,
      expected_close_date: (fd.get("expected_close_date") as string) || null,
      org_id: org ? Number(org) : null,
      source_channel_id: ch ? Number(ch) : null,
      notes: (fd.get("notes") as string) || null,
    });
  };

  return (
    <div>
      <PageHeader
        title="Opportunities"
        subtitle="Deals in flight across your portfolio."
        action={<NewButton onClick={d.openNew} />}
      />

      {opps.length === 0 ? (
        <EmptyState message="No opportunities yet." onCreate={d.openNew} />
      ) : (
        <div className="bg-surface ring-1 ring-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink/[0.02] border-b border-border text-left">
              <tr>
                <Th>Title</Th>
                <Th>Organization</Th>
                <Th>Channel</Th>
                <Th>Stage</Th>
                <Th>Value</Th>
                <Th>Prob.</Th>
                <Th>Close</Th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {opps.map((o) => {
                const stageKey = (o.stage ?? "").toLowerCase();
                return (
                  <tr key={o.id} className="hover:bg-ink/[0.015]">
                    <td className="py-3 px-4 font-medium">
                      <Link
                        to="/opportunities/$oppId"
                        params={{ oppId: String(o.id) }}
                        className="hover:underline"
                      >
                        {o.title ?? "—"}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-muted">{o.Organization?.name ?? "—"}</td>
                    <td className="py-3 px-4 text-muted">{o.Channel?.name ?? "—"}</td>
                    <td className="py-3 px-4">
                      {o.stage ? (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${stageColor[stageKey] ?? "bg-ink/[0.06] text-ink/70"}`}>
                          {o.stage}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted">
                      {o.expected_value ? currency(Number(o.expected_value)) : "—"}
                    </td>
                    <td className="py-3 px-4 text-muted">{o.probability != null ? `${o.probability}%` : "—"}</td>
                    <td className="py-3 px-4 text-muted">{o.expected_close_date ?? "—"}</td>
                    <td className="py-2 px-2">
                      <RowActions
                        name={o.title ?? "opportunity"}
                        onEdit={() => d.openEdit(o)}
                        onDelete={() => del.mutate(o.id)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <RecordDialog
        title={d.editing ? "Edit opportunity" : "New opportunity"}
        open={d.open}
        onOpenChange={d.setOpen}
        onSubmit={handleSubmit}
        submitting={upsert.isPending}
      >
        <Field label="Title" name="title" defaultValue={d.editing?.title ?? ""} required />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="stage">Stage</Label>
            <select
              id="stage"
              name="stage"
              defaultValue={d.editing?.stage ?? "discovery"}
              className="w-full h-9 px-3 rounded-md border border-border bg-surface text-sm capitalize"
            >
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <Field label="Status" name="status" defaultValue={d.editing?.status ?? ""} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Expected value"
            name="expected_value"
            type="number"
            defaultValue={d.editing?.expected_value?.toString() ?? ""}
          />
          <Field
            label="Probability (%)"
            name="probability"
            type="number"
            defaultValue={d.editing?.probability?.toString() ?? ""}
          />
        </div>
        <Field
          label="Expected close"
          name="expected_close_date"
          type="date"
          defaultValue={d.editing?.expected_close_date ?? ""}
        />
        <div className="space-y-1.5">
          <Label htmlFor="org_id">Organization</Label>
          <select
            id="org_id"
            name="org_id"
            defaultValue={d.editing?.org_id ?? ""}
            className="w-full h-9 px-3 rounded-md border border-border bg-surface text-sm"
          >
            <option value="">— None —</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name ?? `#${o.id}`}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="source_channel_id">Channel</Label>
          <select
            id="source_channel_id"
            name="source_channel_id"
            defaultValue={d.editing?.source_channel_id ?? ""}
            className="w-full h-9 px-3 rounded-md border border-border bg-surface text-sm"
          >
            <option value="">— None —</option>
            {channels.map((c) => <option key={c.id} value={c.id}>{c.name ?? `#${c.id}`}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" defaultValue={d.editing?.notes ?? ""} rows={3} />
        </div>
      </RecordDialog>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="py-3 px-4 font-medium text-muted text-[11px] uppercase tracking-wider">{children}</th>;
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}{required && " *"}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} required={required} />
    </div>
  );
}
