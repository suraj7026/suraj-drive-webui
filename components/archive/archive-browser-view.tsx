"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowDownToLine,
  ArrowUpWideNarrow,
  Check,
  ChevronRight,
  CloudUpload,
  Copy,
  Folder,
	FolderOpen,
	FolderInput,
  Image as ImageIcon,
	LayoutGrid,
	Link2,
	List,
  MoreHorizontal,
	History,
	MessageSquare,
	Pencil,
	Palette,
  PersonStanding,
	RotateCcw,
	Rows3,
  Shield,
	Star,
	Share2,
  TableProperties,
  Trash2,
} from "lucide-react";
import { clientApiFetch, uploadBlobWithProgress, uploadFileWithProgress, UploadError } from "@/lib/api/client";
import { ApiError } from "@/lib/api/core";
import type { BackendActiveUploadsResponse, BackendActivityEvent, BackendActivityResponse, BackendBatchResponse, BackendPresignResponse, BackendShortcutResolution, BackendUploadPartURLs, BackendUploadReservation, BackendUserPreferences } from "@/lib/models/backend";
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
import { FilePreviewModal } from "@/components/archive/file-preview-modal";
import { RenameDialog } from "@/components/archive/rename-dialog";
import { ShareDialog } from "@/components/archive/share-dialog";
import { PermanentDeleteDialog } from "@/components/archive/permanent-delete-dialog";
import { VersionDialog } from "@/components/archive/version-dialog";
import { CommentsDialog } from "@/components/archive/comments-dialog";
import { FolderColorDialog } from "@/components/archive/folder-color-dialog";
import { MoveDialog } from "@/components/archive/move-dialog";
import { loadRecoveredTransfers, persistRecoveredTransfers } from "@/lib/uploads/recovery-store";
import { sha256File } from "@/lib/uploads/file-digest";

type ArchiveBrowserViewProps = {
  context: ArchiveContext;
};

const SORT_OPTIONS = [
  { key: "default", label: "Default order" },
  { key: "name-asc", label: "Name (A → Z)" },
  { key: "name-desc", label: "Name (Z → A)" },
  { key: "date-newest", label: "Newest first" },
  { key: "date-oldest", label: "Oldest first" },
  { key: "size-largest", label: "Largest first" },
  { key: "size-smallest", label: "Smallest first" },
];

const FILTER_OPTIONS = [
  { key: "all", label: "All items" },
  { key: "folder", label: "Folders" },
  { key: "file", label: "Files" },
  { key: "image", label: "Images" },
  { key: "pdf", label: "Documents" },
  { key: "video", label: "Media" },
];

const MULTIPART_UPLOAD_THRESHOLD = 16 << 20;
const PRESIGNED_PART_BATCH_SIZE = 4;

