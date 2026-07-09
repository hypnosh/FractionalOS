import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { contactsQuery, organizationsQuery } from "@/lib/queries";
import { PageHeader, NewButton, RecordDialog, RowActions, EmptyState, useDialogState } from "@/components/crud";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Contact } from "@/lib/db-types";

type ContactRow = Contact & { Organization: { name: string | null } | null };

export const Route = createFileRoute("/_authenticated/contacts")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(contactsQuery);
    context.queryClient.ensureQueryData(organizationsQuery);
  },
  component: ContactsPage,
});

function ContactsPage() {
  const { data: contacts } = useSuspenseQuery(contactsQuery) as { data: ContactRow[] };
  const { data: orgs } = useSuspenseQuery(organizationsQuery);
  const qc = useQueryClient();
  const d = useDialogState<ContactRow>();

  const upsert = useMutation({
    mutationFn: async (payload: Partial<Contact>) => {
      if (d.editing) {
        const { error } = await supabase.from("Contact").update(payload).eq("id", d.editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("Contact").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
      d.close();
      toast.success(d.editing ? "Contact updated" : "Contact created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("Contact").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
      toast.success("Contact deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const org = String(fd.get("org_id") ?? "");
    upsert.mutate({
      name: String(fd.get("name") ?? "").trim() || null,
      designation: (fd.get("designation") as string) || null,
      email: (fd.get("email") as string) || null,
      phone: (fd.get("phone") as string) || null,
      linkedin_url: (fd.get("linkedin_url") as string) || null,
      org_id: org ? Number(org) : null,
      notes: (fd.get("notes") as string) || null,
    });
  };

  return (
    <div>
      <PageHeader
        title="Contacts"
        subtitle="People across your portfolio."
        action={<NewButton onClick={d.openNew} />}
      />

      {contacts.length === 0 ? (
        <EmptyState message="No contacts yet." onCreate={d.openNew} />
      ) : (
        <div className="bg-surface ring-1 ring-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink/[0.02] border-b border-border text-left">
              <tr>
                <Th>Name</Th>
                <Th>Designation</Th>
                <Th>Organization</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-ink/[0.015]">
                  <td className="py-3 px-4 font-medium">{c.name ?? "—"}</td>
                  <td className="py-3 px-4 text-muted">{c.designation ?? "—"}</td>
                  <td className="py-3 px-4 text-muted">{c.Organization?.name ?? "—"}</td>
                  <td className="py-3 px-4 text-muted">{c.email ?? "—"}</td>
                  <td className="py-3 px-4 text-muted">{c.phone ?? "—"}</td>
                  <td className="py-2 px-2">
                    <RowActions
                      name={c.name ?? "contact"}
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
        title={d.editing ? "Edit contact" : "New contact"}
        open={d.open}
        onOpenChange={d.setOpen}
        onSubmit={handleSubmit}
        submitting={upsert.isPending}
      >
        <Field label="Name" name="name" defaultValue={d.editing?.name ?? ""} required />
        <Field label="Designation" name="designation" defaultValue={d.editing?.designation ?? ""} />
        <div className="space-y-1.5">
          <Label htmlFor="org_id">Organization</Label>
          <select
            id="org_id"
            name="org_id"
            defaultValue={d.editing?.org_id ?? ""}
            className="w-full h-9 px-3 rounded-md border border-border bg-surface text-sm"
          >
            <option value="">— None —</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name ?? `#${o.id}`}</option>
            ))}
          </select>
        </div>
        <Field label="Email" name="email" type="email" defaultValue={d.editing?.email ?? ""} />
        <Field label="Phone" name="phone" defaultValue={d.editing?.phone ?? ""} />
        <Field label="LinkedIn URL" name="linkedin_url" type="url" defaultValue={d.editing?.linkedin_url ?? ""} />
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
