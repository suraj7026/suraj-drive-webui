"use client";

import { useRef, useState } from "react";
import { CloudUpload, TriangleAlert, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import type { TransferItem } from "@/lib/models/transfers";
import { formatBytes } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

type UploadDialogProps = {
  open: boolean;
  onClose: () => void;
  targetLabel: string;
  transfers: TransferItem[];
  onFilesSelected: (files: FileList | null) => void;
  onRemoveTransfer: (id: string) => void;
};

export function UploadDialog({
  open,
  onClose,
  targetLabel,
  transfers,
  onFilesSelected,
  onRemoveTransfer,
}: UploadDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dropActive, setDropActive] = useState(false);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upload to your archive"
      description={`Files land in ${targetLabel}.`}
    >
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDropActive(true);
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDropActive(false);
          onFilesSelected(event.dataTransfer.files);
        }}
        className={cn(
          "rounded-[24px] bg-[var(--color-surface-strong)] px-6 py-10 text-center shadow-[inset_0_0_0_1px_var(--color-outline)] transition",
          dropActive ? "ring-2 ring-[var(--color-primary)]" : ""
        )}
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-[var(--color-surface-low)] text-[var(--color-primary)]">
          <CloudUpload size={24} />
        </div>
        <p className="font-heading mt-5 text-xl font-semibold tracking-[-0.03em]">Drag and drop files</p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--color-text-soft)]">
          Files are uploaded directly to your bucket using presigned URLs.
        </p>

        <input
          ref={inputRef}
          type="file"
          multiple
          aria-label="Choose files to upload"
          className="hidden"
          onChange={(event) => {
            onFilesSelected(event.target.files);
            if (inputRef.current) {
              inputRef.current.value = "";
            }
          }}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="primary-gradient mt-6 rounded-full px-5 py-3 text-sm font-semibold text-white"
        >
          Browse local files
        </button>
      </div>

      {transfers.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-text-soft)]">Recent</p>
          <div className="mt-3 grid max-h-[260px] gap-2 overflow-y-auto pr-1">
            {transfers.slice(0, 5).map((transfer) => {
              const percent = transfer.totalBytes > 0
                ? Math.min(100, Math.round((transfer.transferredBytes / transfer.totalBytes) * 100))
                : 0;

              return (
                <div
                  key={transfer.id}
                  className="rounded-[18px] bg-[var(--color-surface-strong)] px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{transfer.fileName}</p>
                      <p className="mt-0.5 text-xs text-[var(--color-text-soft)]">{transfer.statusLabel}</p>
                    </div>
                    <button
                      type="button"
                      aria-label="Dismiss transfer"
                      onClick={() => onRemoveTransfer(transfer.id)}
                      className="rounded-full p-1.5 text-[var(--color-text-soft)] hover:bg-[var(--color-surface-low)]"
                    >
                      <X size={14} />
                    </button>
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
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
