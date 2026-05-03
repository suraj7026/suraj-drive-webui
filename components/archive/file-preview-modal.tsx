"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ArrowDownToLine, ChevronLeft, ChevronRight, FileQuestion, X } from "lucide-react";
import { clientApiFetch } from "@/lib/api/client";
import type { BackendPresignResponse } from "@/lib/models/backend";
import type { FileItem } from "@/lib/models/archive";
import { formatBytes } from "@/lib/utils/format";
import {
  getPreviewKindForItem,
  isBrowserRenderableImage,
  isPreviewable,
  needsHeicConversion,
} from "@/lib/utils/file-preview";
import { cacheHeicJpeg, getCachedHeicJpeg } from "@/lib/utils/heic-cache";
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
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );

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
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose, goPrev, goNext]);

  if (!open || !item || !mounted) {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${item.name}`}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
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

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-6 pb-6">
        {hasPrev ? (
          <NavButton direction="prev" onClick={goPrev} />
        ) : null}

        <div className="relative z-0 flex h-full w-full items-center justify-center">
          <PreviewBody key={item.id} item={item} onDownload={() => onDownload(item)} />
        </div>

        {hasNext ? (
          <NavButton direction="next" onClick={goNext} />
        ) : null}
      </div>
    </div>,
    document.body
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
  const previewable = isPreviewable(item.fileType, item.name);
  const isHeic = needsHeicConversion(item.name);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // HEIC owns its own loading lifecycle; we don't pre-fetch a presigned URL for it.
  const [loading, setLoading] = useState<boolean>(previewable && !isHeic);

  const objectKey = useMemo(
    () => [...item.path, item.slug].filter(Boolean).join("/"),
    [item.path, item.slug]
  );

  useEffect(() => {
    if (!previewable || isHeic) {
      return;
    }

    let cancelled = false;

    clientApiFetch<BackendPresignResponse>(
      `/api/files/presign/download?key=${encodeURIComponent(objectKey)}`
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
  }, [objectKey, previewable, isHeic]);

  if (!previewable) {
    return <UnsupportedPreview item={item} onDownload={onDownload} />;
  }

  if (isHeic) {
    return (
      <HeicImagePreview alt={item.name} objectKey={objectKey} onDownload={onDownload} />
    );
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

  const kind = getPreviewKindForItem(item);

  if (kind === "image") {
    if (!isBrowserRenderableImage(item.name)) {
      return <NonRenderableImageNotice item={item} url={url} onDownload={onDownload} />;
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={item.name}
        className="block max-h-full max-w-full rounded-[18px] object-contain shadow-[0_32px_80px_rgba(0,0,0,0.5)]"
      />
    );
  }

  if (kind === "video") {
    return (
      <video
        src={url}
        controls
        autoPlay
        className="block max-h-full max-w-full rounded-[18px] bg-black shadow-[0_32px_80px_rgba(0,0,0,0.5)]"
      />
    );
  }

  if (kind === "audio") {
    return (
      <div className="flex w-full max-w-xl flex-col items-center gap-4 rounded-[28px] bg-white/8 px-8 py-10 text-center text-white">
        <p className="truncate text-base font-medium">{item.name}</p>
        <audio src={url} controls autoPlay className="w-full" />
      </div>
    );
  }

  if (kind === "pdf") {
    return (
      <iframe
        src={url}
        title={item.name}
        className="block h-full w-full max-w-[1200px] rounded-[18px] bg-white shadow-[0_32px_80px_rgba(0,0,0,0.5)]"
      />
    );
  }

  if (kind === "text") {
    return <TextPreview url={url} name={item.name} onDownload={onDownload} />;
  }

  return <UnsupportedPreview item={item} onDownload={onDownload} />;
}

function HeicImagePreview({
  alt,
  objectKey,
  onDownload,
}: {
  alt: string;
  objectKey: string;
  onDownload: () => void;
}) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let createdObjectUrl: string | null = null;

    async function clientFallback(): Promise<void> {
      // Last-resort path: fetch the original HEIC and decode in-browser.
      // Uses the same IndexedDB cache to avoid repeating the WASM decode.
      const presign = await clientApiFetch<BackendPresignResponse>(
        `/api/files/presign/download?key=${encodeURIComponent(objectKey)}`
      );
      const heicResponse = await fetch(presign.url);
      if (!heicResponse.ok) {
        throw new Error(`HTTP ${heicResponse.status}`);
      }
      const heicBlob = await heicResponse.blob();
      const heic2any = (await import("heic2any")).default;
      const converted = await heic2any({ blob: heicBlob, toType: "image/jpeg", quality: 0.9 });
      const jpegBlob = Array.isArray(converted) ? converted[0] : converted;
      if (cancelled) return;
      createdObjectUrl = URL.createObjectURL(jpegBlob);
      setImageSrc(createdObjectUrl);
      void cacheHeicJpeg(objectKey, jpegBlob);
    }

    (async () => {
      try {
        const cached = await getCachedHeicJpeg(objectKey);
        if (cancelled) return;
        if (cached) {
          createdObjectUrl = URL.createObjectURL(cached);
          setImageSrc(createdObjectUrl);
          return;
        }

        try {
          const preview = await clientApiFetch<BackendPresignResponse>(
            `/api/files/preview?key=${encodeURIComponent(objectKey)}`
          );
          if (cancelled) return;
          // Server-side JPEG can render directly via <img>; no extra fetch
          // needed and no decode work on the client.
          setImageSrc(preview.url);
        } catch {
          if (cancelled) return;
          await clientFallback();
        }
      } catch (reason) {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : "HEIC conversion failed.");
      }
    })();

    return () => {
      cancelled = true;
      if (createdObjectUrl) {
        URL.revokeObjectURL(createdObjectUrl);
      }
    };
  }, [objectKey]);

  if (error) {
    return (
      <div className="max-w-md rounded-[24px] bg-white/8 px-6 py-6 text-center text-white">
        <p className="text-base font-medium">Could not convert HEIC</p>
        <p className="mt-2 text-sm text-white/72">{error}</p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex items-center gap-2 rounded-full bg-white/16 px-4 py-2 text-sm font-medium hover:bg-white/24"
          >
            <ArrowDownToLine size={16} />
            Download
          </button>
        </div>
      </div>
    );
  }

  if (!imageSrc) {
    return (
      <div className="flex flex-col items-center gap-3 text-white/72">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/24 border-t-white" />
        <p className="text-sm">Decoding HEIC...</p>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageSrc}
      alt={alt}
      className="block max-h-full max-w-full rounded-[18px] object-contain shadow-[0_32px_80px_rgba(0,0,0,0.5)]"
    />
  );
}

function NonRenderableImageNotice({
  item,
  url,
  onDownload,
}: {
  item: FileItem;
  url: string;
  onDownload: () => void;
}) {
  const ext = item.name.split(".").pop()?.toUpperCase() ?? "image";
  return (
    <div className="relative z-0 flex max-w-md flex-col items-center gap-4 rounded-[28px] bg-white/8 px-8 py-10 text-center text-white">
      <span className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-white/12">
        <FileQuestion size={26} />
      </span>
      <div>
        <p className="text-lg font-semibold">{ext} preview not supported</p>
        <p className="mt-1 text-sm text-white/72">
          Most browsers cannot render {ext} natively. Open the file directly or download it.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-white/16 px-4 py-2 text-sm font-medium hover:bg-white/24"
        >
          Open in new tab
        </a>
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center gap-2 rounded-full bg-white/16 px-4 py-2 text-sm font-medium hover:bg-white/24"
        >
          <ArrowDownToLine size={16} />
          Download
        </button>
      </div>
    </div>
  );
}

const MAX_TEXT_PREVIEW_BYTES = 512 * 1024;

function TextPreview({
  url,
  name,
  onDownload,
}: {
  url: string;
  name: string;
  onDownload: () => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const blob = await res.blob();
        const slice = blob.slice(0, MAX_TEXT_PREVIEW_BYTES);
        const body = await slice.text();
        if (cancelled) return;
        setText(body);
        setTruncated(blob.size > MAX_TEXT_PREVIEW_BYTES);
      })
      .catch((reason) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : "Failed to load text.");
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) {
    return (
      <div className="relative z-0 max-w-md rounded-[24px] bg-white/8 px-6 py-6 text-center text-white">
        <p className="text-base font-medium">Could not load text preview</p>
        <p className="mt-2 text-sm text-white/72">{error}</p>
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

  if (text === null) {
    return (
      <div className="relative z-0 flex flex-col items-center gap-3 text-white/72">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/24 border-t-white" />
        <p className="text-sm">Loading {name}...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full max-w-[1100px] flex-col overflow-hidden rounded-[18px] bg-[var(--color-surface)] text-[var(--color-text)] shadow-[0_32px_80px_rgba(0,0,0,0.5)]">
      <pre className="m-0 flex-1 overflow-auto p-6 font-mono text-sm leading-6 whitespace-pre-wrap break-words">
        {text}
      </pre>
      {truncated ? (
        <div className="border-t border-[var(--color-outline)] bg-[var(--color-surface-low)] px-6 py-3 text-xs text-[var(--color-text-soft)]">
          Showing first {Math.round(MAX_TEXT_PREVIEW_BYTES / 1024)} KB. Download for the full file.
        </div>
      ) : null}
    </div>
  );
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
