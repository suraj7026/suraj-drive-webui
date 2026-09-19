"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";

type NewFolderDialogProps = {
  open: boolean;
  parentLabel: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void> | void;
};

export function NewFolderDialog({ open, parentLabel, onClose, onSubmit }: NewFolderDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Folder name is required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to create folder.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New folder"
      description={`Created inside ${parentLabel}.`}
      className="max-w-[460px]"
    >
      <form onSubmit={handleSubmit} className="grid gap-4">
        <label className="grid gap-2">
          <span className="text-xs uppercase tracking-[0.24em] text-[var(--color-text-soft)]">Name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Travel notes"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            className="w-full rounded-full bg-[var(--color-surface-low)] px-4 py-3 text-sm shadow-[inset_0_0_0_1px_var(--color-outline)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
          />
        </label>

        {error ? <p className="text-sm text-[var(--color-danger-text)]">{error}</p> : null}

        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-full bg-[var(--color-surface-low)] px-4 py-3 text-sm font-medium text-[var(--color-text)] shadow-[inset_0_0_0_1px_var(--color-outline)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="primary-gradient rounded-full px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Creating..." : "Create folder"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
