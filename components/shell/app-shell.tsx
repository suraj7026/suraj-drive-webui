"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Menu, Search, Sparkles, X } from "lucide-react";
import { clientApiFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { navItems } from "@/lib/theme/navigation";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import type { CurrentUser } from "@/lib/models/auth";
import { SessionDialog } from "@/components/shell/session-dialog";
import { useDialogFocus } from "@/lib/ui/use-dialog-focus";

type AppShellProps = {
  user: CurrentUser;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  detail?: ReactNode;
  transferDrawer?: ReactNode;
  headerAction?: ReactNode;
  newObjectHref?: string;
  onNewObjectClick?: () => void;
};

export function AppShell({
  user,
  title,
  eyebrow = "The Archive",
  children,
  detail,
  transferDrawer,
  headerAction,
  newObjectHref,
  onNewObjectClick,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
	const [sessionsOpen, setSessionsOpen] = useState(false);
  const [isLoggingOut, startLogoutTransition] = useTransition();
  const searchQuery = searchParams.get("q") ?? "";
  const userInitials = useMemo(() => initialsFromName(user.name), [user.name]);
  const closeMobileNavigation = useCallback(() => setMobileNavigationOpen(false), []);
  const mobileNavigationRef = useDialogFocus(mobileNavigationOpen, closeMobileNavigation);

  useEffect(() => {
    if (!mobileNavigationOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavigationOpen]);

  async function handleLogout() {
    setLogoutError(null);

    try {
      await clientApiFetch("/api/auth/logout", { method: "POST" });
      startLogoutTransition(() => {
        router.push("/login");
        router.refresh();
      });
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Failed to sign out.");
    }
  }

  return (
	<div className="archive-shell h-[100dvh] overflow-hidden">
	  {sessionsOpen ? <SessionDialog onClose={() => setSessionsOpen(false)} /> : null}
      {mobileNavigationOpen ? (
        <div ref={mobileNavigationRef} tabIndex={-1} className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Drive navigation">
          <button
            type="button"
            tabIndex={-1}
            className="absolute inset-0 bg-black/35 backdrop-blur-sm"
            onClick={() => setMobileNavigationOpen(false)}
            aria-label="Close navigation"
          />
          <aside className="ambient-panel relative flex h-full w-[min(88vw,340px)] flex-col overflow-y-auto rounded-r-[34px] p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[var(--color-surface-strong)] text-[var(--color-primary)]">
                  <Sparkles size={19} />
                </div>
                <div>
                  <p className="font-heading text-lg font-semibold">Drive</p>
                  <p className="text-xs text-[var(--color-text-soft)]">Personal Cloud Drive</p>
                </div>
              </div>
              <button
                type="button"
                data-autofocus
                onClick={() => setMobileNavigationOpen(false)}
                className="rounded-full p-3 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-low)]"
                aria-label="Close navigation"
              >
                <X size={20} />
              </button>
            </div>

            {onNewObjectClick ? (
              <button
                type="button"
                onClick={() => {
                  setMobileNavigationOpen(false);
                  onNewObjectClick();
                }}
                className="primary-gradient mt-7 flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold text-white"
              >
                New
              </button>
            ) : (
              <Link
                href={newObjectHref ?? `/archive/${user.drive_id}`}
                className="primary-gradient mt-7 flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold text-white"
              >
                New
              </Link>
            )}

            <nav className="mt-7 flex-1 space-y-2">
              {navItems.map((item) => {
                const active = item.match(pathname);
                const Icon = item.icon;
                const href = item.href === "/archive/my-archive" ? `/archive/${user.drive_id}` : item.href;
                return (
                  <Link
                    key={item.href}
                    href={href}
                    onClick={() => setMobileNavigationOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-[20px] px-4 py-3 text-[15px] font-medium",
                      active
                        ? "bg-[var(--color-surface-strong)] text-[var(--color-text)]"
                        : "text-[var(--color-text-muted)] hover:bg-[var(--color-hover-overlay)]"
                    )}
                  >
                    <Icon size={18} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {transferDrawer ? <div className="mt-6 min-w-0">{transferDrawer}</div> : null}
            <ThemeToggle className="mt-6" />
            <div className="mt-4 rounded-[24px] bg-[var(--color-surface-strong)] px-4 py-4">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-[var(--color-text-soft)]">{user.email}</p>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="mt-3 w-full rounded-full bg-[var(--color-surface-low)] px-4 py-2.5 text-sm font-medium disabled:opacity-60"
              >
                {isLoggingOut ? "Signing out..." : "Sign out"}
              </button>
			  <button type="button" onClick={() => setSessionsOpen(true)} className="mt-2 w-full rounded-full px-4 py-2.5 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-low)]">Manage sessions</button>
            </div>
          </aside>
        </div>
      ) : null}
      <div className="flex h-full w-full gap-4 px-4 py-4 sm:px-6 xl:px-8">
        <aside className="ambient-panel hidden w-[280px] shrink-0 overflow-y-auto rounded-[34px] p-6 lg:flex lg:flex-col">
          <div>
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[var(--color-surface-strong)] text-[var(--color-primary)] shadow-[0_18px_38px_var(--color-primary-glow-soft)]">
                <Sparkles size={20} />
              </div>
              <div>
                <p className="font-heading text-lg font-semibold">Drive</p>
                <p className="text-sm text-[var(--color-text-soft)]">Personal Cloud Archive</p>
              </div>
            </div>

            {onNewObjectClick ? (
              <button
                type="button"
                onClick={onNewObjectClick}
                className="primary-gradient flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_var(--color-primary-glow)]"
              >
                New Object
              </button>
            ) : (
              <Link
                href={newObjectHref ?? `/archive/${user.drive_id}`}
                className="primary-gradient flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_var(--color-primary-glow)]"
              >
                New Object
              </Link>
            )}
          </div>

          <nav className="mt-10 flex-1 space-y-2">
            {navItems.map((item) => {
              const active = item.match(pathname);
              const Icon = item.icon;
              const href = item.href === "/archive/my-archive" ? `/archive/${user.drive_id}` : item.href;

              return (
                <Link
                  key={item.href}
                  href={href}
                  className={cn(
                    "flex items-center justify-between rounded-[20px] px-4 py-3 transition-all duration-200",
                    active
                      ? "bg-[var(--color-surface-strong)] text-[var(--color-text)] shadow-[0_10px_30px_rgba(25,28,30,0.08)]"
                      : "text-[var(--color-text-muted)] hover:bg-[var(--color-hover-overlay)] hover:text-[var(--color-text)]"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <Icon size={18} />
                    <span className="text-[15px] font-medium">{item.label}</span>
                  </span>
                  {item.badge ? (
                    <span className="rounded-full bg-[var(--color-surface-low)] px-2.5 py-1 text-xs text-[var(--color-text-soft)]">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          {transferDrawer ? <div className="mt-6 min-w-0">{transferDrawer}</div> : null}

          <div className="surface-grid mt-6 rounded-[24px] bg-[var(--color-surface-high)] px-4 py-5">
            <p className="text-xs uppercase tracking-[0.26em] text-[var(--color-text-soft)]">Personal Mode</p>
            <p className="font-heading mt-3 text-xl font-semibold leading-8">A private archive built for one careful curator.</p>
          </div>

          <ThemeToggle className="mt-4" />

          <div className="mt-4 rounded-[24px] bg-[var(--color-surface-strong)] px-4 py-5 shadow-[0_12px_32px_rgba(26,28,25,0.05)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-surface-low)] text-sm font-semibold text-[var(--color-primary)]">
                {userInitials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--color-text)]">{user.name}</p>
                <p className="truncate text-xs text-[var(--color-text-soft)]">{user.email}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="mt-4 w-full rounded-full bg-[var(--color-surface-low)] px-4 py-3 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-high)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggingOut ? "Signing out..." : "Sign out"}
            </button>
			<button type="button" onClick={() => setSessionsOpen(true)} className="mt-2 w-full rounded-full px-4 py-2.5 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-low)]">Manage sessions</button>

            {logoutError ? <p className="mt-3 text-xs text-[var(--color-danger-text)]">{logoutError}</p> : null}
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
          <header className="ambient-panel shrink-0 rounded-[34px] px-5 py-4 sm:px-7">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setMobileNavigationOpen(true)}
                  className="mt-0.5 rounded-full bg-[var(--color-surface-low)] p-3 text-[var(--color-text)] lg:hidden"
                  aria-label="Open navigation"
                  aria-expanded={mobileNavigationOpen}
                >
                  <Menu size={20} />
                </button>
                <div>
                  <p className="text-xs uppercase tracking-[0.32em] text-[var(--color-text-soft)]">{eyebrow}</p>
                  <h1 className="font-heading mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-[2.6rem]">
                    {title}
                  </h1>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <form action="/search" method="get" className="flex min-w-0 flex-1 items-center gap-3 rounded-full bg-[var(--color-surface-low)] px-4 py-3 shadow-[inset_0_0_0_1px_var(--color-outline)] sm:min-w-[320px]">
                  <Search size={18} className="text-[var(--color-text-soft)]" />
                  <input
                    key={searchQuery}
                    name="q"
                    aria-label="Search archive"
                    defaultValue={searchQuery}
                    placeholder="Search by object, folder, or note"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-text-soft)]"
                  />
                </form>

                <div className="flex items-center gap-2">
                  {headerAction}
                </div>
              </div>
            </div>
          </header>

          <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <main className="ambient-panel min-h-0 min-w-0 overflow-y-auto rounded-[36px] px-5 py-5 sm:px-8 sm:py-7">
              {children}
            </main>
            {detail ? (
              <aside className="ambient-panel hidden min-h-0 overflow-y-auto rounded-[36px] px-6 py-7 xl:block">
                {detail}
              </aside>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function initialsFromName(name: string) {
  const segments = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (segments.length === 0) {
    return "SD";
  }

  return segments.map((segment) => segment[0]?.toUpperCase() ?? "").join("");
}
