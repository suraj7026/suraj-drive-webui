"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import type { FileItem } from "@/lib/models/archive";

export function PermanentDeleteDialog({ item, onClose, onConfirm }: { item?: FileItem; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = item ? `“${item.name}”` : "all items in Trash";

  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to queue permanent deletion.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Delete forever?" description={`${label} will be permanently deleted. This cannot be undone.`} className="max-w-[480px]">
      <div className="flex gap-3 rounded-[20px] bg-[var(--color-danger-soft)] px-4 py-4 text-sm text-[var(--color-danger-text)]">
        <TriangleAlert size={18} className="shrink-0" />
        <span>For safety, permanent deletion requires a Google sign-in from the last 15 minutes.</span>
      </div>
      {error ? <p className="mt-3 text-sm text-[var(--color-danger-text)]">{error}</p> : null}
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={submitting} className="rounded-full bg-[var(--color-surface-low)] px-4 py-3 text-sm font-medium disabled:opacity-50">Cancel</button>
        <button type="button" onClick={() => void confirm()} disabled={submitting} className="rounded-full bg-[var(--color-danger)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Queuing..." : "Delete forever"}</button>
      </div>
    </Modal>
  );
}
