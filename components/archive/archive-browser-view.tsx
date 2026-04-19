"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowDownToLine,
  ArrowUpWideNarrow,
  ChevronRight,
  CloudUpload,
  Copy,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  MoreHorizontal,
  PersonStanding,
  Share2,
  Shield,
  TableProperties,
  Trash2,
} from "lucide-react";
import { clientApiFetch, uploadFileWithProgress, UploadError } from "@/lib/api/client";
import { ApiError } from "@/lib/api/core";
import type { BackendPresignResponse } from "@/lib/models/backend";
import { AppShell } from "@/components/shell/app-shell";
import type { ArchiveContext, FileItem } from "@/lib/models/archive";
import type { TransferItem } from "@/lib/models/transfers";
import { formatBytes, formatDateLabel } from "@/lib/utils/format";
import { buildArchiveHref } from "@/lib/utils/archive-path";
import { cn } from "@/lib/utils/cn";
import { TransferDrawer } from "@/components/upload/transfer-drawer";
import { UploadDialog } from "@/components/upload/upload-dialog";
import { NewFolderDialog } from "@/components/archive/new-folder-dialog";
import { DeleteDialog } from "@/components/archive/delete-dialog";

type ArchiveBrowserViewProps = {
  context: ArchiveContext;
};

export function ArchiveBrowserView({ context }: ArchiveBrowserViewProps) {
  const router = useRouter();
  const controllersRef = useRef<Record<string, AbortController>>({});
  const [selectedId, setSelectedId] = useState<string | null>(context.defaultSelectedId);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [transfers, setTransfers] = useState<TransferItem[]>(context.transferQueue);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null);
  const currentPrefix = joinPath(context.path);
  const archiveHref = `/archive/${context.user.bucket}`;
  const canManageView = context.section === "archive";
  const uploadTargetLabel = currentPrefix
    ? `My Archive / ${currentPrefix}`
    : "My Archive";

  const selectedItem = useMemo(
    () => context.items.find((item) => item.id === selectedId) ?? context.items[0] ?? null,
    [context.items, selectedId]
  );

  async function handleSubmitFolder(name: string) {
    setActionError(null);
    await clientApiFetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: currentPrefix, name }),
    });
    startTransition(() => router.refresh());
  }

  function updateTransfer(transferId: string, updates: Partial<TransferItem>) {
    setTransfers((current) =>
      current.map((transfer) => (transfer.id === transferId ? { ...transfer, ...updates } : transfer))
    );
  }

  function handleRemoveTransfer(transferId: string) {
    controllersRef.current[transferId]?.abort();
    delete controllersRef.current[transferId];
    setTransfers((current) => current.filter((transfer) => transfer.id !== transferId));
  }

  function handleToggleTransfer(transferId: string) {
    const transfer = transfers.find((candidate) => candidate.id === transferId);
    if (!transfer) {
      return;
    }
    if (transfer.status === "uploading") {
      controllersRef.current[transferId]?.abort();
    }
  }

  async function uploadTransfer(transferId: string, file: File) {
    const requestedKey = currentPrefix ? `${currentPrefix}/${file.name}` : file.name;
    const controller = new AbortController();
    controllersRef.current[transferId] = controller;

    const maxAttempts = 2;
    let lastError: unknown;

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        updateTransfer(transferId, {
          status: "uploading",
          transferredBytes: 0,
          statusLabel:
            attempt === 1
              ? `Preparing upload to ${uploadTargetLabel}`
              : `Retrying upload to ${uploadTargetLabel}`,
        });

        let presign: BackendPresignResponse;
        try {
          presign = await clientApiFetch<BackendPresignResponse>(
            `/api/files/presign/upload?key=${encodeURIComponent(requestedKey)}`
          );
        } catch (error) {
          lastError = error;
          if (isRetryablePresignError(error) && attempt < maxAttempts) {
            continue;
          }
          throw error;
        }

        updateTransfer(transferId, {
          objectKey: presign.key,
          statusLabel:
            attempt === 1
              ? `Uploading to ${uploadTargetLabel}`
              : `Retrying upload to ${uploadTargetLabel}`,
        });

        try {
          await uploadFileWithProgress({
            url: presign.url,
            file,
            signal: controller.signal,
            onProgress: (loadedBytes) => {
              updateTransfer(transferId, {
                transferredBytes: loadedBytes,
                status: "uploading",
                statusLabel: `${formatBytes(loadedBytes)} of ${formatBytes(file.size)} uploaded`,
              });
            },
          });

          updateTransfer(transferId, {
            transferredBytes: file.size,
            status: "done",
            statusLabel: `Uploaded to ${uploadTargetLabel}`,
            errorMessage: undefined,
          });
          startTransition(() => router.refresh());
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            throw error;
          }
          lastError = error;
          const retryable = error instanceof UploadError ? error.retryable : false;
          if (!retryable || attempt >= maxAttempts) {
            throw error;
          }
        }
      }

      if (lastError) {
        throw lastError;
      }
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === "AbortError";
      updateTransfer(transferId, {
        status: aborted ? "paused" : "error",
        statusLabel: aborted ? "Upload canceled" : "Upload failed",
        errorMessage: aborted ? undefined : error instanceof Error ? error.message : "Upload failed",
      });
    } finally {
      delete controllersRef.current[transferId];
    }
  }

  function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }

    for (const file of Array.from(files)) {
      const transferId = `${file.name}-${file.size}-${crypto.randomUUID()}`;
      setTransfers((current) => [
        {
          id: transferId,
          fileName: file.name,
          totalBytes: file.size,
          transferredBytes: 0,
          status: "queued",
          statusLabel: "Waiting for upload slot...",
          targetLabel: uploadTargetLabel,
        },
        ...current,
      ]);
      void uploadTransfer(transferId, file);
    }
  }

  async function handleDownload(item: FileItem) {
    setActionError(null);

    try {
      const response = await clientApiFetch<BackendPresignResponse>(`/api/files/presign/download?key=${encodeURIComponent(itemKey(item))}`);
      const anchor = document.createElement("a");
      anchor.href = response.url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.click();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to prepare download.");
    }
  }

  async function handleCopy(item: FileItem) {
    setActionError(null);

    try {
      const key = itemKey(item);
      await clientApiFetch("/api/files/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ src: key, dst: key }),
      });
      startTransition(() => router.refresh());
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to copy file.");
    }
  }

  function requestDelete(item: FileItem) {
    setActionError(null);
    setDeleteTarget(item);
  }

  async function performDelete(item: FileItem) {
    if (item.kind === "folder") {
      await clientApiFetch(`/api/folders?prefix=${encodeURIComponent(folderPrefix(item))}`, { method: "DELETE" });
    } else {
      await clientApiFetch(`/api/files?key=${encodeURIComponent(itemKey(item))}`, { method: "DELETE" });
    }

    setSelectedId((current) => (current === item.id ? null : current));
    startTransition(() => router.refresh());
  }

  return (
    <AppShell
      user={context.user}
      eyebrow={context.eyebrow}
      title={context.heading}
      detail={<DetailsPanel item={selectedItem} />}
      newObjectHref={canManageView ? undefined : archiveHref}
      onNewObjectClick={canManageView ? () => setUploadOpen(true) : undefined}
      headerAction={
        canManageView ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFolderOpen(true)}
              className="rounded-full bg-[var(--color-surface-low)] px-4 py-3 text-sm font-medium text-[var(--color-text)] shadow-[inset_0_0_0_1px_var(--color-outline)]"
            >
              New Folder
            </button>
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="primary-gradient inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white"
            >
              <CloudUpload size={16} />
              Upload
            </button>
          </div>
        ) : (
          <Link href={archiveHref} className="primary-gradient inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white">
            Open My Archive
          </Link>
        )
      }
      transferDrawer={
        <TransferDrawer
          transfers={transfers}
          onToggleStatus={handleToggleTransfer}
          onRemove={handleRemoveTransfer}
        />
      }
    >
      <section className="grid gap-7">
        {context.path.length === 0 && (context.collections.length > 0 || context.recents.length > 0) ? (
          <CollectionsSection context={context} />
        ) : null}

        <section className="grid gap-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-soft)]">
                <Breadcrumbs bucketId={context.bucket.id} segments={context.path} bucketLabel={context.bucket.name} />
              </div>
              <h2 className="font-heading mt-3 text-3xl font-semibold tracking-[-0.04em]">
                {context.currentFolderLabel}
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              <GhostAction icon={ArrowUpWideNarrow} label="Sort" />
              <GhostAction icon={TableProperties} label="Filter" />
              <GhostAction icon={Share2} label="Share Space" />
            </div>
          </div>

          {actionError ? (
            <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
              {actionError}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-[32px] bg-[var(--color-surface-strong)] shadow-[0_12px_32px_rgba(26,28,25,0.06)]">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-5 py-4 text-xs uppercase tracking-[0.28em] text-[var(--color-text-soft)] sm:grid-cols-[minmax(0,1fr)_100px_auto] sm:px-6 md:grid-cols-[minmax(0,1.3fr)_140px_100px_auto]">
              <span>Name</span>
              <span className="hidden md:block">Modified</span>
              <span className="hidden sm:block">Size</span>
              <span className="justify-self-end">Actions</span>
            </div>

            {context.items.length === 0 ? (
              <EmptyArchiveState
                message={context.emptyStateMessage ?? "No items are available in this view."}
                onUpload={canManageView ? () => setUploadOpen(true) : undefined}
                onOpenArchiveHref={canManageView ? undefined : archiveHref}
                onCreateFolder={canManageView ? () => setFolderOpen(true) : undefined}
              />
            ) : (
              <div className="grid">
                {context.items.map((item) => {
                  const href = item.kind === "folder" ? buildArchiveHref(context.bucket.id, [...context.path, item.slug]) : undefined;

                  return (
                    <article
                      key={item.id}
                      className={cn(
                        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 transition-colors sm:grid-cols-[minmax(0,1fr)_100px_auto] sm:px-6 md:grid-cols-[minmax(0,1.3fr)_140px_100px_auto]",
                        selectedItem?.id === item.id
                          ? "bg-[var(--color-secondary-soft)]/88"
                          : "hover:bg-[var(--color-surface-low)]/75"
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedId(item.id)}
                          className="flex min-w-0 items-center gap-3 text-left"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] bg-[var(--color-surface-low)] text-[var(--color-primary)]">
                            <ItemIcon kind={item.kind} fileType={item.fileType} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[15px] font-medium text-[var(--color-text)]">
                              {item.name}
                            </span>
                            <span className="block truncate text-sm text-[var(--color-text-soft)]">
                              {item.owner}
                            </span>
                          </span>
                        </button>
                      </div>
                      <span className="hidden text-sm text-[var(--color-text-muted)] md:block">{readUpdatedLabel(item)}</span>
                      <span className="hidden text-sm text-[var(--color-text-muted)] sm:block">
                        {item.sizeBytes ? formatBytes(item.sizeBytes) : "--"}
                      </span>
                      <div className="flex items-center justify-self-end gap-1 text-[var(--color-text-soft)] sm:gap-2">
                        {href ? (
                          <Link href={href} className="rounded-full p-2 hover:bg-[var(--color-surface-low)] hover:text-[var(--color-text)]">
                            <ChevronRight size={16} />
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleCopy(item)}
                            disabled={isPending}
                            className="rounded-full p-2 hover:bg-[var(--color-surface-low)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Copy ${item.name}`}
                          >
                            <Copy size={16} />
                          </button>
                        )}

                        {item.kind === "file" ? (
                          <button
                            type="button"
                            onClick={() => void handleDownload(item)}
                            disabled={isPending}
                            className="rounded-full p-2 hover:bg-[var(--color-surface-low)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Download ${item.name}`}
                          >
                            <ArrowDownToLine size={16} />
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => requestDelete(item)}
                          disabled={isPending}
                          className="rounded-full p-2 hover:bg-[var(--color-surface-low)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label={`Delete ${item.name}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-[22px] bg-[var(--color-surface-low)] px-5 py-4 text-sm text-[var(--color-text-muted)]">
            <span>Browsing live objects from your personal bucket.</span>
            <span>{context.items.length} visible objects</span>
          </div>
        </section>
      </section>

      {canManageView ? (
        <>
          <UploadDialog
            open={uploadOpen}
            onClose={() => setUploadOpen(false)}
            targetLabel={uploadTargetLabel}
            transfers={transfers}
            onFilesSelected={handleFilesSelected}
            onRemoveTransfer={handleRemoveTransfer}
          />
          <NewFolderDialog
            open={folderOpen}
            parentLabel={uploadTargetLabel}
            onClose={() => setFolderOpen(false)}
            onSubmit={handleSubmitFolder}
          />
        </>
      ) : null}

      <DeleteDialog
        open={deleteTarget !== null}
        item={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={performDelete}
      />
    </AppShell>
  );
}

function CollectionsSection({ context }: { context: ArchiveContext }) {
  return (
    <section className="grid gap-7">
      {context.collections.length > 0 ? (
        <div className="grid gap-5">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-text-soft)]">Collections</p>
            <h2 className="font-heading mt-2 text-2xl font-semibold tracking-[-0.04em]">Your living folders</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {context.collections.map((collection) => (
              <Link
                key={collection.id}
                href={collection.href}
                className="group flex min-h-[228px] flex-col rounded-[32px] bg-[var(--color-surface-strong)] px-6 py-6 shadow-[0_12px_32px_rgba(26,28,25,0.06)] transition-transform duration-300 hover:-translate-y-1 hover:bg-[var(--color-surface-high)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[var(--color-surface-low)] text-[var(--color-primary)]">
                    {collection.shared ? <FolderOpen size={20} /> : <Folder size={20} />}
                  </span>
                  <button type="button" className="rounded-full p-2 text-[var(--color-text-soft)] opacity-0 transition-opacity group-hover:opacity-100">
                    <MoreHorizontal size={16} />
                  </button>
                </div>
                <h3 className="font-heading mt-7 max-w-[12ch] text-[clamp(1.8rem,2vw,2.5rem)] font-semibold tracking-[-0.06em]">
                  {collection.title}
                </h3>
                <p className="mt-3 max-w-[18ch] text-base leading-8 text-[var(--color-text-muted)]">
                  {collection.objectCount} Objects · Updated {collection.updatedLabel}
                </p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {context.recents.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-text-soft)]">Recent Artifacts</p>
            <h2 className="font-heading mt-2 text-2xl font-semibold tracking-[-0.04em]">Fresh from the archive</h2>
            <div className="mt-4 grid gap-3 rounded-[32px] bg-[var(--color-surface-strong)] p-4 shadow-[0_12px_32px_rgba(26,28,25,0.06)]">
              {context.recents.map((item) => (
                <div key={item.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[20px] bg-[var(--color-surface)] px-4 py-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[var(--color-surface-strong)] text-[var(--color-primary)]">
                    <ItemIcon kind={item.kind} fileType={item.fileType} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium">{item.name}</p>
                    <p className="truncate text-sm text-[var(--color-text-soft)]">
                      {item.owner}{item.updatedAt ? ` · ${formatDateLabel(item.updatedAt)}` : ""}
                    </p>
                  </div>
                  <button type="button" className="rounded-full p-2 text-[var(--color-text-soft)] hover:bg-[var(--color-surface-low)] hover:text-[var(--color-text)]">
                    <MoreHorizontal size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="primary-gradient ambient-panel flex items-center justify-between rounded-[32px] px-5 py-5 text-white xl:min-h-full">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/72">Fast Add</p>
              <p className="font-heading mt-2 text-xl font-semibold">Drop objects here to archive to this collection</p>
            </div>
            <CloudUpload size={30} className="shrink-0" />
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function ArchiveSectionView({ context }: { context: ArchiveContext }) {
  return <ArchiveBrowserView context={context} />;
}

function DetailsPanel({ item }: { item: FileItem | null }) {
  if (!item) {
    return (
      <div>
        <p className="text-sm text-[var(--color-text-soft)]">Select an item to inspect its archive details.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-text-soft)]">Details</p>
        <button type="button" className="rounded-full bg-[var(--color-surface-low)] p-2 text-[var(--color-text-soft)]">
          <MoreHorizontal size={16} />
        </button>
      </div>

      <div className="rounded-[32px] bg-[var(--color-surface-high)] p-5">
        <span className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[var(--color-surface-strong)] text-[var(--color-primary)]">
          <ItemIcon kind={item.kind} fileType={item.fileType} />
        </span>
        <h3 className="font-heading mt-6 text-2xl font-semibold tracking-[-0.04em] break-all">{item.name}</h3>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          {item.kind === "folder" ? "Folder" : item.fileType?.toUpperCase() ?? "Object"}
        </p>
      </div>

      <DetailRow label="Location" value={item.path.join(" / ") || "My Archive"} />
      <DetailRow label="Owner" value={item.owner} />
      <DetailRow label="Updated" value={item.updatedAt ? formatDateLabel(item.updatedAt) : "--"} />
      <DetailRow label="Size" value={item.sizeBytes ? formatBytes(item.sizeBytes) : "--"} />
      <DetailRow label="Classification" value={item.tags?.join(" · ") ?? "Personal Archive"} />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-[22px] bg-[var(--color-surface-strong)] px-4 py-4 shadow-[0_12px_32px_rgba(26,28,25,0.05)]">
      <span className="text-xs uppercase tracking-[0.22em] text-[var(--color-text-soft)]">{label}</span>
      <span className="text-sm text-[var(--color-text)]">{value}</span>
    </div>
  );
}

function Breadcrumbs({
  bucketId,
  bucketLabel,
  segments,
}: {
  bucketId: string;
  bucketLabel: string;
  segments: string[];
}) {
  const crumbs = [{ label: bucketLabel, href: buildArchiveHref(bucketId, []) }].concat(
    segments.map((segment, index) => ({
      label: segment,
      href: buildArchiveHref(bucketId, segments.slice(0, index + 1)),
    }))
  );

  return (
    <>
      {crumbs.map((crumb, index) => (
        <span key={crumb.href} className="flex items-center gap-2">
          {index > 0 ? <span className="h-2 w-px bg-[var(--color-primary-soft)]" /> : null}
          <Link href={crumb.href} className="hover:text-[var(--color-text)]">
            {crumb.label}
          </Link>
        </span>
      ))}
    </>
  );
}

function GhostAction({ icon: Icon, label }: { icon: typeof ArrowUpWideNarrow; label: string }) {
  return (
    <button type="button" className="inline-flex items-center gap-2 rounded-full bg-[var(--color-surface-low)] px-4 py-3 text-sm text-[var(--color-text-muted)] shadow-[inset_0_0_0_1px_var(--color-outline)] transition-colors duration-300 hover:text-[var(--color-text)]">
      <Icon size={16} />
      {label}
    </button>
  );
}

function ItemIcon({
  kind,
  fileType,
}: {
  kind: FileItem["kind"];
  fileType?: FileItem["fileType"];
}) {
  if (kind === "folder") {
    return <Folder size={18} />;
  }

  switch (fileType) {
    case "image":
    case "raw":
      return <ImageIcon size={18} />;
    case "csv":
      return <TableProperties size={18} />;
    case "video":
      return <ArrowDownToLine size={18} />;
    case "pdf":
      return <PersonStanding size={18} />;
    default:
      return <Shield size={18} />;
  }
}

function EmptyArchiveState({
  message,
  onUpload,
  onOpenArchiveHref,
  onCreateFolder,
}: {
  message: string;
  onUpload?: () => void;
  onOpenArchiveHref?: string;
  onCreateFolder?: () => void;
}) {
  return (
    <div className="grid place-items-center px-6 py-14 text-center">
      <div className="max-w-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-[var(--color-surface-low)] text-[var(--color-primary)]">
          <FolderOpen size={22} />
        </div>
        <h3 className="font-heading mt-5 text-2xl font-semibold tracking-[-0.04em]">Nothing here yet</h3>
        <p className="mt-3 text-sm leading-7 text-[var(--color-text-soft)]">{message}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          {onCreateFolder ? (
            <button
              type="button"
              onClick={onCreateFolder}
              className="rounded-full bg-[var(--color-surface-low)] px-4 py-3 text-sm font-medium text-[var(--color-text)] shadow-[inset_0_0_0_1px_var(--color-outline)]"
            >
              New Folder
            </button>
          ) : null}
          {onUpload ? (
            <button
              type="button"
              onClick={onUpload}
              className="primary-gradient inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white"
            >
              <CloudUpload size={16} />
              Upload
            </button>
          ) : onOpenArchiveHref ? (
            <Link
              href={onOpenArchiveHref}
              className="primary-gradient inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white"
            >
              Open Archive
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function joinPath(segments: string[]) {
  return segments.join("/");
}

function itemKey(item: FileItem) {
  return [...item.path, item.slug].filter(Boolean).join("/");
}

function folderPrefix(item: FileItem) {
  return `${itemKey(item)}/`;
}

function readUpdatedLabel(item: FileItem) {
  return item.updatedAt ? formatDateLabel(item.updatedAt) : "--";
}

function isRetryablePresignError(error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.status >= 500) {
      return true;
    }
    if (error.status === 408 || error.status === 425 || error.status === 429) {
      return true;
    }
    return false;
  }
  if (error instanceof TypeError) {
    return true;
  }
  return false;
}
