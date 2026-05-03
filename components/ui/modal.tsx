"use client";

import { type ReactNode, useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function Modal({ open, onClose, title, description, children, className }: ModalProps) {
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKey);
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
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
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[var(--color-scrim)] backdrop-blur-sm"
      />
      <div
        role="document"
        className={cn(
          "ambient-panel relative w-full max-w-[560px] rounded-[32px] bg-[var(--color-surface)] p-6 shadow-[0_32px_80px_rgba(15,18,21,0.28)]",
          className
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title ? (
              <h2 className="font-heading text-2xl font-semibold tracking-[-0.04em]">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm text-[var(--color-text-soft)]">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
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
