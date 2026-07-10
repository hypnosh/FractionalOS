import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { channelsQuery } from "@/lib/queries";
import { PageHeader, NewButton, RecordDialog, RowActions, EmptyState, useDialogState } from "@/components/crud";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Channel } from "@/lib/db-types";
import { assertUpdatedRows } from "@/lib/mutation-guards";

export const Route = createFileRoute("/_authenticated/channels")({
  loader: ({ context }) => context.queryClient.ensureQueryData(channelsQuery),
  component: ChannelsPage,
});

function ChannelsPage() {
  const { data: channels } = useSuspenseQuery(channelsQuery);
  const qc = useQueryClient();
  const d = useDialogState<Channel>();

  const upsert = useMutation({
    mutationFn: async (payload: Partial<Channel>) => {
      if (d.editing) {
        const result = await supabase.from("Channel").update(payload).eq("id", d.editing.id).select("id");
        assertUpdatedRows(result, "Channel");
      } else {
        const { error } = await supabase.from("Channel").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channels"] });
      d.close();
      toast.success(d.editing ? "Channel updated" : "Channel created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("Channel").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channels"] });
      toast.success("Channel deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    upsert.mutate({
      name: String(fd.get("name") ?? "").trim() || null,
      type: (fd.get("type") as string) || null,
      notes: (fd.get("notes") as string) || null,
    });
  };

  return (
    <div>
      <PageHeader
        title="Channels"
        subtitle="Sources of your opportunities and referrals."
        action={<NewButton onClick={d.openNew} />}
      />

      {channels.length === 0 ? (
        <EmptyState message="No channels yet." onCreate={d.openNew} />
      ) : (
        <div className="bg-surface ring-1 ring-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink/[0.02] border-b border-border text-left">
              <tr>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>Notes</Th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {channels.map((c) => (
                <tr key={c.id} className="hover:bg-ink/[0.015]">
                  <td className="py-3 px-4 font-medium">
                    <Link
                      to="/channels/$channelId"
                      params={{ channelId: String(c.id) }}
                      className="hover:underline"
                    >
                      {c.name ?? "—"}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-muted">{c.type ?? "—"}</td>
                  <td className="py-3 px-4 text-muted truncate max-w-[320px]">{c.notes ?? "—"}</td>
                  <td className="py-2 px-2">
                    <RowActions
                      name={c.name ?? "channel"}
                      onEdit={() => d.openEdit(c)}
                      onDelete={() => del.mutate(c.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RecordDialog
        title={d.editing ? "Edit channel" : "New channel"}
        open={d.open}
        onOpenChange={d.setOpen}
        onSubmit={handleSubmit}
        submitting={upsert.isPending}
      >
        <Field label="Name" name="name" defaultValue={d.editing?.name ?? ""} required />
        <Field label="Type" name="type" defaultValue={d.editing?.type ?? ""} />
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
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}{required && " *"}</Label>
      <Input id={name} name={name} defaultValue={defaultValue} required={required} />
    </div>
  );
}
