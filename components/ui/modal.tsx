"use client";

import { type ReactNode, useEffect, useId, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useDialogFocus } from "@/lib/ui/use-dialog-focus";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function Modal({ open, onClose, title, description, children, className }: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
  const dialogRef = useDialogFocus(open && mounted, onClose);

  useEffect(() => {
    if (!open) {
      return;
    }

    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descriptionId : undefined}
      aria-label={title ? undefined : "Dialog"}
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[var(--color-scrim)] backdrop-blur-sm"
      />
      <div
        role="document"
        className={cn(
          "ambient-panel relative max-h-[calc(100dvh-2rem)] w-full max-w-[560px] overflow-y-auto overscroll-contain rounded-[32px] bg-[var(--color-surface)] p-6 shadow-[0_32px_80px_rgba(15,18,21,0.28)]",
          className
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title ? (
              <h2 id={titleId} className="font-heading text-2xl font-semibold tracking-[-0.04em]">{title}</h2>
            ) : null}
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-[var(--color-text-soft)]">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-low)] text-[var(--color-text-soft)] hover:text-[var(--color-text)]"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
