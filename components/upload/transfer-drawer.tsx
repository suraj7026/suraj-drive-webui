"use client";

import { useMemo, useState } from "react";
import { ChevronDown, CloudUpload, Pause, Play, TriangleAlert, X } from "lucide-react";
import type { TransferItem } from "@/lib/models/transfers";
import { formatBytes } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

type TransferDrawerProps = {
  transfers: TransferItem[];
  onToggleStatus?: (transferId: string) => void;
  onRemove?: (transferId: string) => void;
};

export function TransferDrawer({ transfers, onToggleStatus, onRemove }: TransferDrawerProps) {
  const [open, setOpen] = useState(true);

  const summary = useMemo(() => {
    const done = transfers.filter((transfer) => transfer.status === "done").length;
    return { done, total: transfers.length };
  }, [transfers]);

  if (transfers.length === 0) {
    return null;
  }

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-[24px] bg-[var(--color-surface-high)] shadow-[0_12px_32px_rgba(26,28,25,0.05)]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-strong)] text-[var(--color-primary)]">
            <CloudUpload size={16} />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] uppercase tracking-[0.28em] text-[var(--color-text-soft)]">
              Transfers
            </span>
            <span className="font-heading mt-0.5 block truncate text-sm font-semibold tracking-[-0.02em]">
              {summary.done} of {summary.total} uploaded
            </span>
          </span>
        </span>
        <ChevronDown
          size={16}
          className={cn(
            "shrink-0 text-[var(--color-text-soft)] transition-transform",
            open ? "rotate-180" : "rotate-0"
          )}
        />
      </button>

      {open ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2 px-3 pb-3">
          {transfers.slice(0, 3).map((transfer) => {
            const percent = transfer.totalBytes > 0
              ? Math.min(100, Math.round((transfer.transferredBytes / transfer.totalBytes) * 100))
              : 0;

            return (
              <div
                key={transfer.id}
                className="min-w-0 rounded-[18px] bg-[var(--color-surface-strong)] px-3 py-3 shadow-[0_8px_22px_rgba(26,28,25,0.04)]"
              >
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{transfer.fileName}</p>
                    <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-soft)]">{transfer.statusLabel}</p>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <button
                      type="button"
                      aria-label={transfer.status === "paused" ? "Resume transfer" : "Pause transfer"}
                      disabled={!onToggleStatus || transfer.status === "done" || transfer.status === "error"}
                      onClick={() => onToggleStatus?.(transfer.id)}
                      className="rounded-full p-1.5 text-[var(--color-text-soft)] hover:bg-[var(--color-surface-low)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {transfer.status === "paused" ? <Play size={12} /> : <Pause size={12} />}
                    </button>
                    <button
                      type="button"
                      aria-label="Dismiss transfer"
                      disabled={!onRemove}
                      onClick={() => onRemove?.(transfer.id)}
                      className="rounded-full p-1.5 text-[var(--color-text-soft)] hover:bg-[var(--color-surface-low)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>

                {transfer.status === "error" ? (
                  <div className="mt-3 flex items-start gap-2 rounded-[12px] bg-[var(--color-danger-soft)] px-2.5 py-2 text-[11px] text-[var(--color-danger-text)]">
                    <TriangleAlert size={12} className="mt-0.5 shrink-0" />
                    <span>{transfer.errorMessage ?? "Upload failed."}</span>
                  </div>
                ) : (
                  <>
                    <div className="mt-3 h-1.5 rounded-full bg-[var(--color-surface-low)]">
                      <div
                        className="primary-gradient h-1.5 rounded-full transition-[width] duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--color-text-soft)]">
                      <span>{percent}%</span>
                      <span>
                        {formatBytes(transfer.transferredBytes)} / {formatBytes(transfer.totalBytes)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {transfers.length > 3 ? (
            <p className="px-1 text-[11px] text-[var(--color-text-soft)]">
              +{transfers.length - 3} more in queue
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
