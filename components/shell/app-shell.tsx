"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useState, useTransition } from "react";
import { Menu, Search, X } from "lucide-react";
import { clientApiFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { navItems } from "@/lib/theme/navigation";
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
  eyebrow = "the archive",
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
        <div ref={mobileNavigationRef} tabIndex={-1} className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="drive navigation">
          <button
            type="button"
            tabIndex={-1}
            className="absolute inset-0 bg-black/35 backdrop-blur-sm"
            onClick={() => setMobileNavigationOpen(false)}
            aria-label="close navigation"
          />
          <aside className="ambient-panel relative flex h-full w-[min(88vw,340px)] flex-col overflow-y-auto rounded-r-[34px] p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-heading text-lg font-light">drive</p>
                <p className="text-xs text-[var(--color-text-soft)]">your files, in one place</p>
              </div>
              <button
                type="button"
                data-autofocus
                onClick={() => setMobileNavigationOpen(false)}
                className="rounded-full p-3 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-low)]"
                aria-label="close navigation"
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
                new
              </button>
            ) : (
              <Link
                href={newObjectHref ?? `/archive/${user.drive_id}`}
                className="primary-gradient mt-7 flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold text-white"
              >
                new
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
            <AccountActions
              user={user}
              pathname={pathname}
              isLoggingOut={isLoggingOut}
              logoutError={logoutError}
              onLogout={() => void handleLogout()}
              onSessions={() => {
                setMobileNavigationOpen(false);
                setSessionsOpen(true);
              }}
              onNavigate={() => setMobileNavigationOpen(false)}
              className="mt-6"
            />
          </aside>
        </div>
      ) : null}
      <div className="flex h-full w-full gap-4 px-4 py-4 sm:px-6 xl:px-8">
        <aside className="ambient-panel hidden w-[280px] shrink-0 overflow-y-auto rounded-[34px] p-6 lg:flex lg:flex-col">
          <div>
            <div className="mb-8">
              <p className="font-heading text-2xl font-light">drive</p>
              <p className="text-sm text-[var(--color-text-soft)]">your files, in one place</p>
            </div>

            {onNewObjectClick ? (
              <button
                type="button"
                onClick={onNewObjectClick}
                className="primary-gradient flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_var(--color-primary-glow)]"
              >
                new
              </button>
            ) : (
              <Link
                href={newObjectHref ?? `/archive/${user.drive_id}`}
                className="primary-gradient flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_var(--color-primary-glow)]"
              >
                new
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
                  aria-current={active ? "page" : undefined}
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
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
          <header className="ambient-panel shrink-0 rounded-[34px] px-5 py-4 sm:px-7">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setMobileNavigationOpen(true)}
                  className="mt-0.5 bg-[var(--color-surface-low)] p-3 text-[var(--color-text)] lg:hidden"
                  aria-label="open navigation"
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

              <div className="flex flex-col items-stretch gap-4 xl:items-end">
                <AccountActions
                  user={user}
                  pathname={pathname}
                  isLoggingOut={isLoggingOut}
                  logoutError={logoutError}
                  onLogout={() => void handleLogout()}
                  onSessions={() => setSessionsOpen(true)}
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <form action="/search" method="get" className="flex min-w-0 flex-1 items-center gap-3 bg-[var(--color-surface-low)] px-4 py-3 sm:min-w-[320px]">
                    <Search size={18} className="text-[var(--color-text-soft)]" />
                    <input
                      key={searchQuery}
                      name="q"
                      aria-label="search archive"
                      defaultValue={searchQuery}
                      placeholder="search files and folders"
                      className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-text-soft)]"
                    />
                  </form>
                  <div className="flex items-center gap-2">{headerAction}</div>
                </div>
              </div>
            </div>
          </header>

          <div className={cn("grid min-h-0 flex-1 gap-4", Boolean(detail) && "xl:grid-cols-[minmax(0,1fr)_320px]")}>
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

function AccountActions({
  user,
  pathname,
  isLoggingOut,
  logoutError,
  onLogout,
  onSessions,
  onNavigate,
  className,
}: {
  user: CurrentUser;
  pathname: string;
  isLoggingOut: boolean;
  logoutError: string | null;
  onLogout: () => void;
  onSessions: () => void;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-end gap-2 text-sm", className)}>
      <p className="max-w-full text-right text-[var(--color-text)]">
        <span className="block truncate">{user.name}</span>
        <span className="block truncate text-[var(--color-text-soft)]">{user.email}</span>
      </p>
      <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
        <button type="button" onClick={onSessions} className="metro-text-action">
          manage sessions
        </button>
        <button type="button" onClick={onLogout} disabled={isLoggingOut} className="metro-text-action">
          {isLoggingOut ? "signing out..." : "sign out"}
        </button>
        <Link
          href="/settings"
          onClick={onNavigate}
          aria-current={pathname.startsWith("/settings") ? "page" : undefined}
          className="metro-text-action"
        >
          settings
        </Link>
      </div>
      {logoutError ? <p className="text-right text-xs text-[var(--color-danger-text)]">{logoutError}</p> : null}
    </div>
  );
}
