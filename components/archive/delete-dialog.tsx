"use client";

import { useEffect, useState } from "react";
import { Trash2, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { formatBytes } from "@/lib/utils/format";
import type { FileItem } from "@/lib/models/archive";

type DeleteDialogProps = {
  open: boolean;
  item: FileItem | null;
  onClose: () => void;
  onConfirm: (item: FileItem) => Promise<void> | void;
};

export function DeleteDialog({ open, item, onClose, onConfirm }: DeleteDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  async function handleConfirm() {
    if (!item) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(item);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to delete item.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting) {
      return;
    }
    onClose();
  }

  const isFolder = item?.kind === "folder";
  const targetLabel = isFolder ? "folder" : "file";

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isFolder ? "Delete folder" : "Delete file"}
      description={`This action permanently removes the ${targetLabel} from your archive. It cannot be undone.`}
      className="max-w-[460px]"
    >
      <div className="grid gap-4">
        {item ? (
          <div className="flex items-start gap-3 rounded-[18px] bg-[var(--color-surface-strong)] px-4 py-3 shadow-[inset_0_0_0_1px_var(--color-outline)]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-red-100 text-red-600">
              <Trash2 size={18} />
            </div>
            <div className="min-w-0">
              <p className="break-all text-sm font-medium text-[var(--color-text)]">{item.name}</p>
              <p className="mt-0.5 text-xs text-[var(--color-text-soft)]">
                {isFolder
                  ? "Folder and everything inside it will be deleted."
                  : `${item.sizeBytes ? formatBytes(item.sizeBytes) : "Unknown size"} \u00b7 ${item.owner}`}
              </p>
            </div>
          </div>
        ) : null}

        {isFolder ? (
          <div className="flex items-start gap-2 rounded-[14px] bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            <TriangleAlert size={14} className="mt-0.5 shrink-0" />
            <span>All files and subfolders inside this folder will also be deleted.</span>
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="rounded-full bg-[var(--color-surface-low)] px-4 py-3 text-sm font-medium text-[var(--color-text)] shadow-[inset_0_0_0_1px_var(--color-outline)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={submitting || !item}
            className="rounded-full bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(220,38,38,0.28)] hover:bg-red-700 disabled:opacity-60"
          >
            {submitting ? "Deleting..." : isFolder ? "Delete folder" : "Delete file"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