export function ArchiveBrowserView({ context }: ArchiveBrowserViewProps) {
  const router = useRouter();
  const controllersRef = useRef<Record<string, AbortController>>({});
  const transferFilesRef = useRef<Record<string, File>>({});
  const cancelledTransfersRef = useRef(new Set<string>());
	const transferLifecycleRef = useRef("");
  const [selectedId, setSelectedId] = useState<string | null>(context.defaultSelectedId);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [transfers, setTransfers] = useState<TransferItem[]>(context.transferQueue);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null);
	const [renameTarget, setRenameTarget] = useState<FileItem | null>(null);
	const [shareTarget, setShareTarget] = useState<FileItem | null>(null);
	const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<FileItem | "all" | null>(null);
	const [versionTarget, setVersionTarget] = useState<FileItem | null>(null);
	const [commentsTarget, setCommentsTarget] = useState<FileItem | null>(null);
	const [colorTarget, setColorTarget] = useState<FileItem | null>(null);
	const [moveTarget, setMoveTarget] = useState<FileItem | null>(null);
	const [shortcutPreviews, setShortcutPreviews] = useState<Record<string, FileItem>>({});
	const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState("default");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [filterKind, setFilterKind] = useState("all");
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const currentPrefix = joinPath(context.path);
  const currentFolderId = context.currentFolderId ?? "";
  const archiveHref = `/archive/${context.user.drive_id}`;
  const canManageView = context.section === "archive";
	const isTrashView = context.section === "trash";
  const uploadTargetLabel = currentPrefix
    ? `My Archive / ${currentPrefix}`
    : "My Archive";

	useEffect(() => () => {
		for (const controller of Object.values(controllersRef.current)) controller.abort();
	}, []);

  const displayItems = useMemo(() => {
    let items = [...context.items];

    if (filterKind !== "all") {
      switch (filterKind) {
        case "folder":
          items = items.filter((i) => i.kind === "folder");
          break;
        case "file":
          items = items.filter((i) => i.kind === "file");
          break;
        default:
          items = items.filter((i) => i.kind === "file" && i.fileType === filterKind);
          break;
      }
    }

    if (sortKey !== "default") {
      const compare = (a: FileItem, b: FileItem): number => {
        switch (sortKey) {
          case "name-asc": return a.name.localeCompare(b.name);
          case "name-desc": return b.name.localeCompare(a.name);
          case "date-newest": return (+new Date(b.updatedAt ?? 0)) - (+new Date(a.updatedAt ?? 0));
          case "date-oldest": return (+new Date(a.updatedAt ?? 0)) - (+new Date(b.updatedAt ?? 0));
          case "size-largest": return (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0);
          case "size-smallest": return (a.sizeBytes ?? 0) - (b.sizeBytes ?? 0);
          default: return 0;
        }
      };
      const folders = items.filter((i) => i.kind === "folder").sort(compare);
		const remainingItems = items.filter((i) => i.kind !== "folder").sort(compare);
		items = [...folders, ...remainingItems];
    }

    return items;
  }, [context.items, sortKey, filterKind]);

  const selectedItem = useMemo(
    () => displayItems.find((item) => item.id === selectedId) ?? displayItems[0] ?? null,
    [displayItems, selectedId]
  );

	const previewItems = useMemo(
		() => displayItems.map((item) => shortcutPreviews[item.id] ?? item),
		[displayItems, shortcutPreviews],
	);

  useEffect(() => {
	let cancelled = false;
	clientApiFetch<BackendUserPreferences>("/api/preferences")
		.then((preferences) => {
			if (cancelled) return;
			setViewMode(preferences.view_mode);
			setDensity(preferences.density);
			setSortKey(preferences.sort_key);
		})
		.catch(() => {
			// Defaults remain usable if an older backend has not migrated yet.
		});
	return () => { cancelled = true; };
  }, []);

	useEffect(() => {
		function handleSelectionKeys(event: KeyboardEvent) {
			const target = event.target as HTMLElement | null;
			if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
				event.preventDefault();
				setSelectedIds(new Set(displayItems.slice(0, 100).map((item) => item.id)));
			} else if (event.key === "Escape") {
				setSelectedIds(new Set());
			}
		}
		window.addEventListener("keydown", handleSelectionKeys);
		return () => window.removeEventListener("keydown", handleSelectionKeys);
	}, [displayItems]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-toolbar-dropdown]")) {
        setSortOpen(false);
        setFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function savePreferences(patch: Partial<BackendUserPreferences>) {
	void clientApiFetch<BackendUserPreferences>("/api/preferences", {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(patch),
	}).catch((error) => {
		setActionError(error instanceof Error ? error.message : "Failed to save view preferences.");
	});
  }

  function chooseSort(key: string) {
	setSortKey(key);
	setSortOpen(false);
	savePreferences({ sort_key: key });
  }

  function chooseView(mode: "list" | "grid") {
	setViewMode(mode);
	savePreferences({ view_mode: mode });
  }

  function toggleDensity() {
	const next = density === "comfortable" ? "compact" : "comfortable";
	setDensity(next);
	savePreferences({ density: next });
  }

	useEffect(() => {
		let cancelled = false;
		const controllers = controllersRef.current;
		const recoveryControllers = new Map<string, AbortController>();
		async function watchUploadCompletion(transferId: string, uploadId: string, expectedSHA256: string, size: number) {
			if (controllers[transferId]) return;
			const controller = new AbortController();
			controllers[transferId] = controller;
			recoveryControllers.set(transferId, controller);
			try {
				let completion = await requestUploadCompletion(uploadId, expectedSHA256, controller.signal);
				while (completion.status === "completing" || completion.processing_stage === "scanning") {
					setTransfers((current) => current.map((transfer) => transfer.id === transferId ? { ...transfer, statusLabel: completion.processing_stage === "scanning" ? "Scanning upload for threats..." : "Verifying uploaded bytes..." } : transfer));
					await abortableDelay(1000, controller.signal);
					completion = await requestUploadCompletion(uploadId, expectedSHA256, controller.signal);
				}
				if (completion.status !== "completed" || completion.processing_stage === "failed") throw new Error("Upload security verification failed.");
				setTransfers((current) => current.map((transfer) => transfer.id === transferId ? { ...transfer, status: "done", transferredBytes: size, statusLabel: "Upload verified", errorMessage: undefined } : transfer));
				startTransition(() => router.refresh());
			} catch (error) {
				if (error instanceof DOMException && error.name === "AbortError") return;
				setTransfers((current) => current.map((transfer) => transfer.id === transferId ? { ...transfer, status: "error", statusLabel: "Upload verification failed", errorMessage: error instanceof Error ? error.message : "Upload verification failed" } : transfer));
			} finally {
				delete controllers[transferId];
				recoveryControllers.delete(transferId);
			}
		}
		Promise.all([
			loadRecoveredTransfers(context.user.id).catch(() => []),
			clientApiFetch<BackendActiveUploadsResponse>("/api/uploads").catch(() => ({ uploads: [] })),
		]).then(([localTransfers, response]) => {
			if (cancelled) return;
			const activeByID = new Map(response.uploads.map((upload) => [upload.upload_id, upload]));
			const recovered = localTransfers
				.filter((transfer) => transfer.uploadId && activeByID.has(transfer.uploadId))
				.map((transfer) => {
					const upload = activeByID.get(transfer.uploadId as string)!;
					const processing = upload.status === "completing" || upload.processing_stage === "scanning";
					return { ...transfer, objectKey: upload.key, fileName: upload.name, totalBytes: upload.expected_size, transferredBytes: processing ? upload.expected_size : upload.uploaded_parts?.reduce((sum, part) => sum + part.size, 0) ?? 0, status: processing ? "uploading" as const : "paused" as const, canResume: false, resumable: !processing && upload.upload_mode === "multipart", uploadMode: upload.upload_mode, partSize: upload.part_size, uploadedParts: upload.uploaded_parts, mimeType: upload.mime_type, expectedSHA256: upload.expected_sha256, statusLabel: upload.processing_stage === "scanning" ? "Scanning upload for threats..." : upload.status === "completing" ? "Verifying uploaded bytes..." : upload.upload_mode === "multipart" ? "Upload interrupted — reselect the same file to continue or cancel it" : "Upload interrupted — cancel and upload this file again" };
				});
			for (const upload of response.uploads) {
				if (!recovered.some((transfer) => transfer.uploadId === upload.upload_id)) {
					const processing = upload.status === "completing" || upload.processing_stage === "scanning";
					recovered.push({ id: upload.upload_id, uploadId: upload.upload_id, objectKey: upload.key, fileName: upload.name, totalBytes: upload.expected_size, transferredBytes: processing ? upload.expected_size : upload.uploaded_parts?.reduce((sum, part) => sum + part.size, 0) ?? 0, status: processing ? "uploading" : "paused", statusLabel: upload.processing_stage === "scanning" ? "Scanning upload for threats..." : upload.status === "completing" ? "Verifying uploaded bytes..." : upload.upload_mode === "multipart" ? "Upload interrupted — reselect the same file to continue or cancel it" : "Upload interrupted — cancel and upload this file again", targetLabel: "My Drive", resumable: !processing && upload.upload_mode === "multipart", canResume: false, uploadMode: upload.upload_mode, partSize: upload.part_size, uploadedParts: upload.uploaded_parts, mimeType: upload.mime_type, expectedSHA256: upload.expected_sha256 });
				}
			}
			if (recovered.length > 0) setTransfers((current) => current.length > 0 ? current : recovered);
			for (const upload of response.uploads) {
				if ((upload.status === "completing" || upload.processing_stage === "scanning") && upload.expected_sha256) {
					const transferId = recovered.find((transfer) => transfer.uploadId === upload.upload_id)?.id ?? upload.upload_id;
					void watchUploadCompletion(transferId, upload.upload_id, upload.expected_sha256, upload.expected_size);
				}
			}
		});
		return () => {
			cancelled = true;
			for (const [transferId, controller] of recoveryControllers) {
				controller.abort();
				delete controllers[transferId];
			}
		};
	}, [context.user.id, router]);

	useEffect(() => {
		const lifecycle = transfers.map((transfer) => `${transfer.id}:${transfer.status}:${transfer.uploadId ?? ""}`).join("|");
		const lifecycleChanged = lifecycle !== transferLifecycleRef.current;
		transferLifecycleRef.current = lifecycle;
		if (lifecycleChanged) {
			void persistRecoveredTransfers(context.user.id, transfers).catch(() => undefined);
			return;
		}
		const timer = window.setTimeout(() => {
			void persistRecoveredTransfers(context.user.id, transfers).catch(() => undefined);
		}, 500);
		return () => window.clearTimeout(timer);
	}, [context.user.id, transfers]);

  async function handleSubmitFolder(name: string) {
    setActionError(null);
    await clientApiFetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parent_id: currentFolderId, name, idempotency_key: crypto.randomUUID() }),
    });
    startTransition(() => router.refresh());
  }

  function updateTransfer(transferId: string, updates: Partial<TransferItem>) {
    setTransfers((current) =>
      current.map((transfer) => (transfer.id === transferId ? { ...transfer, ...updates } : transfer))
    );
  }

	async function handleRemoveTransfer(transferId: string) {
		const transfer = transfers.find((candidate) => candidate.id === transferId);
    cancelledTransfersRef.current.add(transferId);
    controllersRef.current[transferId]?.abort();
		if (transfer?.uploadId && transfer.status !== "done") {
			try {
				await clientApiFetch(`/api/uploads/${encodeURIComponent(transfer.uploadId)}/abort`, { method: "POST" });
			} catch (error) {
				setActionError(error instanceof Error ? error.message : "Failed to cancel upload.");
				return;
			}
		}
    delete controllersRef.current[transferId];
		delete transferFilesRef.current[transferId];
    setTransfers((current) => current.filter((transfer) => transfer.id !== transferId));
  }

	function handleToggleTransfer(transferId: string) {
		const transfer = transfers.find((candidate) => candidate.id === transferId);
		if (!transfer?.resumable) {
			return;
		}
		if (transfer.status === "uploading") {
			controllersRef.current[transferId]?.abort();
			return;
		}
		if (transfer.status === "paused") {
			const file = transferFilesRef.current[transferId];
			if (file) {
				void uploadTransfer(transferId, file, transfer.uploadId, transfer.conflictMode, transfer.targetPrefix, transfer.targetLabel, transfer.targetParentId);
			}
		}
	}

	function handleReselectTransfer(transferId: string, file: File) {
		const transfer = transfers.find((candidate) => candidate.id === transferId);
		if (!transfer || !transfer.uploadId || transfer.uploadMode !== "multipart") return;
		if (file.name !== transfer.fileName || file.size !== transfer.totalBytes) {
			updateTransfer(transferId, {
				status: "paused",
				canResume: false,
				errorMessage: "Choose the same file name and size that started this upload.",
				statusLabel: "Selected file does not match the interrupted upload",
			});
			return;
		}
		transferFilesRef.current[transferId] = file;
		updateTransfer(transferId, { canResume: true, errorMessage: undefined, statusLabel: "Resuming interrupted upload..." });
		void uploadTransfer(transferId, file, transfer.uploadId, transfer.conflictMode, transfer.targetPrefix, transfer.targetLabel, transfer.targetParentId);
	}

  async function uploadTransfer(transferId: string, file: File, existingUploadId?: string, conflictMode: "keep_both" | "new_version" = "keep_both", targetPrefix = currentPrefix, targetLabel = uploadTargetLabel, targetParentId = currentFolderId, refreshAfterComplete = true) {
    if (cancelledTransfersRef.current.delete(transferId)) return;
    const controller = new AbortController();
    controllersRef.current[transferId] = controller;

    const maxAttempts = 2;
    let lastError: unknown;

    try {
      updateTransfer(transferId, { status: "uploading", statusLabel: "Verifying file contents..." });
      const expectedSHA256 = await sha256File(file, controller.signal);
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        updateTransfer(transferId, {
          status: "uploading",
          transferredBytes: 0,
          statusLabel:
            attempt === 1
			  ? `Preparing upload to ${targetLabel}`
			  : `Retrying upload to ${targetLabel}`,
        });

        let reservation: BackendUploadReservation;
        try {
			reservation = existingUploadId ? await loadActiveUploadReservation(existingUploadId) : await clientApiFetch<BackendUploadReservation>("/api/uploads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
			  parent_id: targetParentId,
              name: file.name,
              size_bytes: file.size,
              mime_type: file.type || "application/octet-stream",
              idempotency_key: transferId,
			  conflict_mode: conflictMode,
              expected_sha256: expectedSHA256,
            }),
				});
        } catch (error) {
          lastError = error;
          if (isRetryablePresignError(error) && attempt < maxAttempts) {
            continue;
          }
          throw error;
        }
				if (reservation.expected_sha256 && reservation.expected_sha256 !== expectedSHA256) {
					throw new Error("Selected file contents do not match this interrupted upload.");
				}
        if (reservation.upload_mode === "single" && !reservation.url) {
          if (reservation.status === "completed") {
            updateTransfer(transferId, {
              transferredBytes: file.size,
              status: "done",
				  statusLabel: `Uploaded to ${targetLabel}`,
              errorMessage: undefined,
            });
            if (refreshAfterComplete) startTransition(() => router.refresh());
            return;
          }
          throw new Error(`Upload reservation is ${reservation.status} and cannot accept file data.`);
        }
				if (reservation.upload_mode === "multipart") existingUploadId = reservation.upload_id;
				updateTransfer(transferId, { uploadId: reservation.upload_id, uploadMode: reservation.upload_mode, partSize: reservation.part_size, uploadedParts: reservation.uploaded_parts, mimeType: reservation.mime_type, conflictMode, targetPrefix, targetLabel, targetParentId, expectedSHA256 });

        updateTransfer(transferId, {
          objectKey: reservation.key,
          statusLabel:
            attempt === 1
			  ? `Uploading to ${targetLabel}`
			  : `Retrying upload to ${targetLabel}`,
        });

        try {
          if (reservation.upload_mode === "multipart") {
            await uploadMultipartFile({
              reservation,
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
          } else {
            await uploadFileWithProgress({
              url: reservation.url!,
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
          }

			let completion = await requestUploadCompletion(reservation.upload_id, expectedSHA256, controller.signal);
			while (completion.status === "completing" || completion.processing_stage === "scanning") {
				updateTransfer(transferId, { transferredBytes: file.size, statusLabel: completion.processing_stage === "scanning" ? "Scanning upload for threats..." : "Verifying uploaded bytes..." });
				await abortableDelay(1000, controller.signal);
				completion = await requestUploadCompletion(reservation.upload_id, expectedSHA256, controller.signal);
			}
			if (completion.status !== "completed" || completion.processing_stage === "failed") {
				throw new Error("Upload security verification failed.");
			}

          updateTransfer(transferId, {
            transferredBytes: file.size,
            status: "done",
			statusLabel: `Uploaded to ${targetLabel}`,
            errorMessage: undefined,
          });
          if (refreshAfterComplete) startTransition(() => router.refresh());
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
				status: aborted && file.size > MULTIPART_UPLOAD_THRESHOLD ? "paused" : "error",
				statusLabel: aborted && file.size > MULTIPART_UPLOAD_THRESHOLD ? "Upload paused" : aborted ? "Upload canceled" : "Upload failed",
        errorMessage: aborted ? undefined : error instanceof Error ? error.message : "Upload failed",
      });
    } finally {
      delete controllersRef.current[transferId];
    }
  }

  function handleFilesSelected(files: FileList | null, conflictMode: "keep_both" | "new_version" = "keep_both") {
    if (!files || files.length === 0) {
      return;
    }
	const folderPaths = new Set<string>();
	const jobs = Array.from(files).map((file) => {
		const relativeSegments = file.webkitRelativePath.split("/").filter(Boolean);
		const directorySegments = relativeSegments.slice(0, -1);
		for (let depth = 1; depth <= directorySegments.length; depth += 1) {
			folderPaths.add(joinPath(directorySegments.slice(0, depth)));
		}
		const targetPrefix = joinPath([currentPrefix, ...directorySegments].filter(Boolean));
		const directoryPath = joinPath(directorySegments);
		const targetLabel = targetPrefix ? `My Archive / ${targetPrefix}` : uploadTargetLabel;
		const transferId = crypto.randomUUID();
		transferFilesRef.current[transferId] = file;
		return { transferId, file, directoryPath, targetPrefix, targetLabel, targetParentId: currentFolderId };
	});
	setTransfers((current) => [
		...jobs.map(({ transferId, file, targetPrefix, targetLabel, targetParentId }) => ({
			id: transferId,
			fileName: file.name,
			totalBytes: file.size,
			transferredBytes: 0,
			status: "queued" as const,
			statusLabel: "Waiting for upload slot...",
			targetLabel,
			targetPrefix,
			targetParentId,
			resumable: file.size > MULTIPART_UPLOAD_THRESHOLD,
			canResume: true,
			conflictMode,
		})),
		...current,
	]);
	const folderCreationBatchID = crypto.randomUUID();
	void (async () => {
		try {
			const folderIDs = new Map<string, string>([["", currentFolderId]]);
			const sortedFolderPaths = Array.from(folderPaths).sort((left, right) => left.split("/").length - right.split("/").length);
			for (const [folderIndex, relativePath] of sortedFolderPaths.entries()) {
				const segments = relativePath.split("/");
				const name = segments.at(-1)!;
				const parentPath = joinPath(segments.slice(0, -1));
				const parentID = folderIDs.get(parentPath);
				if (!parentID) throw new Error("The destination folder could not be resolved.");
				const folder = await clientApiFetch<{ id: string }>("/api/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ parent_id: parentID, name, idempotency_key: `${folderCreationBatchID}:folder:${folderIndex}` }) });
				folderIDs.set(relativePath, folder.id);
			}
			for (const job of jobs) {
				job.targetParentId = folderIDs.get(job.directoryPath) ?? currentFolderId;
				updateTransfer(job.transferId, { targetParentId: job.targetParentId });
			}
			let nextJob = 0;
			const worker = async () => {
				while (nextJob < jobs.length) {
					const job = jobs[nextJob++];
					if (cancelledTransfersRef.current.delete(job.transferId)) continue;
					await uploadTransfer(job.transferId, job.file, undefined, conflictMode, job.targetPrefix, job.targetLabel, job.targetParentId, false);
				}
			};
			await Promise.all(Array.from({ length: Math.min(3, jobs.length) }, () => worker()));
			startTransition(() => router.refresh());
		} catch (error) {
			const message = error instanceof Error ? error.message : "Folder upload preparation failed.";
			setActionError(message);
			for (const job of jobs) {
				updateTransfer(job.transferId, { status: "error", statusLabel: "Upload failed", errorMessage: message });
			}
		}
	})();
  }

  function handleOpenPreview(item: FileItem) {
    if (item.kind !== "file") {
      return;
    }
    const index = displayItems.findIndex((entry) => entry.id === item.id);
    if (index === -1) {
      return;
    }
    setSelectedId(item.id);
		void clientApiFetch(`/api/items/${encodeURIComponent(item.id)}/opened`, { method: "POST" });
    setPreviewIndex(index);
  }

	async function handleOpenShortcut(item: FileItem) {
		setActionError(null);
		try {
			const resolution = await clientApiFetch<BackendShortcutResolution>(`/api/items/${encodeURIComponent(item.id)}/shortcut`);
			if (resolution.broken || !resolution.target) {
				setActionError("This shortcut is broken or you no longer have access to its target.");
				return;
			}
			if (resolution.target.kind === "folder") {
				router.push(`/shared/${encodeURIComponent(resolution.target.id)}`);
				return;
			}
			if (resolution.target.kind !== "file") {
				setActionError("Shortcuts cannot point to another shortcut.");
				return;
			}
			const index = displayItems.findIndex((candidate) => candidate.id === item.id);
			if (index < 0) return;
			const target: FileItem = {
				id: resolution.target.id, bucketId: resolution.target.drive_id, kind: "file",
				fileType: inferPreviewFileType(resolution.target.name, resolution.target.mime_type ?? ""),
				name: resolution.target.name, slug: resolution.target.name, path: [], owner: item.owner,
				sizeBytes: resolution.target.size_bytes, tags: resolution.target.mime_type ? [resolution.target.mime_type] : undefined,
			};
			setShortcutPreviews((current) => ({ ...current, [item.id]: target }));
			setSelectedId(item.id);
			void clientApiFetch(`/api/items/${encodeURIComponent(item.id)}/opened`, { method: "POST" });
			setPreviewIndex(index);
		} catch (error) {
			setActionError(error instanceof Error ? error.message : "Failed to open shortcut.");
		}
	}

  async function handleDownload(item: FileItem) {
    setActionError(null);

    try {
		await clientApiFetch(`/api/items/${encodeURIComponent(item.id)}/opened`, { method: "POST" });
      const response = await clientApiFetch<BackendPresignResponse>(`/api/items/${encodeURIComponent(item.id)}/download`);
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
			await clientApiFetch(`/api/items/${encodeURIComponent(item.id)}/copy`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ parent_id: currentFolderId, idempotency_key: crypto.randomUUID() }),
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
		await clientApiFetch(`/api/items/${encodeURIComponent(item.id)}/trash`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idempotency_key: crypto.randomUUID() }) });

    setSelectedId((current) => (current === item.id ? null : current));
    startTransition(() => router.refresh());
  }

	async function handleRestore(item: FileItem) {
		setActionError(null);
		try {
			await clientApiFetch(`/api/items/${encodeURIComponent(item.id)}/restore`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idempotency_key: crypto.randomUUID() }) });
			setSelectedId((current) => (current === item.id ? null : current));
			startTransition(() => router.refresh());
		} catch (error) {
			setActionError(error instanceof Error ? error.message : "Failed to restore item.");
		}
	}

	async function handleRename(item: FileItem, name: string) {
		await clientApiFetch(`/api/items/${encodeURIComponent(item.id)}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name, idempotency_key: crypto.randomUUID() }),
		});
		startTransition(() => router.refresh());
	}

	async function handleFolderColor(item: FileItem, folderColor: string) {
		setActionError(null);
		try {
			await clientApiFetch(`/api/items/${encodeURIComponent(item.id)}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ folder_color: folderColor, idempotency_key: crypto.randomUUID() }),
			});
			setColorTarget(null);
			startTransition(() => router.refresh());
		} catch (error) {
			setActionError(error instanceof Error ? error.message : "Failed to update folder color.");
		}
	}

	async function handleCreateShortcut(item: FileItem) {
		setActionError(null);
		try {
			await clientApiFetch(`/api/items/${encodeURIComponent(item.id)}/shortcuts`, {
				method: "POST", headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ parent_id: currentFolderId, name: `Shortcut to ${item.name}`, idempotency_key: crypto.randomUUID() }),
			});
			startTransition(() => router.refresh());
		} catch (error) {
			setActionError(error instanceof Error ? error.message : "Failed to create shortcut.");
		}
	}

	async function handleMove(item: FileItem, parentID: string) {
		await clientApiFetch(`/api/items/${encodeURIComponent(item.id)}`, {
			method: "PATCH", headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ parent_id: parentID, idempotency_key: crypto.randomUUID() }),
		});
		setMoveTarget(null);
		startTransition(() => router.refresh());
	}

	function toggleSelected(itemID: string) {
		setSelectedIds((current) => {
			const next = new Set(current);
			if (next.has(itemID)) next.delete(itemID);
			else if (next.size < 100) next.add(itemID);
			return next;
		});
	}

	async function handleBatch(operation: "trash" | "restore" | "star" | "unstar") {
		if (selectedIds.size === 0) return;
		setActionError(null);
		try {
			const response = await clientApiFetch<BackendBatchResponse>("/api/items/batch", {
				method: "POST", headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ operation, item_ids: [...selectedIds], idempotency_key: crypto.randomUUID() }),
			});
			const succeeded = new Set(response.results.filter((result) => result.status === "succeeded").map((result) => result.item_id).filter((id): id is string => Boolean(id)));
			setSelectedIds((current) => new Set([...current].filter((id) => !succeeded.has(id))));
			if (response.failed > 0) {
				setActionError(`${response.succeeded} items updated; ${response.failed} failed. The failed items remain selected.`);
			}
			startTransition(() => router.refresh());
		} catch (error) {
			setActionError(error instanceof Error ? error.message : "Batch operation failed.");
		}
	}

	async function handleStar(item: FileItem) {
		setActionError(null);
		try {
			await clientApiFetch(`/api/items/${encodeURIComponent(item.id)}/star`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ starred: !item.starred, idempotency_key: crypto.randomUUID() }),
			});
			startTransition(() => router.refresh());
		} catch (error) {
			setActionError(error instanceof Error ? error.message : "Failed to update starred state.");
		}
	}

	async function handlePermanentDelete() {
		if (!permanentDeleteTarget) return;
		if (permanentDeleteTarget === "all") {
			await clientApiFetch("/api/trash", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idempotency_key: crypto.randomUUID() }) });
		} else {
			await clientApiFetch(`/api/items/${encodeURIComponent(permanentDeleteTarget.id)}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idempotency_key: crypto.randomUUID() }) });
		}
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
		) : isTrashView && context.items.length > 0 ? (
			<button type="button" onClick={() => setPermanentDeleteTarget("all")} className="rounded-full bg-[var(--color-danger)] px-4 py-3 text-sm font-semibold text-white">Empty Trash</button>
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
			onReselect={handleReselectTransfer}
        />
      }
    >
      <section className="grid gap-7">
        {context.path.length === 0 && context.collections.length > 0 ? (
          <CollectionsSection context={context} />
        ) : null}

        <section className="grid gap-5">
			{context.storageSummary ? <StorageSummaryCard summary={context.storageSummary} /> : null}
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
              <div className="relative" data-toolbar-dropdown>
                <GhostAction
                  icon={ArrowUpWideNarrow}
                  label="Sort"
                  onClick={() => { setSortOpen((v) => !v); setFilterOpen(false); }}
                  active={sortKey !== "default"}
                />
                {sortOpen ? (
                  <div className="absolute left-0 top-full z-50 mt-2 min-w-[200px] overflow-hidden rounded-[22px] border border-[var(--color-outline)] bg-[var(--color-surface-strong)] py-1 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
                    {SORT_OPTIONS.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => chooseSort(option.key)}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                          sortKey === option.key
                            ? "font-medium text-[var(--color-text)]"
                            : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-low)] hover:text-[var(--color-text)]"
                        )}
                      >
                        <Check size={14} className={cn("shrink-0", sortKey === option.key ? "opacity-100" : "opacity-0")} />
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="relative" data-toolbar-dropdown>
                <GhostAction
                  icon={TableProperties}
                  label="Filter"
                  onClick={() => { setFilterOpen((v) => !v); setSortOpen(false); }}
                  active={filterKind !== "all"}
                />
                {filterOpen ? (
                  <div className="absolute left-0 top-full z-50 mt-2 min-w-[200px] overflow-hidden rounded-[22px] border border-[var(--color-outline)] bg-[var(--color-surface-strong)] py-1 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
                    {FILTER_OPTIONS.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => { setFilterKind(option.key); setFilterOpen(false); }}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                          filterKind === option.key
                            ? "font-medium text-[var(--color-text)]"
                            : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-low)] hover:text-[var(--color-text)]"
                        )}
                      >
                        <Check size={14} className={cn("shrink-0", filterKind === option.key ? "opacity-100" : "opacity-0")} />
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center rounded-full bg-[var(--color-surface-low)] p-1 shadow-[inset_0_0_0_1px_var(--color-outline)]" aria-label="View mode">
				<button type="button" onClick={() => chooseView("list")} className={cn("rounded-full p-2", viewMode === "list" ? "bg-[var(--color-surface-strong)] text-[var(--color-primary)] shadow-sm" : "text-[var(--color-text-soft)]")} aria-label="List view" aria-pressed={viewMode === "list"}><List size={17} /></button>
				<button type="button" onClick={() => chooseView("grid")} className={cn("rounded-full p-2", viewMode === "grid" ? "bg-[var(--color-surface-strong)] text-[var(--color-primary)] shadow-sm" : "text-[var(--color-text-soft)]")} aria-label="Grid view" aria-pressed={viewMode === "grid"}><LayoutGrid size={17} /></button>
				<button type="button" onClick={toggleDensity} className={cn("rounded-full p-2", density === "compact" ? "bg-[var(--color-surface-strong)] text-[var(--color-primary)] shadow-sm" : "text-[var(--color-text-soft)]")} aria-label={density === "compact" ? "Use comfortable density" : "Use compact density"} aria-pressed={density === "compact"}><Rows3 size={17} /></button>
			  </div>

            </div>
          </div>

          {actionError ? (
            <div className="rounded-[24px] border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)] px-4 py-4 text-sm text-[var(--color-danger-text)]">
              {actionError}
            </div>
          ) : null}

		  {context.searchFilters ? <SearchFilterBar filters={context.searchFilters} /> : null}

		  {selectedIds.size > 0 ? (
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-[var(--color-secondary-soft)] px-4 py-3" aria-live="polite">
				<div><p className="text-sm font-semibold">{selectedIds.size} selected</p><p className="text-xs text-[var(--color-text-soft)]">Up to 100 items per batch · Esc clears selection</p></div>
				<div className="flex flex-wrap gap-2">
					{isTrashView ? <button type="button" onClick={() => void handleBatch("restore")} disabled={isPending} className="rounded-full bg-[var(--color-surface-strong)] px-4 py-2 text-sm font-medium disabled:opacity-50">Restore</button> : <>
						<button type="button" onClick={() => void handleBatch("star")} disabled={isPending} className="rounded-full bg-[var(--color-surface-strong)] px-4 py-2 text-sm font-medium disabled:opacity-50">Star</button>
						<button type="button" onClick={() => void handleBatch("unstar")} disabled={isPending} className="rounded-full bg-[var(--color-surface-strong)] px-4 py-2 text-sm font-medium disabled:opacity-50">Unstar</button>
						{canManageView ? <button type="button" onClick={() => void handleBatch("trash")} disabled={isPending} className="rounded-full bg-[var(--color-danger)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Move to trash</button> : null}
					</>}
					<button type="button" onClick={() => setSelectedIds(new Set())} className="rounded-full px-4 py-2 text-sm font-medium">Clear</button>
				</div>
			</div>
		  ) : null}

          <div className={cn("rounded-[32px] bg-[var(--color-surface-strong)] shadow-[0_12px_32px_rgba(26,28,25,0.06)]", viewMode === "list" && "overflow-hidden")}>
            <div className={cn("grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-5 py-4 text-xs uppercase tracking-[0.28em] text-[var(--color-text-soft)] sm:grid-cols-[minmax(0,1fr)_100px_auto] sm:px-6 md:grid-cols-[minmax(0,1.3fr)_140px_100px_auto]", viewMode === "grid" && "sr-only")}>
			  <span className="flex items-center gap-3"><input type="checkbox" aria-label="Select all visible items" checked={displayItems.length > 0 && displayItems.slice(0, 100).every((item) => selectedIds.has(item.id))} onChange={(event) => setSelectedIds(event.target.checked ? new Set(displayItems.slice(0, 100).map((item) => item.id)) : new Set())} className="h-4 w-4 accent-[var(--color-primary)]" />Name</span>
              <span className="hidden md:block">Modified</span>
              <span className="hidden sm:block">Size</span>
              <span className="justify-self-end">Actions</span>
            </div>

            {displayItems.length === 0 ? (
              filterKind !== "all" ? (
                <div className="grid place-items-center px-6 py-14 text-center">
                  <div className="max-w-md">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-[var(--color-surface-low)] text-[var(--color-primary)]">
                      <TableProperties size={22} />
                    </div>
                    <h3 className="font-heading mt-5 text-2xl font-semibold tracking-[-0.04em]">No matches</h3>
                    <p className="mt-3 text-sm leading-7 text-[var(--color-text-soft)]">No items match the current filter.</p>
                    <button
                      type="button"
                      onClick={() => setFilterKind("all")}
                      className="mt-6 rounded-full bg-[var(--color-surface-low)] px-4 py-3 text-sm font-medium text-[var(--color-text)] shadow-[inset_0_0_0_1px_var(--color-outline)]"
                    >
                      Clear filter
                    </button>
                  </div>
                </div>
              ) : (
                <EmptyArchiveState
                  message={context.emptyStateMessage ?? "No items are available in this view."}
                  onUpload={canManageView ? () => setUploadOpen(true) : undefined}
					onOpenArchiveHref={canManageView || isTrashView ? undefined : archiveHref}
                  onCreateFolder={canManageView ? () => setFolderOpen(true) : undefined}
                />
              )
            ) : (
              <div className={cn(viewMode === "grid" ? "grid gap-3 p-3 sm:grid-cols-2 2xl:grid-cols-3" : "grid")}>
                {displayItems.map((item) => {
					const href = item.kind !== "folder" ? undefined
						: context.section === "archive"
							? buildArchiveHref(context.bucket.id, [...item.path, item.slug])
							: context.section === "shared" || item.shared ? `/shared/${item.id}` : undefined;

                  return (
                    <article
                      key={item.id}
                      onClick={() => {
                        if (href) {
                          router.push(href);
                        }
                      }}
                      className={cn(
                        viewMode === "list"
							? "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 transition-colors sm:grid-cols-[minmax(0,1fr)_100px_auto] sm:px-6 md:grid-cols-[minmax(0,1.3fr)_140px_100px_auto]"
							: "flex min-h-[190px] flex-col gap-4 rounded-[24px] border border-[var(--color-outline)] p-5 transition-colors",
						viewMode === "list" && (density === "compact" ? "py-2.5" : "py-4"),
                        selectedItem?.id === item.id
                          ? "bg-[var(--color-secondary-soft)]/88"
                          : "hover:bg-[var(--color-surface-low)]/75",
                        href && "cursor-pointer"
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
						<input type="checkbox" aria-label={`Select ${item.name}`} checked={selectedIds.has(item.id)} onChange={() => toggleSelected(item.id)} onClick={(event) => event.stopPropagation()} className="h-4 w-4 shrink-0 accent-[var(--color-primary)]" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
							if (item.kind === "file" && !isTrashView) {
                              handleOpenPreview(item);
							} else if (item.kind === "shortcut" && !isTrashView) {
								void handleOpenShortcut(item);
                            } else if (href) {
                              router.push(href);
                            } else {
                              setSelectedId(item.id);
                            }
                          }}
                          className="flex min-w-0 items-center gap-3 text-left"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] bg-[var(--color-surface-low)] text-[var(--color-primary)]">
                            <ItemIcon kind={item.kind} fileType={item.fileType} folderColor={item.folderColor} />
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
                      <span className={cn("text-sm text-[var(--color-text-muted)]", viewMode === "list" ? "hidden md:block" : "mt-auto block")}>{readUpdatedLabel(item)}</span>
                      <span className={cn("text-sm text-[var(--color-text-muted)]", viewMode === "list" ? "hidden sm:block" : "block")}>
                        {item.sizeBytes !== undefined ? formatBytes(item.sizeBytes) : "--"}
                      </span>
                      <div className={cn("flex items-center gap-1 text-[var(--color-text-soft)] sm:gap-2", viewMode === "list" ? "justify-self-end" : "flex-wrap")} onClick={(e) => e.stopPropagation()}>
						{isTrashView ? (
							<>
							<button
								type="button"
								onClick={() => void handleRestore(item)}
								disabled={isPending}
								className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium hover:bg-[var(--color-surface-low)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-40"
								aria-label={`Restore ${item.name}`}
							>
								<RotateCcw size={16} />
								<span className="hidden sm:inline">Restore</span>
							</button>
							<button
								type="button"
								onClick={() => setPermanentDeleteTarget(item)}
								disabled={isPending}
								className="rounded-full p-2 text-[var(--color-danger-text)] hover:bg-[var(--color-danger-soft)] disabled:opacity-40"
								aria-label={`Delete ${item.name} forever`}
							>
								<Trash2 size={16} />
							</button>
							</>
						) : (
						<>
						{canManageView ? <button
							type="button"
							onClick={() => setRenameTarget(item)}
							disabled={isPending}
							className="rounded-full p-2 hover:bg-[var(--color-surface-low)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-40"
							aria-label={`Rename ${item.name}`}
						>
							<Pencil size={16} />
						</button> : null}
						{canManageView && item.kind === "folder" ? <button type="button" onClick={() => setColorTarget(item)} disabled={isPending} className="rounded-full p-2 hover:bg-[var(--color-surface-low)] hover:text-[var(--color-text)] disabled:opacity-40" aria-label={`Change color for ${item.name}`}><Palette size={16} /></button> : null}
						{canManageView && item.kind !== "shortcut" ? <button type="button" onClick={() => void handleCreateShortcut(item)} disabled={isPending} className="rounded-full p-2 hover:bg-[var(--color-surface-low)] hover:text-[var(--color-text)] disabled:opacity-40" aria-label={`Add shortcut to ${item.name}`}><Link2 size={16} /></button> : null}
						{canManageView ? <button type="button" onClick={() => setMoveTarget(item)} disabled={isPending} className="rounded-full p-2 hover:bg-[var(--color-surface-low)] hover:text-[var(--color-text)] disabled:opacity-40" aria-label={`Move ${item.name}`}><FolderInput size={16} /></button> : null}
						{canManageView ? (
							<button type="button" onClick={() => setShareTarget(item)} disabled={isPending} className="rounded-full p-2 hover:bg-[var(--color-surface-low)] hover:text-[var(--color-text)] disabled:opacity-40" aria-label={`Share ${item.name}`}>
								<Share2 size={16} />
							</button>
						) : null}
						{!isTrashView ? (
							<button type="button" onClick={() => setCommentsTarget(item)} className="rounded-full p-2 hover:bg-[var(--color-surface-low)] hover:text-[var(--color-text)]" aria-label={`Comments for ${item.name}`}><MessageSquare size={16} /></button>
						) : null}

						{!isTrashView ? (
							<button
								type="button"
								onClick={() => void handleStar(item)}
								disabled={isPending}
								className="rounded-full p-2 hover:bg-[var(--color-surface-low)] hover:text-[var(--color-text)] disabled:opacity-40"
								aria-label={item.starred ? `Remove star from ${item.name}` : `Star ${item.name}`}
							>
								<Star size={16} fill={item.starred ? "currentColor" : "none"} />
							</button>
						) : null}
                        {href ? (
                          <Link href={href} className="rounded-full p-2 hover:bg-[var(--color-surface-low)] hover:text-[var(--color-text)]">
                            <ChevronRight size={16} />
                          </Link>
						) : canManageView && item.kind === "file" ? (
                          <button
                            type="button"
                            onClick={() => void handleCopy(item)}
                            disabled={isPending}
                            className="rounded-full p-2 hover:bg-[var(--color-surface-low)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Copy ${item.name}`}
                          >
                            <Copy size={16} />
                          </button>
						) : null}

                        {item.kind === "file" ? (
							<button type="button" onClick={() => setVersionTarget(item)} className="rounded-full p-2 hover:bg-[var(--color-surface-low)]" aria-label={`Version history for ${item.name}`}><History size={16} /></button>
						) : null}

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

						{canManageView ? (
							<button
								type="button"
								onClick={() => requestDelete(item)}
								disabled={isPending}
								className="rounded-full p-2 hover:bg-[var(--color-surface-low)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-40"
								aria-label={`Delete ${item.name}`}
							>
								<Trash2 size={16} />
							</button>
						) : null}
						</>
						)}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-[22px] bg-[var(--color-surface-low)] px-5 py-4 text-sm text-[var(--color-text-muted)]">
			<span>{isTrashView ? "Items are automatically purged after 30 days." : "Browsing live files from your personal drive."}</span>
            <span>
              {filterKind !== "all"
                ? `${displayItems.length} of ${context.items.length} visible objects`
                : `${context.items.length} visible objects`}
            </span>
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
          {folderOpen ? <NewFolderDialog
            open={folderOpen}
            parentLabel={uploadTargetLabel}
            onClose={() => setFolderOpen(false)}
            onSubmit={handleSubmitFolder}
          /> : null}
        </>
      ) : null}

      {deleteTarget ? <DeleteDialog
        open={deleteTarget !== null}
        item={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={performDelete}
      /> : null}

		{renameTarget ? (
			<RenameDialog
				key={renameTarget.id}
				item={renameTarget}
				onClose={() => setRenameTarget(null)}
				onSubmit={(name) => handleRename(renameTarget, name)}
			/>
		) : null}

		{shareTarget ? <ShareDialog key={shareTarget.id} item={shareTarget} onClose={() => setShareTarget(null)} /> : null}

		{permanentDeleteTarget ? (
			<PermanentDeleteDialog
				item={permanentDeleteTarget === "all" ? undefined : permanentDeleteTarget}
				onClose={() => setPermanentDeleteTarget(null)}
				onConfirm={handlePermanentDelete}
			/>
		) : null}

		{versionTarget ? <VersionDialog key={versionTarget.id} item={versionTarget} canManage={canManageView} onClose={() => setVersionTarget(null)} /> : null}

		{commentsTarget ? <CommentsDialog key={commentsTarget.id} item={commentsTarget} onClose={() => setCommentsTarget(null)} /> : null}

		{colorTarget ? <FolderColorDialog key={colorTarget.id} item={colorTarget} onClose={() => setColorTarget(null)} onSubmit={(color) => handleFolderColor(colorTarget, color)} /> : null}

		{moveTarget ? <MoveDialog key={moveTarget.id} item={moveTarget} onClose={() => setMoveTarget(null)} onSubmit={(parentID) => handleMove(moveTarget, parentID)} /> : null}

		{!isTrashView ? <FilePreviewModal
        open={previewIndex !== null}
        items={previewItems}
        currentIndex={previewIndex ?? 0}
        onClose={() => setPreviewIndex(null)}
        onNavigate={(index) => {
          setPreviewIndex(index);
          const target = displayItems[index];
          if (target) {
            setSelectedId(target.id);
          }
        }}
        onDownload={handleDownload}
		/> : null}
    </AppShell>
  );
}

