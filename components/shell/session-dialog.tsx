"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Laptop, Smartphone } from "lucide-react";
import { clientApiFetch } from "@/lib/api/client";
import type { BackendAuthSession } from "@/lib/models/backend";
import { formatDateLabel } from "@/lib/utils/format";
import { Modal } from "@/components/ui/modal";

export function SessionDialog({ onClose }: { onClose: () => void }) {
	const router = useRouter();
	const [sessions, setSessions] = useState<BackendAuthSession[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		clientApiFetch<{ sessions: BackendAuthSession[] }>("/api/auth/sessions")
			.then((response) => { if (!cancelled) setSessions(response.sessions); })
			.catch((loadError) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Failed to load sessions."); })
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, []);

	async function revoke(session: BackendAuthSession) {
		setPending(session.id);
		setError(null);
		try {
			const response = await clientApiFetch<{ current: boolean }>(`/api/auth/sessions/${encodeURIComponent(session.id)}`, { method: "DELETE" });
			if (response.current) {
				router.replace("/login");
				router.refresh();
				return;
			}
			setSessions((current) => current.filter((candidate) => candidate.id !== session.id));
		} catch (revokeError) {
			setError(revokeError instanceof Error ? revokeError.message : "Failed to revoke session.");
		} finally {
			setPending(null);
		}
	}

	async function revokeOthers() {
		setPending("others");
		setError(null);
		try {
			await clientApiFetch("/api/auth/sessions/revoke-others", { method: "POST" });
			setSessions((current) => current.filter((session) => session.current));
		} catch (revokeError) {
			setError(revokeError instanceof Error ? revokeError.message : "Failed to revoke other sessions.");
		} finally {
			setPending(null);
		}
	}

	return (
		<Modal open onClose={onClose} title="Devices and sessions" description="Review where your Drive account is signed in." className="max-w-2xl">
			<div className="flex max-h-[calc(100dvh-13rem)] flex-col">
				<div className="mt-5 min-h-32 flex-1 space-y-3 overflow-y-auto">
					{loading ? <p className="text-sm text-[var(--color-text-soft)]">Loading sessions…</p> : sessions.map((session) => {
						const mobile = /mobile|iphone|android/i.test(session.user_agent ?? "");
						const Icon = mobile ? Smartphone : Laptop;
						return <div key={session.id} className="flex items-start gap-4 rounded-[22px] bg-[var(--color-surface-low)] p-4"><span className="rounded-[14px] bg-[var(--color-surface-strong)] p-3 text-[var(--color-primary)]"><Icon size={19} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{session.user_agent || "Unknown device"}</p><p className="mt-1 text-xs text-[var(--color-text-soft)]">{session.ip_address || "Unknown IP"} · Last active {formatDateLabel(session.last_seen_at)}</p>{session.current ? <span className="mt-2 inline-flex rounded-full bg-[var(--color-secondary-soft)] px-2.5 py-1 text-xs font-medium">Current session</span> : null}</div><button type="button" onClick={() => void revoke(session)} disabled={pending !== null} className="rounded-full px-3 py-2 text-xs font-medium text-[var(--color-danger-text)] hover:bg-[var(--color-danger-soft)] disabled:opacity-40">{pending === session.id ? "Revoking…" : "Revoke"}</button></div>;
					})}
				</div>
				{error ? <p className="mt-4 text-sm text-[var(--color-danger-text)]">{error}</p> : null}
				<div className="mt-5 flex justify-end"><button type="button" onClick={() => void revokeOthers()} disabled={pending !== null || sessions.filter((session) => !session.current).length === 0} className="rounded-full bg-[var(--color-danger)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">{pending === "others" ? "Revoking…" : "Revoke all other sessions"}</button></div>
			</div>
		</Modal>
	);
}
