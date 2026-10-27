"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Check, CornerDownRight, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { clientApiFetch } from "@/lib/api/client";
import type { BackendComment, BackendCommentsResponse } from "@/lib/models/backend";
import type { FileItem } from "@/lib/models/archive";
import { formatDateLabel } from "@/lib/utils/format";
import { Modal } from "@/components/ui/modal";

export function CommentsDialog({ item, onClose }: { item: FileItem; onClose: () => void }) {
	const [comments, setComments] = useState<BackendComment[]>([]);
	const [body, setBody] = useState("");
	const [replyTo, setReplyTo] = useState<BackendComment | null>(null);
	const [editing, setEditing] = useState<BackendComment | null>(null);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		clientApiFetch<BackendCommentsResponse>(`/api/items/${encodeURIComponent(item.id)}/comments`)
			.then((response) => { if (!cancelled) setComments(response.comments); })
			.catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Failed to load comments."); })
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [item.id]);

	const threads = useMemo(() => comments.filter((comment) => !comment.parent_id), [comments]);
	const replies = useMemo(() => {
		const grouped = new Map<string, BackendComment[]>();
		for (const comment of comments) {
			if (!comment.parent_id) continue;
			grouped.set(comment.parent_id, [...(grouped.get(comment.parent_id) ?? []), comment]);
		}
		return grouped;
	}, [comments]);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!body.trim()) return;
		setSubmitting(true);
		setError(null);
		try {
			if (editing) {
				const updated = await clientApiFetch<BackendComment>(`/api/items/${encodeURIComponent(item.id)}/comments/${encodeURIComponent(editing.id)}`, {
					method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }),
				});
				setComments((current) => current.map((comment) => comment.id === updated.id ? updated : comment));
			} else {
				const created = await clientApiFetch<BackendComment>(`/api/items/${encodeURIComponent(item.id)}/comments`, {
					method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, parent_id: replyTo?.id }),
				});
				setComments((current) => [...current, created]);
			}
			setBody("");
			setReplyTo(null);
			setEditing(null);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : "Failed to save comment.");
		} finally {
			setSubmitting(false);
		}
	}

	async function remove(comment: BackendComment) {
		setError(null);
		try {
			await clientApiFetch(`/api/items/${encodeURIComponent(item.id)}/comments/${encodeURIComponent(comment.id)}`, { method: "DELETE" });
			setComments((current) => current.map((entry) => entry.id === comment.id ? { ...entry, body: "", deleted: true, can_edit: false } : entry));
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : "Failed to delete comment.");
		}
	}

	async function setResolved(comment: BackendComment, resolved: boolean) {
		setError(null);
		try {
			const updated = await clientApiFetch<BackendComment>(`/api/items/${encodeURIComponent(item.id)}/comments/${encodeURIComponent(comment.id)}/${resolved ? "resolve" : "reopen"}`, { method: "POST" });
			setComments((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : "Failed to update the comment thread.");
		}
	}

	function beginEdit(comment: BackendComment) {
		setEditing(comment);
		setReplyTo(null);
		setBody(comment.body);
	}

	function beginReply(comment: BackendComment) {
		setReplyTo(comment);
		setEditing(null);
		setBody("");
	}

	return (
		<Modal open onClose={onClose} title={`Comments on “${item.name}”`} description="Use @email to mention someone who already has access." className="max-w-[700px]">
			<div className="max-h-[52vh] space-y-4 overflow-y-auto pr-1">
				{loading ? <p className="py-6 text-sm text-[var(--color-text-soft)]">Loading comments...</p> : threads.length === 0 ? <p className="py-6 text-sm text-[var(--color-text-soft)]">No comments yet.</p> : threads.map((thread) => (
					<div key={thread.id} className={`rounded-[24px] p-4 ${thread.resolved_at ? "bg-[var(--color-surface-low)] opacity-75" : "bg-[var(--color-surface-high)]"}`}>
						<CommentCard comment={thread} onReply={beginReply} onEdit={beginEdit} onDelete={remove} onResolved={setResolved} />
						{(replies.get(thread.id) ?? []).map((reply) => (
							<div key={reply.id} className="mt-3 border-l-2 border-[var(--color-outline)] pl-4"><CommentCard comment={reply} onEdit={beginEdit} onDelete={remove} /></div>
						))}
					</div>
				))}
			</div>
			{error ? <p className="mt-3 text-sm text-[var(--color-danger-text)]">{error}</p> : null}
			<form onSubmit={submit} className="mt-5 space-y-3 border-t border-[var(--color-outline)] pt-4">
				{replyTo || editing ? <div className="flex items-center justify-between text-xs text-[var(--color-text-soft)]"><span>{editing ? `Editing your comment` : `Replying to ${replyTo?.author_name}`}</span><button type="button" onClick={() => { setReplyTo(null); setEditing(null); setBody(""); }} className="font-medium text-[var(--color-primary)]">Cancel</button></div> : null}
				<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={10000} rows={3} placeholder={replyTo ? "Write a reply..." : "Add a comment..."} className="w-full resize-none rounded-[20px] bg-[var(--color-surface-low)] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40" />
				<div className="flex justify-end"><button type="submit" disabled={submitting || !body.trim()} className="primary-gradient rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{submitting ? "Saving..." : editing ? "Save" : replyTo ? "Reply" : "Comment"}</button></div>
			</form>
		</Modal>
	);
}

function CommentCard({ comment, onReply, onEdit, onDelete, onResolved }: {
	comment: BackendComment;
	onReply?: (comment: BackendComment) => void;
	onEdit?: (comment: BackendComment) => void;
	onDelete?: (comment: BackendComment) => void;
	onResolved?: (comment: BackendComment, resolved: boolean) => void;
}) {
	return <div>
		<div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{comment.author_name}</p><p className="text-xs text-[var(--color-text-soft)]">{formatDateLabel(comment.updated_at)}</p></div>{comment.resolved_at ? <span className="rounded-full bg-[var(--color-success-soft)] px-2 py-1 text-xs text-[var(--color-success-text)]">Resolved</span> : null}</div>
		<p className={`mt-3 whitespace-pre-wrap text-sm ${comment.deleted ? "italic text-[var(--color-text-soft)]" : "text-[var(--color-text)]"}`}>{comment.deleted ? "Comment deleted" : comment.body}</p>
		<div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--color-text-soft)]">
			{comment.can_reply && onReply ? <button type="button" onClick={() => onReply(comment)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-[var(--color-surface-strong)]"><CornerDownRight size={13} /> Reply</button> : null}
			{comment.can_edit && onEdit ? <button type="button" onClick={() => onEdit(comment)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-[var(--color-surface-strong)]"><Pencil size={13} /> Edit</button> : null}
			{comment.can_edit && onDelete ? <button type="button" onClick={() => void onDelete(comment)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger-text)]"><Trash2 size={13} /> Delete</button> : null}
			{comment.can_resolve && onResolved ? <button type="button" onClick={() => void onResolved(comment, !comment.resolved_at)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-[var(--color-surface-strong)]">{comment.resolved_at ? <RotateCcw size={13} /> : <Check size={13} />}{comment.resolved_at ? "Reopen" : "Resolve"}</button> : null}
		</div>
	</div>;
}
