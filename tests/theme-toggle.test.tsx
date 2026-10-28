import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { THEME_STORAGE_KEY } from "@/lib/theme/theme";

describe("theme external state", () => {
  it("uses a stable server snapshot even when the browser stores dark mode", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    expect(renderToString(<ThemeToggle />)).toContain('aria-label="Switch to dark mode"');
  });

  it("reads the stored preference and synchronizes toggles in the same page", async () => {
    const user = userEvent.setup();
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    render(<><ThemeToggle /><ThemeToggle /></>);
    const toggles = screen.getAllByRole("button", { name: "Switch to light mode" });
    await user.click(toggles[0]);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(screen.getAllByRole("button", { name: "Switch to dark mode" })).toHaveLength(2);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("tracks preference changes from another browser tab", () => {
    render(<ThemeToggle />);
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    fireEvent(window, new StorageEvent("storage", { key: THEME_STORAGE_KEY, newValue: "dark" }));
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeDefined();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
