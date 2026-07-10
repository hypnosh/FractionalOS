import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { invoicesQuery } from "@/lib/queries";
import { PageHeader, EmptyState } from "@/components/crud";
import type { Invoice } from "@/lib/db-types";

type InvoiceRow = Invoice & { Engagement: { id: number; title: string | null } | null };

export const Route = createFileRoute("/_authenticated/invoices/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(invoicesQuery),
  component: InvoicesPage,
});

const currency = (n: number | null) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function InvoicesPage() {
  const { data: rows } = useSuspenseQuery(invoicesQuery) as { data: InvoiceRow[] };

  return (
    <div>
      <PageHeader title="Invoices" subtitle="Billing history across your engagements." />

      {rows.length === 0 ? (
        <div className="bg-surface ring-1 ring-border rounded-xl p-10 text-center">
          <p className="text-sm text-muted">No invoices yet. Create invoices from an engagement in a future release.</p>
        </div>
      ) : (
        <div className="bg-surface ring-1 ring-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink/[0.02] border-b border-border text-left">
              <tr>
                <Th>Invoice #</Th>
                <Th>Engagement</Th>
                <Th>Date</Th>
                <Th>Due</Th>
                <Th>Total</Th>
                <Th>Balance</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-ink/[0.015]">
                  <td className="py-3 px-4 font-medium">
                    <Link
                      to="/invoices/$invoiceId"
                      params={{ invoiceId: String(r.id) }}
                      className="hover:underline"
                    >
                      #{r.invoice_no ?? r.id}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-muted">{r.Engagement?.title ?? "—"}</td>
                  <td className="py-3 px-4 text-muted">{r.invoice_date ?? "—"}</td>
                  <td className="py-3 px-4 text-muted">{r.due_date ?? "—"}</td>
                  <td className="py-3 px-4 text-muted">{currency(r.total_amount)}</td>
                  <td className="py-3 px-4 text-muted">{currency(r.balance_due)}</td>
                  <td className="py-3 px-4 text-muted">{r.status ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="py-3 px-4 font-medium text-muted text-[11px] uppercase tracking-wider">{children}</th>;
}

// EmptyState is imported to keep the surface consistent even if unused today.
void EmptyState;
