"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ChevronLeft, ChevronRight, FileQuestion, X } from "lucide-react";
import { clientApiFetch } from "@/lib/api/client";
import type { BackendPresignResponse } from "@/lib/models/backend";
import type { FileItem } from "@/lib/models/archive";
import { formatBytes } from "@/lib/utils/format";
import { getPreviewKind, isPreviewable } from "@/lib/utils/file-preview";
import { cn } from "@/lib/utils/cn";

type FilePreviewModalProps = {
  open: boolean;
  items: FileItem[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onDownload: (item: FileItem) => void;
};

export function FilePreviewModal({
  open,
  items,
  currentIndex,
  onClose,
  onNavigate,
  onDownload,
}: FilePreviewModalProps) {
  const item = items[currentIndex] ?? null;

  const previewableIndices = useMemo(
    () => items.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.kind === "file"),
    [items]
  );

  const hasPrev = previewableIndices.some(({ index }) => index < currentIndex);
  const hasNext = previewableIndices.some(({ index }) => index > currentIndex);

  const goPrev = useCallback(() => {
    const candidates = previewableIndices.filter(({ index }) => index < currentIndex);
    const target = candidates[candidates.length - 1];
    if (target) {
      onNavigate(target.index);
    }
  }, [currentIndex, onNavigate, previewableIndices]);

  const goNext = useCallback(() => {
    const target = previewableIndices.find(({ index }) => index > currentIndex);
    if (target) {
      onNavigate(target.index);
    }
  }, [currentIndex, onNavigate, previewableIndices]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "ArrowLeft") {
        goPrev();
        return;
      }
      if (event.key === "ArrowRight") {
        goNext();
      }
    }

    document.addEventListener("keydown", handleKey);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose, goPrev, goNext]);

  if (!open || !item) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${item.name}`}
      className="fixed inset-0 z-50 flex flex-col"
    >
      <button
        type="button"
        aria-label="Close preview"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[var(--color-scrim)] backdrop-blur-md"
      />

      <PreviewTopBar
        item={item}
        onClose={onClose}
        onDownload={() => onDownload(item)}
      />

      <div className="relative flex flex-1 items-center justify-center px-6 pb-10">
        {hasPrev ? (
          <NavButton direction="prev" onClick={goPrev} />
        ) : null}

        <PreviewBody key={item.id} item={item} onDownload={() => onDownload(item)} />

        {hasNext ? (
          <NavButton direction="next" onClick={goNext} />
        ) : null}
      </div>
    </div>
  );
}

function PreviewTopBar({
  item,
  onClose,
  onDownload,
}: {
  item: FileItem;
  onClose: () => void;
  onDownload: () => void;
}) {
  const typeLabel = item.fileType ? item.fileType.toUpperCase() : "OBJECT";
  const sizeLabel = item.sizeBytes ? formatBytes(item.sizeBytes) : null;

  return (
    <div className="relative z-10 flex items-center justify-between gap-4 px-6 py-5 text-white">
      <div className="flex min-w-0 items-center gap-3">
        <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]">
          {typeLabel}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-medium">{item.name}</p>
          {sizeLabel ? (
            <p className="truncate text-xs text-white/64">{sizeLabel}</p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
        >
          <ArrowDownToLine size={16} />
          Download
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-white hover:bg-white/20"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

function NavButton({ direction, onClick }: { direction: "prev" | "next"; onClick: () => void }) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "prev" ? "Previous file" : "Next file"}
      className={cn(
        "absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur-sm hover:bg-white/24",
        direction === "prev" ? "left-4" : "right-4"
      )}
    >
      <Icon size={20} />
    </button>
  );
}

function PreviewBody({ item, onDownload }: { item: FileItem; onDownload: () => void }) {
  const previewable = isPreviewable(item.fileType);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(previewable);

  useEffect(() => {
    if (!previewable) {
      return;
    }

    let cancelled = false;
    const key = [...item.path, item.slug].filter(Boolean).join("/");

    clientApiFetch<BackendPresignResponse>(
      `/api/files/presign/download?key=${encodeURIComponent(key)}`
    )
      .then((response) => {
        if (cancelled) return;
        setUrl(response.url);
        setLoading(false);
      })
      .catch((reason) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : "Failed to load preview.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [item.path, item.slug, previewable]);

  if (!previewable) {
    return <UnsupportedPreview item={item} onDownload={onDownload} />;
  }

  if (loading) {
    return (
      <div className="relative z-0 flex flex-col items-center gap-3 text-white/72">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/24 border-t-white" />
        <p className="text-sm">Preparing preview...</p>
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className="relative z-0 max-w-md rounded-[24px] bg-white/8 px-6 py-6 text-center text-white">
        <p className="text-base font-medium">Could not load preview</p>
        <p className="mt-2 text-sm text-white/72">{error ?? "Unknown error."}</p>
        <button
          type="button"
          onClick={onDownload}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/16 px-4 py-2 text-sm font-medium hover:bg-white/24"
        >
          <ArrowDownToLine size={16} />
          Download instead
        </button>
      </div>
    );
  }

  const kind = getPreviewKind(item.fileType);

  if (kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={item.name}
        className="relative z-0 max-h-[82vh] max-w-[92vw] rounded-[18px] object-contain shadow-[0_32px_80px_rgba(0,0,0,0.5)]"
      />
    );
  }

  if (kind === "video") {
    return (
      <video
        src={url}
        controls
        autoPlay
        className="relative z-0 max-h-[82vh] max-w-[92vw] rounded-[18px] bg-black shadow-[0_32px_80px_rgba(0,0,0,0.5)]"
      />
    );
  }

  if (kind === "pdf") {
    return (
      <iframe
        src={url}
        title={item.name}
        className="relative z-0 h-[82vh] w-[92vw] max-w-[1200px] rounded-[18px] bg-white shadow-[0_32px_80px_rgba(0,0,0,0.5)]"
      />
    );
  }

  return <UnsupportedPreview item={item} onDownload={onDownload} />;
}

function UnsupportedPreview({ item, onDownload }: { item: FileItem; onDownload: () => void }) {
  const sizeLabel = item.sizeBytes ? formatBytes(item.sizeBytes) : "Unknown size";
  const typeLabel = item.fileType ? item.fileType.toUpperCase() : "OBJECT";

  return (
    <div className="relative z-0 flex max-w-md flex-col items-center gap-4 rounded-[28px] bg-white/8 px-8 py-10 text-center text-white">
      <span className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-white/12">
        <FileQuestion size={26} />
      </span>
      <div>
        <p className="text-lg font-semibold">Preview not available</p>
        <p className="mt-1 text-sm text-white/72">
          {typeLabel} files cannot be previewed in the browser yet.
        </p>
      </div>
      <p className="text-xs text-white/56">{sizeLabel}</p>
      <button
        type="button"
        onClick={onDownload}
        className="inline-flex items-center gap-2 rounded-full bg-white/16 px-4 py-2 text-sm font-medium hover:bg-white/24"
      >
        <ArrowDownToLine size={16} />
        Download file
      </button>
    </div>
  );
}
