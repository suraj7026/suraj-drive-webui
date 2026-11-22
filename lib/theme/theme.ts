export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "drive-theme";

export const accents = [
  { id: "blue", label: "blue", color: "#005a9e", strong: "#004578", on: "#ffffff" },
  { id: "teal", label: "teal", color: "#008299", strong: "#006676", on: "#ffffff" },
  { id: "green", label: "green", color: "#008a00", strong: "#006600", on: "#ffffff" },
  { id: "lime", label: "lime", color: "#7ca10c", strong: "#5c7809", on: "#111111" },
  { id: "orange", label: "orange", color: "#f7630c", strong: "#c44e0a", on: "#111111" },
  { id: "red", label: "red", color: "#e51400", strong: "#b01000", on: "#ffffff" },
  { id: "magenta", label: "magenta", color: "#d80073", strong: "#a80059", on: "#ffffff" },
  { id: "purple", label: "purple", color: "#6a00ff", strong: "#5200c4", on: "#ffffff" },
] as const;

export type AccentId = (typeof accents)[number]["id"];

export const ACCENT_STORAGE_KEY = "drive-accent";
export const DEFAULT_ACCENT_ID: AccentId = "blue";

export function accentById(id: string | null | undefined) {
  return accents.find((accent) => accent.id === id) ?? accents[0];
}

const accentMapLiteral = accents
  .map((accent) => `${accent.id}:["${accent.color}","${accent.strong}","${accent.on}"]`)
  .join(",");

export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');var t=s==='light'||s==='dark'?s:'dark';var r=document.documentElement;if(t==='dark'){r.classList.add('dark');}r.dataset.theme=t;var accents={${accentMapLiteral}};var id=localStorage.getItem('${ACCENT_STORAGE_KEY}');var pair=accents[id]||accents.blue;r.dataset.accent=accents[id]?id:'blue';r.style.setProperty('--color-primary',pair[0]);r.style.setProperty('--color-primary-strong',pair[1]);r.style.setProperty('--color-accent',pair[0]);r.style.setProperty('--color-on-primary',pair[2]);}catch(e){}})();`;

export function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") {
    return null;
  }
  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  return value === "light" || value === "dark" ? value : null;
}

export function readSystemTheme(): Theme {
  if (typeof window === "undefined") {
    return "dark";
  }
  return "dark";
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

export function readStoredAccent(): AccentId | null {
  if (typeof window === "undefined") {
    return null;
  }
  const value = window.localStorage.getItem(ACCENT_STORAGE_KEY);
  return accents.some((accent) => accent.id === value) ? (value as AccentId) : null;
}

export function applyAccent(id: AccentId) {
  if (typeof document === "undefined") {
    return;
  }
  const accent = accentById(id);
  const root = document.documentElement;
  root.dataset.accent = accent.id;
  root.style.setProperty("--color-primary", accent.color);
  root.style.setProperty("--color-primary-strong", accent.strong);
  root.style.setProperty("--color-accent", accent.color);
  root.style.setProperty("--color-on-primary", accent.on);
}

export function persistAccent(id: AccentId) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(ACCENT_STORAGE_KEY, id);
}
