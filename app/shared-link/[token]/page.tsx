import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, File, Folder, ShieldCheck } from "lucide-react";
import { serverApiFetch } from "@/lib/api/server";
import type { BackendListResponse, BackendPresignResponse, BackendPublicLinkItem } from "@/lib/models/backend";
import { formatBytes } from "@/lib/utils/format";
import { ApiError } from "@/lib/api/core";

export const metadata: Metadata = {
	title: "Shared item · Suraj Drive",
	robots: { index: false, follow: false, nocache: true },
};

export default async function SharedLinkPage({ params, searchParams }: {
	params: Promise<{ token: string }>;
	searchParams: Promise<{ parent_id?: string; file_id?: string }>;
}) {
	const { token } = await params;
	const query = await searchParams;
	let root: BackendPublicLinkItem;
	try {
		root = await serverApiFetch<BackendPublicLinkItem>(`/api/public/links/${encodeURIComponent(token)}`);
	} catch (error) {
		if (error instanceof ApiError && (error.status === 404 || error.status === 410)) notFound();
		throw error;
	}

	let listing: BackendListResponse | null = null;
	let previewURL = root.preview_url;
	let selectedName = root.name;
	let selectedID = root.id;
	let selectedMimeType = root.mime_type ?? "application/octet-stream";
	if (root.kind === "folder") {
		const suffix = query.parent_id ? `?parent_id=${encodeURIComponent(query.parent_id)}` : "";
		try {
			listing = await serverApiFetch<BackendListResponse>(`/api/public/links/${encodeURIComponent(token)}/children${suffix}`);
			if (query.file_id) {
				const preview = await serverApiFetch<BackendPresignResponse>(`/api/public/links/${encodeURIComponent(token)}/items/${encodeURIComponent(query.file_id)}/preview`);
				previewURL = preview.url;
				selectedID = query.file_id;
				selectedName = listing.files.find((file) => file.id === query.file_id)?.name ?? "Shared file";
				selectedMimeType = listing.files.find((file) => file.id === query.file_id)?.content_type ?? "application/octet-stream";
			}
		} catch (error) {
			if (error instanceof ApiError && (error.status === 404 || error.status === 410)) notFound();
			throw error;
		}
	}

	let downloadURL: string | undefined;
	if (previewURL && root.allow_download) {
		try {
			const download = await serverApiFetch<BackendPresignResponse>(`/api/public/links/${encodeURIComponent(token)}/items/${encodeURIComponent(selectedID)}/download`);
			downloadURL = download.url;
		} catch {
			downloadURL = undefined;
		}
	}

	return <main className="min-h-screen bg-[var(--color-surface)] px-4 py-8 text-[var(--color-text)] sm:px-8">
		<div className="mx-auto max-w-6xl">
			<header className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] bg-[var(--color-surface-high)] px-5 py-4 shadow-[0_20px_60px_rgba(20,25,30,0.08)]">
				<div><p className="font-heading text-xl font-semibold">Suraj Drive</p><p className="mt-1 text-xs text-[var(--color-text-soft)]">Public shared item</p></div>
				<div className="flex items-center gap-2 rounded-full bg-[var(--color-success-soft)] px-3 py-2 text-xs text-[var(--color-success-text)]"><ShieldCheck size={15} /> Link access</div>
			</header>

			<section className="mt-6 rounded-[32px] bg-[var(--color-surface-high)] p-5 sm:p-7">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div><p className="text-xs uppercase tracking-[0.24em] text-[var(--color-text-soft)]">Shared {root.kind}</p><h1 className="font-heading mt-2 text-3xl font-semibold tracking-[-0.04em] break-all">{root.name}</h1>{root.kind === "file" ? <p className="mt-2 text-sm text-[var(--color-text-muted)]">{root.mime_type || "File"} · {formatBytes(root.size_bytes ?? 0)}</p> : null}</div>
					{downloadURL ? <a href={downloadURL} className="primary-gradient inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white"><Download size={16} /> Download</a> : null}
				</div>

				{previewURL ? <div className="mt-6 overflow-hidden rounded-[24px] bg-black/5"><div className="flex items-center justify-between bg-[var(--color-surface-low)] px-4 py-3"><p className="truncate text-sm font-medium">{selectedName}</p>{root.kind === "folder" ? <Link href={`/shared-link/${encodeURIComponent(token)}${query.parent_id ? `?parent_id=${encodeURIComponent(query.parent_id)}` : ""}`} className="text-sm text-[var(--color-primary)]">Close preview</Link> : null}</div><PublicPreview url={previewURL} name={selectedName} mimeType={selectedMimeType} /></div> : null}

				{listing ? <div className="mt-6 grid gap-2">
					{query.parent_id ? <Link href={`/shared-link/${encodeURIComponent(token)}`} className="mb-2 text-sm font-medium text-[var(--color-primary)]">Back to shared folder</Link> : null}
					{listing.folders.map((folder) => <Link key={folder.id} href={`/shared-link/${encodeURIComponent(token)}?parent_id=${encodeURIComponent(folder.id)}`} className="flex items-center gap-3 rounded-[20px] bg-[var(--color-surface-low)] px-4 py-3 hover:bg-[var(--color-surface-strong)]"><Folder size={19} className="text-[var(--color-primary)]" /><span className="truncate text-sm font-medium">{folder.name}</span></Link>)}
					{listing.files.map((file) => <Link key={file.id} href={`/shared-link/${encodeURIComponent(token)}?${query.parent_id ? `parent_id=${encodeURIComponent(query.parent_id)}&` : ""}file_id=${encodeURIComponent(file.id)}`} className="flex items-center justify-between gap-3 rounded-[20px] bg-[var(--color-surface-low)] px-4 py-3 hover:bg-[var(--color-surface-strong)]"><span className="flex min-w-0 items-center gap-3"><File size={19} className="shrink-0 text-[var(--color-text-soft)]" /><span className="truncate text-sm font-medium">{file.name}</span></span><span className="text-xs text-[var(--color-text-soft)]">{formatBytes(file.size)}</span></Link>)}
					{listing.folders.length === 0 && listing.files.length === 0 ? <p className="py-10 text-center text-sm text-[var(--color-text-soft)]">This folder is empty.</p> : null}
					{listing.pagination.has_more ? <p className="py-3 text-center text-xs text-[var(--color-text-soft)]">This public view is limited to the first 500 items.</p> : null}
				</div> : null}
			</section>
			<p className="mt-4 text-center text-xs text-[var(--color-text-soft)]">Only continue if you trust the person who shared this link.</p>
		</div>
	</main>;
}

function PublicPreview({ url, name, mimeType }: { url: string; name: string; mimeType: string }) {
	if (mimeType.startsWith("image/") && mimeType !== "image/svg+xml") {
		// eslint-disable-next-line @next/next/no-img-element
		return <img src={url} alt={name} referrerPolicy="no-referrer" className="mx-auto block max-h-[70vh] max-w-full object-contain" />;
	}
	if (mimeType.startsWith("video/")) {
		return <video src={url} controls className="mx-auto block max-h-[70vh] max-w-full bg-black" />;
	}
	if (mimeType.startsWith("audio/")) {
		return <div className="p-8"><audio src={url} controls className="w-full" /></div>;
	}
	if (mimeType === "application/pdf") {
		return <iframe title={`Preview of ${name}`} src={url} sandbox="" referrerPolicy="no-referrer" className="h-[70vh] w-full border-0 bg-white" />;
	}
	return <div className="px-6 py-12 text-center text-sm text-[var(--color-text-soft)]">This file type is not rendered in a public page. Download it only if you trust the sender.</div>;
}