async function requestUploadCompletion(uploadId: string, expectedSHA256: string, signal: AbortSignal) {
	return clientApiFetch<BackendUploadReservation>(`/api/uploads/${encodeURIComponent(uploadId)}/complete`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ expected_sha256: expectedSHA256 }),
		signal,
	});
}

function abortableDelay(milliseconds: number, signal: AbortSignal) {
	return new Promise<void>((resolve, reject) => {
		const abort = () => {
			window.clearTimeout(timeout);
			reject(new DOMException("Upload aborted", "AbortError"));
		};
		const timeout = window.setTimeout(() => {
			signal.removeEventListener("abort", abort);
			resolve();
		}, milliseconds);
		signal.addEventListener("abort", abort, { once: true });
	});
}

function SearchFilterBar({ filters }: { filters: NonNullable<ArchiveContext["searchFilters"]> }) {
	const fieldClass = "rounded-[14px] bg-[var(--color-surface-strong)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none";
	return (
		<form action="/search" method="get" className="grid gap-3 rounded-[26px] bg-[var(--color-surface-low)] p-4 md:grid-cols-2 xl:grid-cols-4">
			<input type="hidden" name="q" value={filters.query} />
			<label className="grid gap-1.5 text-xs font-medium text-[var(--color-text-soft)]">Type
				<select name="type" defaultValue={filters.type ?? ""} className={fieldClass}>
					<option value="">Any type</option><option value="folder">Folder</option><option value="file">Any file</option><option value="image">Image</option><option value="video">Video</option><option value="audio">Audio</option><option value="pdf">PDF</option><option value="archive">Archive</option>
				</select>
			</label>
			<label className="grid gap-1.5 text-xs font-medium text-[var(--color-text-soft)]">Owner
				<input name="owner" defaultValue={filters.owner ?? ""} placeholder="me or email address" className={fieldClass} />
			</label>
			<label className="grid gap-1.5 text-xs font-medium text-[var(--color-text-soft)]">Shared
				<select name="shared" defaultValue={filters.shared ?? ""} className={fieldClass}><option value="">Any</option><option value="yes">Shared with me</option><option value="no">In my drive</option></select>
			</label>
			<label className="grid gap-1.5 text-xs font-medium text-[var(--color-text-soft)]">Starred
				<select name="starred" defaultValue={filters.starred ?? ""} className={fieldClass}><option value="">Any</option><option value="yes">Starred</option><option value="no">Not starred</option></select>
			</label>
			<label className="grid gap-1.5 text-xs font-medium text-[var(--color-text-soft)]">Modified after
				<input type="date" name="modified_after" defaultValue={filters.modifiedAfter ?? ""} className={fieldClass} />
			</label>
			<label className="grid gap-1.5 text-xs font-medium text-[var(--color-text-soft)]">Modified before
				<input type="date" name="modified_before" defaultValue={filters.modifiedBefore ?? ""} className={fieldClass} />
			</label>
			<label className="grid gap-1.5 text-xs font-medium text-[var(--color-text-soft)]">Trash
				<select name="trash" defaultValue={filters.trash ?? ""} className={fieldClass}><option value="">Exclude trash</option><option value="only">Only trash</option><option value="all">Include trash</option></select>
			</label>
			<div className="flex items-end gap-2">
				<button type="submit" className="primary-gradient rounded-full px-4 py-2.5 text-sm font-semibold text-white">Apply filters</button>
				<Link href={`/search?q=${encodeURIComponent(filters.query)}`} className="rounded-full bg-[var(--color-surface-strong)] px-4 py-2.5 text-sm font-medium">Clear</Link>
			</div>
		</form>
	);
}

