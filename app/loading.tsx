export default function Loading() {
  return (
    <main className="min-h-[100dvh] bg-[var(--color-surface)] p-6" aria-busy="true" aria-label="Loading Drive">
      <div className="mx-auto grid max-w-6xl animate-pulse gap-5">
        <div className="h-20 rounded-[28px] bg-[var(--color-surface-high)]" />
        <div className="h-12 w-64 rounded-full bg-[var(--color-surface-high)]" />
        <div className="h-[55dvh] rounded-[32px] bg-[var(--color-surface-high)]" />
      </div>
    </main>
  );
}
