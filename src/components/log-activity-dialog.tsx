import { useMemo, useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import {
  activityMastersQuery,
  ENTITY_FK,
  type EntityType,
} from "@/lib/queries";
import type { ActivityMaster } from "@/lib/db-types";
import { assertUpdatedRows } from "@/lib/mutation-guards";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entityType: EntityType;
  parentId: number;
  /** Also refetch keys we've invalidated after save. */
  extraInvalidateKeys?: readonly (readonly unknown[])[];
};

function nowLocalDatetime() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LogActivityDialog({ open, onOpenChange, entityType, parentId, extraInvalidateKeys }: Props) {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(activityMastersQuery);

  const options = useMemo(() => {
    const allowedIds = new Set(
      data.mappings.filter((m) => m.entity_type === entityType).map((m) => m.activity_master_id),
    );
    return data.masters
      .filter((m) => allowedIds.has(m.id))
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }, [data, entityType]);

  const [selectedId, setSelectedId] = useState<string>("");
  const selected = options.find((o) => o.id === (selectedId || options[0]?.id)) as
    | ActivityMaster
    | undefined;

  const [applyStage, setApplyStage] = useState(true);

  const save = useMutation({
    mutationFn: async (payload: {
      master: ActivityMaster;
      when: string;
      summary: string;
      details: string;
      applyStage: boolean;
    }) => {
      const row: Record<string, unknown> = {
        activity_master_id: payload.master.id,
        activity_date: new Date(payload.when).toISOString(),
        summary: payload.summary.trim() || null,
        details: payload.details.trim() || null,
      };
      row[ENTITY_FK[entityType]] = parentId;
      const { error } = await supabase.from("Activity").insert(row as never);
      if (error) throw error;

      if (
        payload.applyStage &&
        payload.master.changes_stage &&
        payload.master.target_stage &&
        entityType === "Opportunity"
      ) {
        const result = await supabase
          .from("Opportunity")
          .update({ stage: payload.master.target_stage })
          .eq("id", parentId)
          .select("id");
        assertUpdatedRows(result, "Opportunity stage");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities", entityType, parentId] });
      qc.invalidateQueries({ queryKey: ["timeline", "global"] });
      if (entityType === "Opportunity") {
        qc.invalidateQueries({ queryKey: ["opportunity", parentId] });
        qc.invalidateQueries({ queryKey: ["opportunities"] });
      }
      for (const key of extraInvalidateKeys ?? []) qc.invalidateQueries({ queryKey: key });
      toast.success("Activity logged");
      onOpenChange(false);
      setSelectedId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected) {
      toast.error("Pick an activity type");
      return;
    }
    const fd = new FormData(e.currentTarget);
    save.mutate({
      master: selected,
      when: String(fd.get("when") ?? ""),
      summary: String(fd.get("summary") ?? ""),
      details: String(fd.get("details") ?? ""),
      applyStage,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log activity</DialogTitle>
        </DialogHeader>
        {options.length === 0 ? (
          <p className="text-sm text-muted py-4">
            No activity types configured for {entityType}. Seed{" "}
            <code className="text-xs">ActivityMaster</code> first.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="master">Type *</Label>
                <select
                  id="master"
                  name="master"
                  value={selectedId || options[0].id}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-border bg-surface text-sm"
                >
                  {options.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="when">When *</Label>
                <Input
                  id="when"
                  name="when"
                  type="datetime-local"
                  defaultValue={nowLocalDatetime()}
                  required
                />
              </div>
            </div>

            {selected?.changes_stage && selected.target_stage && entityType === "Opportunity" && (
              <label className="flex items-start gap-2 text-xs text-muted bg-ink/[0.03] p-2.5 rounded-md ring-1 ring-border">
                <input
                  type="checkbox"
                  checked={applyStage}
                  onChange={(e) => setApplyStage(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Also move Opportunity stage to{" "}
                  <span className="font-medium text-ink">{selected.target_stage}</span>
                </span>
              </label>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="summary">Title (optional)</Label>
              <Input id="summary" name="summary" placeholder="Short summary" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="details">Notes</Label>
              <Textarea id="details" name="details" rows={4} placeholder="Details, quotes, next steps…" />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={save.isPending}
                className="bg-ink text-canvas hover:bg-ink/90"
              >
                {save.isPending ? "Saving…" : "Log activity"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
