"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Folder } from "lucide-react";
import { clientApiFetch } from "@/lib/api/client";
import type { BackendFolderEntry, BackendListResponse } from "@/lib/models/backend";
import type { FileItem } from "@/lib/models/archive";
import { Modal } from "@/components/ui/modal";

type FolderLocation = { id: string; name: string };

export function MoveDialog({ item, onClose, onSubmit }: {
	item: FileItem;
	onClose: () => void;
	onSubmit: (parentID: string) => Promise<void>;
}) {
	const [folders, setFolders] = useState<BackendFolderEntry[]>([]);
	const [path, setPath] = useState<FolderLocation[]>([]);
	const [currentFolderID, setCurrentFolderID] = useState("");
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		clientApiFetch<BackendListResponse>("/api/files?limit=200")
			.then((response) => {
				if (cancelled) return;
				setCurrentFolderID(response.current_folder_id ?? "");
				setFolders(response.folders);
			})
			.catch((loadError) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Failed to load folders."); })
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, []);

	async function openFolder(folder: FolderLocation) {
		setLoading(true);
		setError(null);
		try {
			const response = await clientApiFetch<BackendListResponse>(`/api/items/${encodeURIComponent(folder.id)}/children?limit=200`);
			setPath((current) => [...current, folder]);
			setCurrentFolderID(response.current_folder_id ?? folder.id);
			setFolders(response.folders);
		} catch (loadError) {
			setError(loadError instanceof Error ? loadError.message : "Failed to open folder.");
		} finally {
			setLoading(false);
		}
	}

	async function goBack() {
		if (path.length === 0) return;
		setLoading(true);
		setError(null);
		const nextPath = path.slice(0, -1);
		try {
			const response = nextPath.length === 0
				? await clientApiFetch<BackendListResponse>("/api/files?limit=200")
				: await clientApiFetch<BackendListResponse>(`/api/items/${encodeURIComponent(nextPath.at(-1)!.id)}/children?limit=200`);
			setPath(nextPath);
			setCurrentFolderID(response.current_folder_id ?? nextPath.at(-1)?.id ?? "");
			setFolders(response.folders);
		} catch (loadError) {
			setError(loadError instanceof Error ? loadError.message : "Failed to open folder.");
		} finally {
			setLoading(false);
		}
	}

	async function submit() {
		if (!currentFolderID) return;
		setSubmitting(true);
		setError(null);
		try {
			await onSubmit(currentFolderID);
		} catch (submitError) {
			setError(submitError instanceof Error ? submitError.message : "Move failed.");
			setSubmitting(false);
		}
	}

	return (
		<Modal open onClose={onClose} title={`Move “${item.name}”`} className="max-w-lg">
			<div className="flex max-h-[calc(100dvh-12rem)] flex-col">
				<div className="mt-4 flex items-center gap-2 text-sm text-[var(--color-text-soft)]">
					<button type="button" onClick={() => void goBack()} disabled={path.length === 0 || loading} className="rounded-full p-2 hover:bg-[var(--color-surface-low)] disabled:opacity-30" aria-label="Go to parent folder"><ChevronLeft size={18} /></button>
					<span className="truncate">My Drive{path.length ? ` / ${path.map((folder) => folder.name).join(" / ")}` : ""}</span>
				</div>
				<div className="mt-4 min-h-48 flex-1 overflow-y-auto rounded-[22px] bg-[var(--color-surface-low)] p-2">
					{loading ? <p className="p-4 text-sm text-[var(--color-text-soft)]">Loading folders…</p> : folders.length === 0 ? <p className="p-4 text-sm text-[var(--color-text-soft)]">This folder has no subfolders.</p> : folders.map((folder) => (
						<button key={folder.id} type="button" onClick={() => void openFolder({ id: folder.id, name: folder.name })} className="flex w-full items-center gap-3 rounded-[16px] px-3 py-3 text-left hover:bg-[var(--color-surface-strong)]">
							<Folder size={18} style={{ color: folderColorValue(folder.folder_color) }} /><span className="min-w-0 flex-1 truncate text-sm font-medium">{folder.name}</span><ChevronRight size={16} className="text-[var(--color-text-soft)]" />
						</button>
					))}
				</div>
				{error ? <p className="mt-3 text-sm text-[var(--color-danger-text)]">{error}</p> : null}
				<div className="mt-5 flex justify-end gap-2">
					<button type="button" onClick={onClose} className="rounded-full px-4 py-3 text-sm font-medium">Cancel</button>
					<button type="button" onClick={() => void submit()} disabled={!currentFolderID || loading || submitting} className="primary-gradient rounded-full px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Moving…" : "Move here"}</button>
				</div>
			</div>
		</Modal>
	);
}

function folderColorValue(color?: string) {
	return ({ red: "#dc5a5a", orange: "#d9792b", yellow: "#c49a22", green: "#3f8f63", blue: "#3978c8", purple: "#8060c7", gray: "#72777d" } as Record<string, string>)[color ?? ""];
}
