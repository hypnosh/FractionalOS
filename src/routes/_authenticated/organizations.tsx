import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { organizationsQuery } from "@/lib/queries";
import { PageHeader, NewButton, RecordDialog, RowActions, EmptyState, useDialogState } from "@/components/crud";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Organization } from "@/lib/db-types";

export const Route = createFileRoute("/_authenticated/organizations")({
  loader: ({ context }) => context.queryClient.ensureQueryData(organizationsQuery),
  component: OrganizationsPage,
});

function OrganizationsPage() {
  const { data: orgs } = useSuspenseQuery(organizationsQuery);
  const qc = useQueryClient();
  const d = useDialogState<Organization>();

  const upsert = useMutation({
    mutationFn: async (payload: Partial<Organization>) => {
      if (d.editing) {
        const { error } = await supabase.from("Organization").update(payload).eq("id", d.editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("Organization").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["organizations"] });
      qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
      d.close();
      toast.success(d.editing ? "Organization updated" : "Organization created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("Organization").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["organizations"] });
      qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
      toast.success("Organization deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    upsert.mutate({
      name: String(fd.get("name") ?? "").trim() || null,
      industry: (fd.get("industry") as string) || null,
      website: (fd.get("website") as string) || null,
      notes: (fd.get("notes") as string) || null,
    });
  };

  return (
    <div>
      <PageHeader
        title="Organizations"
        subtitle="Clients and prospects you're working with."
        action={<NewButton onClick={d.openNew} />}
      />

      {orgs.length === 0 ? (
        <EmptyState message="No organizations yet." onCreate={d.openNew} />
      ) : (
        <div className="bg-surface ring-1 ring-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink/[0.02] border-b border-border text-left">
              <tr>
                <Th>Name</Th>
                <Th>Industry</Th>
                <Th>Website</Th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orgs.map((o) => (
                <tr key={o.id} className="hover:bg-ink/[0.015]">
                  <td className="py-3 px-4 font-medium">{o.name ?? "—"}</td>
                  <td className="py-3 px-4 text-muted">{o.industry ?? "—"}</td>
                  <td className="py-3 px-4 text-muted truncate max-w-[240px]">
                    {o.website ? (
                      <a href={o.website} target="_blank" rel="noreferrer" className="hover:text-ink">
                        {o.website}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2 px-2">
                    <RowActions
                      name={o.name ?? "organization"}
                      onEdit={() => d.openEdit(o)}
                      onDelete={() => del.mutate(o.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RecordDialog
        title={d.editing ? "Edit organization" : "New organization"}
        open={d.open}
        onOpenChange={d.setOpen}
        onSubmit={handleSubmit}
        submitting={upsert.isPending}
      >
        <Field label="Name" name="name" defaultValue={d.editing?.name ?? ""} required />
        <Field label="Industry" name="industry" defaultValue={d.editing?.industry ?? ""} />
        <Field label="Website" name="website" type="url" defaultValue={d.editing?.website ?? ""} />
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
