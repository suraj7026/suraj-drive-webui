"use client";

import { useSyncExternalStore } from "react";
import { AppShell } from "@/components/shell/app-shell";
import type { CurrentUser } from "@/lib/models/auth";
import {
  accents,
  applyAccent,
  applyTheme,
  DEFAULT_ACCENT_ID,
  persistAccent,
  persistTheme,
  readStoredAccent,
  readStoredTheme,
  readSystemTheme,
  type AccentId,
  type Theme,
} from "@/lib/theme/theme";
import { cn } from "@/lib/utils/cn";

export function SettingsView({ user }: { user: CurrentUser }) {
  return (
    <AppShell user={user} eyebrow="the archive" title="settings">
      <AppearanceSettings />
    </AppShell>
  );
}

function AppearanceSettings() {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);
  const accentId = useSyncExternalStore(subscribeToAccent, getAccentSnapshot, getServerAccentSnapshot);
  const accent = accents.find((item) => item.id === accentId) ?? accents[0];

  function chooseTheme(next: Theme) {
    applyTheme(next);
    persistTheme(next);
    window.dispatchEvent(new Event("drive-theme-change"));
  }

  function chooseAccent(next: AccentId) {
    applyAccent(next);
    persistAccent(next);
    window.dispatchEvent(new Event("drive-accent-change"));
  }

  return (
    <div className="grid max-w-3xl gap-14">
      <section>
        <h2 className="font-heading text-3xl font-light tracking-[-0.04em]">appearance</h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-[var(--color-text-muted)]">
          light and dark are tiles. the outline takes your accent.
        </p>
        <div className="mt-6 flex flex-wrap gap-4" role="radiogroup" aria-label="theme">
          <ThemeTile label="light" selected={theme === "light"} onSelect={() => chooseTheme("light")} />
          <ThemeTile label="dark" selected={theme === "dark"} onSelect={() => chooseTheme("dark")} />
        </div>
      </section>

      <section>
        <h2 className="font-heading text-3xl font-light tracking-[-0.04em]">accent</h2>
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">{accent.label}</p>
        <div className="mt-6 flex flex-wrap gap-4" role="radiogroup" aria-label="accent color">
          {accents.map((item) => {
            const selected = item.id === accent.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={item.label}
                onClick={() => chooseAccent(item.id)}
                className={cn("h-12 w-12", selected && "outline outline-[3px] outline-offset-[3px] outline-[var(--color-text)]")}
                style={{ backgroundColor: item.color }}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ThemeTile({ label, selected, onSelect }: { label: Theme; selected: boolean; onSelect: () => void }) {
  const light = label === "light";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${label} mode`}
      onClick={onSelect}
      className="flex h-28 w-40 items-end px-4 py-3 text-left text-2xl font-light"
      style={{
        background: light ? "#ffffff" : "#111111",
        color: light ? "#111111" : "#ffffff",
        outline: selected ? "3px solid var(--color-primary)" : "1px solid var(--color-outline)",
        outlineOffset: selected ? "4px" : "0",
      }}
    >
      {label}
    </button>
  );
}

function subscribeToTheme(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("drive-theme-change", onStoreChange);
  mediaQuery.addEventListener("change", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("drive-theme-change", onStoreChange);
    mediaQuery.removeEventListener("change", onStoreChange);
  };
}

function subscribeToAccent(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("drive-accent-change", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("drive-accent-change", onStoreChange);
  };
}

function getThemeSnapshot(): Theme {
  return readStoredTheme() ?? readSystemTheme();
}

function getServerThemeSnapshot(): Theme {
  return "dark";
}

function getAccentSnapshot(): AccentId {
  return readStoredAccent() ?? DEFAULT_ACCENT_ID;
}

function getServerAccentSnapshot(): AccentId {
  return DEFAULT_ACCENT_ID;
}
