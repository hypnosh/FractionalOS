import { createFileRoute, Link, useRouter, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { activitiesForEntityQuery, activityMastersQuery, channelQuery } from "@/lib/queries";
import { EntityTimeline } from "@/components/entity-timeline";

export const Route = createFileRoute("/_authenticated/channels/$channelId")({
  loader: ({ context, params }) => {
    const id = Number(params.channelId);
    if (!Number.isFinite(id)) throw notFound();
    context.queryClient.ensureQueryData(channelQuery(id));
    context.queryClient.ensureQueryData(activitiesForEntityQuery("Channel", id));
    context.queryClient.ensureQueryData(activityMastersQuery);
  },
  component: ChannelDetail,
  errorComponent: ({ error, reset }) => <ChannelError error={error} reset={reset} />,
  notFoundComponent: () => (
    <div className="max-w-lg mx-auto text-center py-16">
      <h1 className="text-xl font-semibold">Channel not found</h1>
      <p className="text-sm text-muted mt-1">This channel may have been deleted.</p>
      <Link to="/channels" className="text-sm text-ink underline mt-4 inline-block">
        Back to channels
      </Link>
    </div>
  ),
});

function ChannelError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="max-w-lg mx-auto text-center py-16">
      <h1 className="text-xl font-semibold">Couldn't load channel</h1>
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
}

function ChannelDetail() {
  const { channelId } = Route.useParams();
  const id = Number(channelId);
  const { data: channel } = useSuspenseQuery(channelQuery(id));

  return (
    <div className="space-y-6">
      <Link to="/channels" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-3.5" />
        Channels
      </Link>
      <header>
        <h1 className="text-2xl font-medium tracking-tight">{channel.name ?? "—"}</h1>
        <p className="text-sm text-muted mt-1">{channel.type ?? "Uncategorized"}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2">
          <EntityTimeline entityType="Channel" parentId={id} />
        </section>
        <section className="bg-surface ring-1 ring-border rounded-xl p-6 space-y-4 h-fit">
          <Row label="Name" value={channel.name} />
          <Row label="Type" value={channel.type} />
          <Row label="Notes" value={channel.notes} multiline />
          <Row label="Created" value={new Date(channel.created_at).toLocaleString()} />
        </section>
      </div>
    </div>
  );
}

function Row({ label, value, multiline }: { label: string; value: string | null; multiline?: boolean }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-1 sm:gap-4">
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className={multiline ? "text-sm whitespace-pre-wrap" : "text-sm"}>{value ?? "—"}</div>
    </div>
  );
}
