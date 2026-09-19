"use client";

import { useEffect, useState } from "react";
import { ArrowDownToLine, Pin, RotateCcw } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { clientApiFetch } from "@/lib/api/client";
import type { BackendFileVersion, BackendPresignResponse, BackendVersionsResponse } from "@/lib/models/backend";
import type { FileItem } from "@/lib/models/archive";
import { formatBytes, formatDateLabel } from "@/lib/utils/format";

export function VersionDialog({ item, canManage, onClose }: { item: FileItem; canManage: boolean; onClose: () => void }) {
	const [versions, setVersions] = useState<BackendFileVersion[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		clientApiFetch<BackendVersionsResponse>(`/api/items/${encodeURIComponent(item.id)}/versions`)
			.then((response) => { if (!cancelled) setVersions(response.versions); })
			.catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Failed to load versions."); })
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [item.id]);

	async function download(version: BackendFileVersion) {
		setError(null);
		try {
			const response = await clientApiFetch<BackendPresignResponse>(`/api/items/${encodeURIComponent(item.id)}/versions/${encodeURIComponent(version.id)}/download`);
			window.open(response.url, "_blank", "noopener,noreferrer");
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : "Failed to download version.");
		}
	}

	async function toggleRetention(version: BackendFileVersion) {
		setError(null);
		try {
			await clientApiFetch(`/api/items/${encodeURIComponent(item.id)}/versions/${encodeURIComponent(version.id)}/retention`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keep_forever: !version.keep_forever, idempotency_key: crypto.randomUUID() }) });
			setVersions((current) => current.map((entry) => entry.id === version.id ? { ...entry, keep_forever: !entry.keep_forever } : entry));
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : "Failed to update version retention.");
		}
	}

	async function restore(version: BackendFileVersion) {
		setError(null);
		try {
			await clientApiFetch(`/api/items/${encodeURIComponent(item.id)}/versions/${encodeURIComponent(version.id)}/restore`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idempotency_key: crypto.randomUUID() }) });
			setVersions((current) => current.map((entry) => ({ ...entry, is_current: entry.id === version.id })));
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : "Failed to restore version.");
		}
	}

	return (
		<Modal open onClose={onClose} title={`Version history for “${item.name}”`} description="Previous file bytes are immutable. Keep important versions from retention cleanup." className="max-w-[600px]">
			{error ? <p className="mb-3 text-sm text-[var(--color-danger-text)]">{error}</p> : null}
			{loading ? <p className="py-6 text-sm text-[var(--color-text-muted)]">Loading versions...</p> : versions.length === 0 ? <p className="py-6 text-sm text-[var(--color-text-muted)]">No ready versions are available.</p> : (
				<div className="grid gap-2">{versions.map((version) => (
					<div key={version.id} className="flex items-center justify-between gap-3 rounded-[20px] bg-[var(--color-surface-low)] px-4 py-3">
						<div className="min-w-0"><p className="text-sm font-medium">Version {version.version_number}{version.is_current ? " · Current" : ""}</p><p className="text-xs text-[var(--color-text-soft)]">{formatDateLabel(version.ready_at)} · {formatBytes(version.size_bytes)}{version.keep_forever ? " · Kept forever" : ""}</p></div>
						<div className="flex shrink-0 gap-1">{canManage && !version.is_current ? <button type="button" onClick={() => void restore(version)} className="rounded-full p-2 hover:bg-[var(--color-surface-strong)]" aria-label={`Restore version ${version.version_number}`}><RotateCcw size={16} /></button> : null}{canManage ? <button type="button" onClick={() => void toggleRetention(version)} className="rounded-full p-2 hover:bg-[var(--color-surface-strong)]" aria-label={version.keep_forever ? "Use standard retention" : "Keep forever"}><Pin size={16} fill={version.keep_forever ? "currentColor" : "none"} /></button> : null}<button type="button" onClick={() => void download(version)} className="rounded-full p-2 hover:bg-[var(--color-surface-strong)]" aria-label={`Download version ${version.version_number}`}><ArrowDownToLine size={16} /></button></div>
					</div>
				))}</div>
			)}
		</Modal>
	);
}
