export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "drive-theme";

export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');var p=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var t=s==='light'||s==='dark'?s:(p?'dark':'light');if(t==='dark'){document.documentElement.classList.add('dark');}document.documentElement.dataset.theme=t;}catch(e){}})();`;

export function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") {
    return null;
  }
  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  return value === "light" || value === "dark" ? value : null;
}

export function readSystemTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  root.dataset.theme = theme;
}

export function persistTheme(theme: Theme) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}
