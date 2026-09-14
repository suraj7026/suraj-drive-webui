"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Copy, Link2, RotateCcw, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { clientApiFetch } from "@/lib/api/client";
import type { BackendItemPermission, BackendPermissionsResponse, BackendShareInvitation, BackendShareLink, BackendShareLinksResponse } from "@/lib/models/backend";
import type { FileItem } from "@/lib/models/archive";

export function ShareDialog({ item, onClose }: { item: FileItem; onClose: () => void }) {
	const [permissions, setPermissions] = useState<BackendItemPermission[]>([]);
	const [invitations, setInvitations] = useState<BackendShareInvitation[]>([]);
	const [links, setLinks] = useState<BackendShareLink[]>([]);
	const [linkRole, setLinkRole] = useState<BackendShareLink["role"]>("viewer");
	const [linkDownload, setLinkDownload] = useState(true);
	const [newLinkURL, setNewLinkURL] = useState<string | null>(null);
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<BackendItemPermission["role"]>("viewer");
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		Promise.all([
			clientApiFetch<BackendPermissionsResponse>(`/api/items/${encodeURIComponent(item.id)}/permissions`),
			clientApiFetch<BackendShareLinksResponse>(`/api/items/${encodeURIComponent(item.id)}/links`),
		])
			.then(([response, linkResponse]) => {
				if (!cancelled) {
					setPermissions(response.permissions);
					setInvitations(response.invitations ?? []);
					setLinks(linkResponse.links);
				}
			})
			.catch((reason) => {
				if (!cancelled) setError(reason instanceof Error ? reason.message : "Failed to load sharing settings.");
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => { cancelled = true; };
	}, [item.id]);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!email.trim()) return;
		setSubmitting(true);
		setError(null);
		try {
			const result = await clientApiFetch<BackendItemPermission | BackendShareInvitation>(`/api/items/${encodeURIComponent(item.id)}/permissions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: email.trim(), role }),
			});
			if ("user_id" in result) {
				setPermissions((current) => [...current.filter((entry) => entry.user_id !== result.user_id), result]);
			} else {
				setInvitations((current) => [...current.filter((entry) => entry.email.toLowerCase() !== result.email.toLowerCase()), result]);
			}
			setEmail("");
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : "Failed to share item.");
		} finally {
			setSubmitting(false);
		}
	}

	async function revoke(permission: BackendItemPermission) {
		setError(null);
		try {
			await clientApiFetch(`/api/items/${encodeURIComponent(item.id)}/permissions/${encodeURIComponent(permission.id)}`, { method: "DELETE" });
			setPermissions((current) => current.filter((entry) => entry.id !== permission.id));
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : "Failed to remove access.");
		}
	}

	async function revokeInvitation(invitation: BackendShareInvitation) {
		setError(null);
		try {
			await clientApiFetch(`/api/items/${encodeURIComponent(item.id)}/invitations/${encodeURIComponent(invitation.id)}`, { method: "DELETE" });
			setInvitations((current) => current.filter((entry) => entry.id !== invitation.id));
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : "Failed to revoke invitation.");
		}
	}

	async function resendInvitation(invitation: BackendShareInvitation) {
		setError(null);
		try {
			const updated = await clientApiFetch<BackendShareInvitation>(`/api/items/${encodeURIComponent(item.id)}/invitations/${encodeURIComponent(invitation.id)}/resend`, { method: "POST" });
			setInvitations((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : "Failed to resend invitation.");
		}
	}

	async function createLink() {
		setSubmitting(true);
		setError(null);
		try {
			const link = await clientApiFetch<BackendShareLink>(`/api/items/${encodeURIComponent(item.id)}/links`, {
				method: "POST", headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ role: linkRole, allow_download: linkDownload }),
			});
			setLinks((current) => [link, ...current]);
			setNewLinkURL(link.url ?? null);
			if (link.url) await navigator.clipboard.writeText(link.url).catch(() => undefined);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : "Failed to create public link.");
		} finally {
			setSubmitting(false);
		}
	}

	async function revokeLink(link: BackendShareLink) {
		setError(null);
		try {
			await clientApiFetch(`/api/items/${encodeURIComponent(item.id)}/links/${encodeURIComponent(link.id)}`, { method: "DELETE" });
			setLinks((current) => current.filter((entry) => entry.id !== link.id));
			if (newLinkURL === link.url) setNewLinkURL(null);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : "Failed to revoke public link.");
		}
	}

	return (
		<Modal open onClose={onClose} title={`Share “${item.name}”`} description="Give an existing Drive user access by email." className="max-w-[560px]">
			<form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_auto]">
				<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" aria-label="Email address" className="rounded-full bg-[var(--color-surface-low)] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40" />
				<select value={role} onChange={(event) => setRole(event.target.value as BackendItemPermission["role"])} aria-label="Permission role" className="rounded-full bg-[var(--color-surface-low)] px-4 py-3 text-sm outline-none">
					<option value="viewer">Viewer</option>
					<option value="commenter">Commenter</option>
					<option value="editor">Editor</option>
				</select>
				<button type="submit" disabled={submitting} className="primary-gradient rounded-full px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Sharing..." : "Share"}</button>
			</form>
			{error ? <p className="mt-3 text-sm text-[var(--color-danger-text)]">{error}</p> : null}
			<div className="mt-6 grid gap-2">
				<p className="text-xs uppercase tracking-[0.22em] text-[var(--color-text-soft)]">People with access</p>
				{loading ? <p className="py-4 text-sm text-[var(--color-text-muted)]">Loading access...</p> : permissions.length === 0 ? <p className="py-4 text-sm text-[var(--color-text-muted)]">Only drive members currently have access.</p> : permissions.map((permission) => (
					<div key={permission.id} className="flex items-center justify-between gap-3 rounded-[20px] bg-[var(--color-surface-low)] px-4 py-3">
						<div className="min-w-0"><p className="truncate text-sm font-medium">{permission.display_name}</p><p className="truncate text-xs text-[var(--color-text-soft)]">{permission.email} · {permission.role}</p></div>
						<button type="button" onClick={() => void revoke(permission)} aria-label={`Remove access for ${permission.email}`} className="rounded-full p-2 text-[var(--color-text-soft)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger-text)]"><Trash2 size={16} /></button>
					</div>
				))}
			</div>
			{invitations.length > 0 ? <div className="mt-6 grid gap-2">
				<p className="text-xs uppercase tracking-[0.22em] text-[var(--color-text-soft)]">Pending invitations</p>
				{invitations.map((invitation) => <div key={invitation.id} className="flex items-center justify-between gap-3 rounded-[20px] bg-[var(--color-surface-low)] px-4 py-3">
					<div className="min-w-0"><p className="truncate text-sm font-medium">{invitation.email}</p><p className="truncate text-xs text-[var(--color-text-soft)]">Pending · {invitation.role}</p></div>
					<div className="flex gap-1"><button type="button" onClick={() => void resendInvitation(invitation)} aria-label={`Resend invitation to ${invitation.email}`} className="rounded-full p-2 text-[var(--color-text-soft)] hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-text)]"><RotateCcw size={16} /></button><button type="button" onClick={() => void revokeInvitation(invitation)} aria-label={`Revoke invitation for ${invitation.email}`} className="rounded-full p-2 text-[var(--color-text-soft)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger-text)]"><Trash2 size={16} /></button></div>
				</div>)}
			</div> : null}
			<div className="mt-6 border-t border-[var(--color-outline)] pt-5">
				<div className="flex items-center gap-2"><Link2 size={16} /><p className="text-xs uppercase tracking-[0.22em] text-[var(--color-text-soft)]">Public links</p></div>
				<div className="mt-3 grid gap-2 sm:grid-cols-[140px_1fr_auto]">
					<select value={linkRole} onChange={(event) => setLinkRole(event.target.value as BackendShareLink["role"])} className="rounded-full bg-[var(--color-surface-low)] px-4 py-2.5 text-sm"><option value="viewer">Viewer</option><option value="commenter">Commenter</option></select>
					<label className="flex items-center gap-2 rounded-full bg-[var(--color-surface-low)] px-4 py-2.5 text-sm"><input type="checkbox" checked={linkDownload} onChange={(event) => setLinkDownload(event.target.checked)} /> Allow download</label>
					<button type="button" onClick={() => void createLink()} disabled={submitting} className="primary-gradient rounded-full px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Create link</button>
				</div>
				{newLinkURL ? <div className="mt-3 flex items-center gap-2 rounded-[18px] bg-[var(--color-success-soft)] px-4 py-3"><p className="min-w-0 flex-1 truncate text-sm">{newLinkURL}</p><button type="button" onClick={() => void navigator.clipboard.writeText(newLinkURL)} aria-label="Copy public link" className="rounded-full p-2"><Copy size={16} /></button></div> : null}
				{links.length > 0 ? <div className="mt-3 grid gap-2">{links.map((link) => <div key={link.id} className="flex items-center justify-between rounded-[18px] bg-[var(--color-surface-low)] px-4 py-3"><p className="text-sm">{link.role} · {link.allow_download ? "downloads allowed" : "view only"}</p><button type="button" onClick={() => void revokeLink(link)} aria-label="Revoke public link" className="rounded-full p-2 hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger-text)]"><Trash2 size={16} /></button></div>)}</div> : null}
				<p className="mt-2 text-xs text-[var(--color-text-soft)]">For security, a public URL is shown only when created. Save it before closing this dialog.</p>
			</div>
		</Modal>
	);
}