async function loadActiveUploadReservation(uploadId: string): Promise<BackendUploadReservation> {
	return clientApiFetch<BackendUploadReservation>(`/api/uploads/${encodeURIComponent(uploadId)}`);
}

async function uploadMultipartFile({
	reservation,
	file,
	signal,
	onProgress,
}: {
	reservation: BackendUploadReservation;
	file: File;
	signal: AbortSignal;
	onProgress: (loadedBytes: number) => void;
}) {
	const partSize = reservation.part_size;
	if (!partSize || partSize <= 0) {
		throw new Error("Multipart upload did not provide a valid part size.");
	}
	const partCount = Math.ceil(file.size / partSize);
	const completedParts = new Map(
		(reservation.uploaded_parts ?? []).map((part) => [part.part_number, part.size]),
	);
	let completedBytes = Array.from(completedParts.values()).reduce((sum, size) => sum + size, 0);
	onProgress(completedBytes);

	const missingParts = Array.from({ length: partCount }, (_, index) => index + 1)
		.filter((partNumber) => !completedParts.has(partNumber));
	for (let batchStart = 0; batchStart < missingParts.length; batchStart += PRESIGNED_PART_BATCH_SIZE) {
		const partNumbers = missingParts.slice(batchStart, batchStart + PRESIGNED_PART_BATCH_SIZE);
		const presigned = await clientApiFetch<BackendUploadPartURLs>(
			`/api/uploads/${encodeURIComponent(reservation.upload_id)}/parts/presign`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ part_numbers: partNumbers }),
			},
		);
		const urls = new Map(presigned.parts.map((part) => [part.part_number, part.url]));
		const inFlight = new Map<number, number>();
		await Promise.all(partNumbers.map(async (partNumber) => {
			const url = urls.get(partNumber);
			if (!url) {
				throw new Error(`Multipart upload did not provide a URL for part ${partNumber}.`);
			}
			const start = (partNumber - 1) * partSize;
			const end = Math.min(start + partSize, file.size);
			const part = file.slice(start, end, file.type || "application/octet-stream");
			await uploadBlobWithProgress({
				url,
				data: part,
				signal,
				onProgress: (loadedBytes) => {
					inFlight.set(partNumber, loadedBytes);
					onProgress(completedBytes + Array.from(inFlight.values()).reduce((sum, bytes) => sum + bytes, 0));
				},
			});
			completedBytes += part.size;
			inFlight.delete(partNumber);
			onProgress(completedBytes);
		}));
	}
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
                  <button type="button" aria-label={`More options for ${collection.title}`} className="rounded-full p-2 text-[var(--color-text-soft)] opacity-0 transition-opacity group-hover:opacity-100">
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

    </section>
  );
}

