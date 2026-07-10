import { createFileRoute, Link, useRouter, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { activitiesForEntityQuery, activityMastersQuery, invoiceQuery } from "@/lib/queries";
import { EntityTimeline } from "@/components/entity-timeline";

export const Route = createFileRoute("/_authenticated/invoices/$invoiceId")({
  loader: ({ context, params }) => {
    const id = Number(params.invoiceId);
    if (!Number.isFinite(id)) throw notFound();
    context.queryClient.ensureQueryData(invoiceQuery(id));
    context.queryClient.ensureQueryData(activitiesForEntityQuery("Invoice", id));
    context.queryClient.ensureQueryData(activityMastersQuery);
  },
  component: InvoiceDetail,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <h1 className="text-xl font-semibold">Couldn't load invoice</h1>
        <p className="text-sm text-muted mt-1">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-4 px-3 py-1.5 rounded-md bg-ink text-canvas text-sm"
        >
          Try again
        </button>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="max-w-lg mx-auto text-center py-16">
      <h1 className="text-xl font-semibold">Invoice not found</h1>
      <Link to="/invoices" className="text-sm text-ink underline mt-4 inline-block">
        Back to invoices
      </Link>
    </div>
  ),
});

const currency = (n: number | null) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

type InvoiceDetailRow = import("@/lib/db-types").Invoice & {
  Engagement: { id: number; title: string | null } | null;
};

function InvoiceDetail() {
  const { invoiceId } = Route.useParams();
  const id = Number(invoiceId);
  const { data: inv } = useSuspenseQuery(invoiceQuery(id)) as { data: InvoiceDetailRow };
  const eng = inv.Engagement;

  return (
    <div className="space-y-6">
      <Link to="/invoices" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-3.5" />
        Invoices
      </Link>
      <header>
        <h1 className="text-2xl font-medium tracking-tight">Invoice #{inv.invoice_no ?? inv.id}</h1>
        <p className="text-sm text-muted mt-1">
          {eng?.title ?? "—"} · {inv.status ?? "no status"}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-6">
          <div className="bg-surface ring-1 ring-border rounded-xl p-6 grid sm:grid-cols-2 gap-4">
            <Row label="Invoice date" value={inv.invoice_date} />
            <Row label="Due date" value={inv.due_date} />
            <Row label="Subtotal" value={currency(inv.subtotal)} />
            <Row label="Tax" value={inv.tax_percent != null ? `${inv.tax_percent}% (${currency(inv.tax_amount)})` : currency(inv.tax_amount)} />
            <Row label="Discount" value={currency(inv.discount)} />
            <Row label="Total" value={currency(inv.total_amount)} />
            <Row label="Amount paid" value={currency(inv.amount_paid)} />
            <Row label="Balance due" value={currency(inv.balance_due)} />
            <Row label="Terms" value={inv.terms} />
            <Row label="Status" value={inv.status} />
          </div>
          {inv.notes && (
            <div className="bg-surface ring-1 ring-border rounded-xl p-6">
              <h2 className="text-sm font-semibold mb-2">Notes</h2>
              <p className="text-sm whitespace-pre-wrap">{inv.notes}</p>
            </div>
          )}
        </section>
        <section>
          <EntityTimeline entityType="Invoice" parentId={id} />
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="text-sm mt-0.5">{value ?? "—"}</div>
    </div>
  );
}
