"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--color-surface)] px-6 py-16 text-[var(--color-text)]">
      <section className="ambient-panel w-full max-w-lg rounded-[32px] p-8 text-center">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-text-soft)]">Connection problem</p>
        <h1 className="font-heading mt-3 text-3xl font-semibold">Drive could not load this page</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">Your files were not changed. Check the connection and try the request again.</p>
        <button type="button" onClick={reset} className="primary-gradient mt-6 rounded-full px-5 py-3 text-sm font-semibold text-white">Try again</button>
      </section>
    </main>
  );
}