export function ArchiveSectionView({ context }: { context: ArchiveContext }) {
  return <ArchiveBrowserView context={context} />;
}

function StorageSummaryCard({ summary }: { summary: NonNullable<ArchiveContext["storageSummary"]> }) {
	const used = summary.committedBytes + summary.reservedBytes;
	const percent = summary.quotaBytes > 0 ? Math.min(100, (used / summary.quotaBytes) * 100) : 0;
	return (
		<section className="rounded-[28px] bg-[var(--color-surface-low)] p-5 sm:p-6" aria-label="Storage usage">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<p className="text-xs uppercase tracking-[0.24em] text-[var(--color-text-soft)]">Storage used</p>
					<p className="font-heading mt-2 text-2xl font-semibold">{formatBytes(used)} of {formatBytes(summary.quotaBytes)}</p>
				</div>
				<p className="text-sm text-[var(--color-text-muted)]">{summary.objectCount.toLocaleString()} files</p>
			</div>
			<div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--color-surface-highest)]">
				<div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${percent}%` }} />
			</div>
			<div className="mt-4 grid gap-2 text-sm text-[var(--color-text-muted)] sm:grid-cols-3">
				<span>Files and retained uploads: {formatBytes(Math.max(0, summary.committedBytes - summary.trashBytes - summary.versionBytes))}</span>
				<span>Trash: {formatBytes(summary.trashBytes)}</span>
				<span>Version history: {formatBytes(summary.versionBytes)}</span>
			</div>
			<p className="mt-3 text-xs text-[var(--color-text-muted)]">Uploads awaiting verification or cleanup count toward your storage limit. Uploads in progress reserve {formatBytes(summary.reservedBytes)}.</p>
		</section>
	);
}

function DetailsPanel({ item }: { item: FileItem | null }) {
	const [activityState, setActivityState] = useState<{ itemId: string; events: BackendActivityEvent[] } | null>(null);

	useEffect(() => {
		if (!item) return;
		let cancelled = false;
		clientApiFetch<BackendActivityResponse>(`/api/items/${encodeURIComponent(item.id)}/activity?limit=8`)
			.then((response) => { if (!cancelled) setActivityState({ itemId: item.id, events: response.events }); })
			.catch(() => { if (!cancelled) setActivityState({ itemId: item.id, events: [] }); });
		return () => { cancelled = true; };
	}, [item]);

  if (!item) {
    return (
      <div>
        <p className="text-sm text-[var(--color-text-soft)]">Select an item to inspect its archive details.</p>
      </div>
    );
  }
	const activityLoading = activityState?.itemId !== item.id;
	const activity = activityState?.itemId === item.id ? activityState.events : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-text-soft)]">Details</p>
        <button type="button" aria-label="More details options" className="rounded-full bg-[var(--color-surface-low)] p-2 text-[var(--color-text-soft)]">
          <MoreHorizontal size={16} />
        </button>
      </div>

      <div className="rounded-[32px] bg-[var(--color-surface-high)] p-5">
        <span className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[var(--color-surface-strong)] text-[var(--color-primary)]">
          <ItemIcon kind={item.kind} fileType={item.fileType} folderColor={item.folderColor} />
        </span>
        <h3 className="font-heading mt-6 text-2xl font-semibold tracking-[-0.04em] break-all">{item.name}</h3>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          {item.kind === "folder" ? "Folder" : item.fileType?.toUpperCase() ?? "Object"}
        </p>
      </div>

      <DetailRow label="Location" value={item.path.join(" / ") || "My Archive"} />
      <DetailRow label="Owner" value={item.owner} />
      <DetailRow label="Updated" value={item.updatedAt ? formatDateLabel(item.updatedAt) : "--"} />
      <DetailRow label="Size" value={item.sizeBytes !== undefined ? formatBytes(item.sizeBytes) : "--"} />
      <DetailRow label="Classification" value={item.tags?.join(" · ") ?? "Personal Archive"} />

		<div className="space-y-3">
			<p className="text-xs uppercase tracking-[0.3em] text-[var(--color-text-soft)]">Activity</p>
			{activityLoading ? <p className="text-sm text-[var(--color-text-soft)]">Loading activity...</p> : activity.length === 0 ? <p className="text-sm text-[var(--color-text-soft)]">No activity recorded yet.</p> : activity.map((event) => (
				<div key={event.id} className="rounded-[22px] bg-[var(--color-surface-strong)] px-4 py-3">
					<p className="text-sm text-[var(--color-text)]"><span className="font-medium">{event.actor_name}</span> {activityLabel(event.event_type)}</p>
					<p className="mt-1 text-xs text-[var(--color-text-soft)]">{formatDateLabel(event.created_at)}</p>
				</div>
			))}
		</div>
    </div>
  );
}

function activityLabel(eventType: string) {
	const labels: Record<string, string> = {
		"file.uploaded": "uploaded this file",
		"file.downloaded": "downloaded this file",
		"file.previewed": "previewed this file",
		"item.opened": "opened this item",
		"item.renamed": "renamed this item",
		"item.moved": "moved this item",
		"item.trashed": "moved this item to trash",
		"item.restored": "restored this item",
		"permission.granted": "shared this item",
		"comment.created": "commented on this item",
		"comment.replied": "replied to a comment",
		"comment.updated": "edited a comment",
		"comment.deleted": "deleted a comment",
		"comment.resolved": "resolved a comment thread",
		"comment.reopened": "reopened a comment thread",
		"version.restored": "restored a previous version",
		"version.retention_updated": "changed version retention",
	};
	return labels[eventType] ?? eventType.replaceAll(".", " ");
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

function GhostAction({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: typeof ArrowUpWideNarrow;
  label: string;
  onClick?: () => void;
  active?: boolean;
	}) {
	  return (
	    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm shadow-[inset_0_0_0_1px_var(--color-outline)] transition-colors duration-300",
        active
          ? "bg-[var(--color-primary-soft)] text-[var(--color-text)]"
          : "bg-[var(--color-surface-low)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      )}
    >
      <Icon size={16} />
      {label}
	    </button>
	  );
}

function ItemIcon({
  kind,
  fileType,
  folderColor,
}: {
  kind: FileItem["kind"];
  fileType?: FileItem["fileType"];
	folderColor?: string;
}) {
  if (kind === "folder") {
    return <Folder size={18} style={{ color: folderColorValue(folderColor) }} />;
  }
	if (kind === "shortcut") {
		return <Link2 size={18} />;
	}

  switch (fileType) {
    case "image":
    case "raw":
      return <ImageIcon size={18} />;
    case "csv":
    case "text":
      return <TableProperties size={18} />;
    case "video":
    case "audio":
      return <ArrowDownToLine size={18} />;
    case "pdf":
      return <PersonStanding size={18} />;
    default:
      return <Shield size={18} />;
  }
}

function inferPreviewFileType(name: string, mimeType: string): FileItem["fileType"] {
	const lowerName = name.toLowerCase();
	if (mimeType.startsWith("image/")) return /\.(raw|cr2|nef|arw|dng)$/i.test(lowerName) ? "raw" : "image";
	if (mimeType.startsWith("video/")) return "video";
	if (mimeType.startsWith("audio/")) return "audio";
	if (mimeType === "application/pdf") return "pdf";
	if (mimeType.includes("csv") || lowerName.endsWith(".csv")) return "csv";
	if (mimeType.startsWith("text/")) return "text";
	return "other";
}

function folderColorValue(color: string | undefined) {
	switch (color) {
	case "red": return "#dc5a5a";
	case "orange": return "#d9792b";
	case "yellow": return "#c49a22";
	case "green": return "#3f8f63";
	case "blue": return "#3978c8";
	case "purple": return "#8060c7";
	case "gray": return "#72777d";
	default: return undefined;
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
