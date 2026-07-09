import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function RecordDialog({
  title,
  trigger,
  open,
  onOpenChange,
  onSubmit,
  submitting,
  children,
  submitLabel = "Save",
}: {
  title: string;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  submitting?: boolean;
  children: ReactNode;
  submitLabel?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {children}
          <DialogFooter>
            <Button type="submit" disabled={submitting} className="bg-ink text-canvas hover:bg-ink/90">
              {submitting ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewButton({ onClick }: { onClick: () => void }) {
  return (
    <Button onClick={onClick} className="bg-ink text-canvas hover:bg-ink/90">
      <Plus className="size-4" />
      New
    </Button>
  );
}

export function RowActions({ onEdit, onDelete, name }: { onEdit: () => void; onDelete: () => void; name: string }) {
  return (
    <div className="flex items-center gap-1 justify-end">
      <button
        onClick={onEdit}
        className="p-1.5 rounded hover:bg-ink/5 text-muted hover:text-ink"
        aria-label={`Edit ${name}`}
      >
        <Pencil className="size-3.5" />
      </button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            className="p-1.5 rounded hover:bg-ink/5 text-muted hover:text-danger"
            aria-label={`Delete ${name}`}
          >
            <Trash2 className="size-3.5" />
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-danger text-canvas hover:bg-danger/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function EmptyState({ message, onCreate }: { message: string; onCreate: () => void }) {
  return (
    <div className="bg-surface ring-1 ring-border rounded-xl p-10 text-center space-y-3">
      <p className="text-sm text-muted">{message}</p>
      <Button onClick={onCreate} className="bg-ink text-canvas hover:bg-ink/90">
        <Plus className="size-4" />
        Create one
      </Button>
    </div>
  );
}

export function useDialogState<T>() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  return {
    open,
    editing,
    openNew: () => {
      setEditing(null);
      setOpen(true);
    },
    openEdit: (r: T) => {
      setEditing(r);
      setOpen(true);
    },
    close: () => setOpen(false),
    setOpen,
  };
}
