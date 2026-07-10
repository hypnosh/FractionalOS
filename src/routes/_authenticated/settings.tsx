import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/crud";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  return (
    <div>
      <PageHeader title="Settings" subtitle="Workspace preferences and account details." />

      <div className="bg-surface ring-1 ring-border rounded-xl p-6 space-y-4">
        <Row label="Signed in as" value={email ?? "—"} />
        <Row label="Workspace" value="FractionalOS" />
        <p className="text-xs text-muted pt-2">
          Additional workspace settings will appear here as the product matures.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-1 sm:gap-4">
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}
