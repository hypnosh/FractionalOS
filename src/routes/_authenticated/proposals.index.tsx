import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { opportunitiesMinimalQuery, proposalsQuery } from "@/lib/queries";
import {
  PageHeader,
  NewButton,
  RecordDialog,
  RowActions,
  EmptyState,
  useDialogState,
} from "@/components/crud";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Proposal } from "@/lib/db-types";
import { assertUpdatedRows } from "@/lib/mutation-guards";

type ProposalWithOpp = Proposal & {
  Opportunity: { id: number; title: string | null; Organization: { name: string | null } | null } | null;
};

const STATUSES = ["draft", "sent", "accepted", "rejected", "expired"] as const;

export const Route = createFileRoute("/_authenticated/proposals/")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(proposalsQuery);
    context.queryClient.ensureQueryData(opportunitiesMinimalQuery);
  },
  component: ProposalsPage,
});

function ProposalsPage() {
  const { data: proposals } = useSuspenseQuery(proposalsQuery) as { data: ProposalWithOpp[] };
  const { data: opps } = useSuspenseQuery(opportunitiesMinimalQuery) as {
    data: Array<{ id: number; title: string | null }>;
  };
  const qc = useQueryClient();
  const d = useDialogState<ProposalWithOpp>();

  const upsert = useMutation({
    mutationFn: async (payload: Partial<Proposal>) => {
      if (d.editing) {
        const result = await supabase.from("Proposal").update(payload).eq("id", d.editing.id).select("id");
        assertUpdatedRows(result, "Proposal");
      } else {
        const { error } = await supabase.from("Proposal").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposals"] });
      qc.invalidateQueries({ queryKey: ["timeline", "global"] });
      d.close();
      toast.success(d.editing ? "Proposal updated" : "Proposal created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("Proposal").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposals"] });
      qc.invalidateQueries({ queryKey: ["timeline", "global"] });
      toast.success("Proposal deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const oppRaw = String(fd.get("opp_id") ?? "");
    const opp_id = oppRaw ? Number(oppRaw) : null;
    const amount = fd.get("proposed_amount")
      ? Number(fd.get("proposed_amount"))
      : null;
    upsert.mutate({
      title: String(fd.get("title") ?? "").trim() || null,
      opp_id,
      status: (fd.get("status") as string) || "draft",
      proposed_amount: amount,
      currency: (fd.get("currency") as string) || "INR",
      sent_date: (fd.get("sent_date") as string) || null,
      valid_until: (fd.get("valid_until") as string) || null,
      notes: (fd.get("notes") as string) || null,
    });
  };

  return (
    <div>
      <PageHeader
        title="Proposals"
        subtitle="Proposals for open opportunities."
        action={<NewButton onClick={d.openNew} />}
      />

      {proposals.length === 0 ? (
        <EmptyState message="No proposals yet." onCreate={d.openNew} />
      ) : (
        <div className="bg-surface ring-1 ring-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted bg-ink/[0.02]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">Opportunity</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                <th className="px-4 py-2.5 font-medium">Sent</th>
                <th className="px-4 py-2.5 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-ink/[0.015]">
                  <td className="px-4 py-2.5">
                    <Link to="/proposals/$proposalId" params={{ proposalId: String(p.id) }} className="font-medium hover:underline">
                      {p.title ?? "Untitled"}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted">
                    {p.Opportunity ? (
                      <Link to="/opportunities/$oppId" params={{ oppId: String(p.Opportunity.id) }} className="hover:underline">
                        {p.Opportunity.title ?? "—"}
                      </Link>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-ink/[0.06] text-ink/70 capitalize">
                      {p.status ?? "draft"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {p.proposed_amount != null
                      ? `${p.currency ?? "INR"} ${Number(p.proposed_amount).toLocaleString("en-IN")}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted">{p.sent_date ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <RowActions
                      name="proposal"
                      onEdit={() => d.openEdit(p)}
                      onDelete={() => del.mutate(p.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RecordDialog
        title={d.editing ? "Edit proposal" : "New proposal"}
        open={d.open}
        onOpenChange={d.setOpen}
        onSubmit={handleSubmit}
        submitting={upsert.isPending}
        submitLabel={d.editing ? "Save" : "Create"}
      >
        <div className="space-y-1.5">
          <Label htmlFor="title">Title *</Label>
          <Input id="title" name="title" required defaultValue={d.editing?.title ?? ""} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="opp_id">Opportunity</Label>
            <select
              id="opp_id"
              name="opp_id"
              defaultValue={d.editing?.opp_id != null ? String(d.editing.opp_id) : ""}
              className="w-full h-9 px-3 rounded-md border border-border bg-surface text-sm"
            >
              <option value="">—</option>
              {opps.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title ?? `Opp ${o.id}`}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              defaultValue={d.editing?.status ?? "draft"}
              className="w-full h-9 px-3 rounded-md border border-border bg-surface text-sm capitalize"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="proposed_amount">Amount</Label>
            <Input
              id="proposed_amount"
              name="proposed_amount"
              type="number"
              step="0.01"
              defaultValue={d.editing?.proposed_amount ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currency">Currency</Label>
            <Input id="currency" name="currency" defaultValue={d.editing?.currency ?? "INR"} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sent_date">Sent date</Label>
            <Input id="sent_date" name="sent_date" type="date" defaultValue={d.editing?.sent_date ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="valid_until">Valid until</Label>
            <Input id="valid_until" name="valid_until" type="date" defaultValue={d.editing?.valid_until ?? ""} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" rows={3} defaultValue={d.editing?.notes ?? ""} />
        </div>
      </RecordDialog>
    </div>
  );
}
