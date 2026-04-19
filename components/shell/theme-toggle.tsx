"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, persistTheme, readStoredTheme, readSystemTheme, type Theme } from "@/lib/theme/theme";
import { cn } from "@/lib/utils/cn";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const initial = readStoredTheme() ?? readSystemTheme();
    setTheme(initial);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    persistTheme(next);
  }

  const isDark = theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-11 w-full items-center justify-between rounded-full bg-[var(--color-surface-low)] px-4 text-sm font-medium text-[var(--color-text)] shadow-[inset_0_0_0_1px_var(--color-outline)] transition-colors hover:bg-[var(--color-surface-high)]",
        className
      )}
    >
      <span className="flex items-center gap-2 text-[var(--color-text-muted)]">
        {isDark ? <Moon size={16} /> : <Sun size={16} />}
        <span>{isDark ? "Dark" : "Light"}</span>
      </span>
      <span
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          isDark ? "bg-[var(--color-primary)]" : "bg-[var(--color-surface-highest)]"
        )}
        aria-hidden="true"
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            isDark ? "translate-x-[1.125rem]" : "translate-x-0.5"
          )}
        />
      </span>
    </button>
  );
}
