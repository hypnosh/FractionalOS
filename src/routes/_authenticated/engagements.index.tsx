import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { engagementsQuery, opportunitiesQuery } from "@/lib/queries";
import { PageHeader, NewButton, RecordDialog, RowActions, EmptyState, useDialogState } from "@/components/crud";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Engagement } from "@/lib/db-types";
import { assertUpdatedRows } from "@/lib/mutation-guards";

type EngagementRow = Engagement & {
  Proposal:
    | {
        id: number;
        title: string | null;
        opp_id: number | null;
        Opportunity: { id: number; title: string | null; Organization: { name: string | null } | null } | null;
      }
    | null;
};

export const Route = createFileRoute("/_authenticated/engagements/")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(engagementsQuery);
    context.queryClient.ensureQueryData(opportunitiesQuery);
  },
  component: EngagementsPage,
});

const currency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function EngagementsPage() {
  const { data: rows } = useSuspenseQuery(engagementsQuery) as { data: EngagementRow[] };
  const { data: opps } = useSuspenseQuery(opportunitiesQuery) as { data: import("@/lib/db-types").Opportunity[] };

  const qc = useQueryClient();
  const d = useDialogState<EngagementRow>();

  const upsert = useMutation({
    mutationFn: async (payload: Partial<Engagement>) => {
      if (d.editing) {
        const result = await supabase.from("Engagement").update(payload).eq("id", d.editing.id).select("id");
        assertUpdatedRows(result, "Engagement");
      } else {
        const { error } = await supabase.from("Engagement").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["engagements"] });
      d.close();
      toast.success(d.editing ? "Engagement updated" : "Engagement created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("Engagement").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["engagements"] });
      toast.success("Engagement deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const value = String(fd.get("actual_value") ?? "");
    const proposal = String(fd.get("proposal_id") ?? "");
    upsert.mutate({
      title: String(fd.get("title") ?? "").trim() || null,
      status: (fd.get("status") as string) || null,
      delivery_status: (fd.get("delivery_status") as string) || null,
      start_date: (fd.get("start_date") as string) || null,
      expected_end_date: (fd.get("expected_end_date") as string) || null,
      actual_end_date: (fd.get("actual_end_date") as string) || null,
      actual_value: value ? Number(value) : null,
      proposal_id: proposal ? Number(proposal) : null,
      notes: (fd.get("notes") as string) || null,
    });
  };

  return (
    <div>
      <PageHeader
        title="Engagements"
        subtitle="Active delivery work for won opportunities."
        action={<NewButton onClick={d.openNew} />}
      />

      {rows.length === 0 ? (
        <EmptyState message="No engagements yet." onCreate={d.openNew} />
      ) : (
        <div className="bg-surface ring-1 ring-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink/[0.02] border-b border-border text-left">
              <tr>
                <Th>Title</Th>
                <Th>Client</Th>
                <Th>Status</Th>
                <Th>Delivery</Th>
                <Th>Start</Th>
                <Th>Value</Th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-ink/[0.015]">
                  <td className="py-3 px-4 font-medium">
                    <Link
                      to="/engagements/$engagementId"
                      params={{ engagementId: String(r.id) }}
                      className="hover:underline"
                    >
                      {r.title ?? "—"}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-muted">{r.Proposal?.Opportunity?.Organization?.name ?? "—"}</td>
                  <td className="py-3 px-4 text-muted">{r.status ?? "—"}</td>
                  <td className="py-3 px-4 text-muted">{r.delivery_status ?? "—"}</td>
                  <td className="py-3 px-4 text-muted">{r.start_date ?? "—"}</td>
                  <td className="py-3 px-4 text-muted">
                    {r.actual_value ? currency(Number(r.actual_value)) : "—"}
                  </td>
                  <td className="py-2 px-2">
                    <RowActions
                      name={r.title ?? "engagement"}
                      onEdit={() => d.openEdit(r)}
                      onDelete={() => del.mutate(r.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RecordDialog
        title={d.editing ? "Edit engagement" : "New engagement"}
        open={d.open}
        onOpenChange={d.setOpen}
        onSubmit={handleSubmit}
        submitting={upsert.isPending}
      >
        <Field label="Title" name="title" defaultValue={d.editing?.title ?? ""} required />
        <div className="space-y-1.5">
          <Label htmlFor="proposal_id">Proposal</Label>
          <select
            id="proposal_id"
            name="proposal_id"
            defaultValue={d.editing?.proposal_id ?? ""}
            className="w-full h-9 px-3 rounded-md border border-border bg-surface text-sm"
          >
            <option value="">— None —</option>
            {opps.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title ?? `#${o.id}`}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted">Proposals module is not wired yet; leave blank for now.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status" name="status" defaultValue={d.editing?.status ?? ""} />
          <Field label="Delivery status" name="delivery_status" defaultValue={d.editing?.delivery_status ?? ""} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date" name="start_date" type="date" defaultValue={d.editing?.start_date ?? ""} />
          <Field
            label="Expected end"
            name="expected_end_date"
            type="date"
            defaultValue={d.editing?.expected_end_date ?? ""}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Actual end"
            name="actual_end_date"
            type="date"
            defaultValue={d.editing?.actual_end_date ?? ""}
          />
          <Field
            label="Actual value"
            name="actual_value"
            type="number"
            defaultValue={d.editing?.actual_value?.toString() ?? ""}
          />
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
