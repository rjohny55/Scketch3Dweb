export const APP_THEME_STORAGE_KEY = "scketch3Dweb.theme";

export const APP_THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "blue-violet", label: "Blue-violet" },
  { value: "blue-violet-dark", label: "Dark blue" },
] as const;

export type AppThemePreference = (typeof APP_THEME_OPTIONS)[number]["value"];
export type ResolvedAppTheme = Exclude<AppThemePreference, "system">;

export function normalizeAppThemePreference(value: unknown): AppThemePreference {
  return value === "light" || value === "dark" || value === "system" || value === "blue-violet" || value === "blue-violet-dark" ? value : "system";
}

export function resolveAppTheme(preference: AppThemePreference, prefersDark: boolean): ResolvedAppTheme {
  return preference === "system" ? (prefersDark ? "dark" : "light") : preference;
}

export function readStoredAppTheme(storage: Pick<Storage, "getItem"> | null | undefined): AppThemePreference {
  if (!storage) return "system";
  try {
    return normalizeAppThemePreference(storage.getItem(APP_THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

export function storeAppTheme(
  storage: Pick<Storage, "setItem"> | null | undefined,
  preference: AppThemePreference,
) {
  if (!storage) return;
  try {
    storage.setItem(APP_THEME_STORAGE_KEY, preference);
  } catch {
    // The selected theme still applies for this session when storage is unavailable.
  }
}

export function applyAppTheme(preference: AppThemePreference, prefersDark?: boolean) {
  if (typeof document === "undefined") return;
  const systemPrefersDark = prefersDark ?? (
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false
  );
  const resolved = resolveAppTheme(preference, systemPrefersDark);
  document.documentElement.dataset.theme = resolved !== "light" ? "dark" : "light";
  document.documentElement.dataset.appearance = preference;
  document.documentElement.style.colorScheme = resolved === "light" ? "light" : "dark";
}

// Run in the document head before the first paint, including the account gate.
export const APP_THEME_BOOTSTRAP = `(${function () {
  let preference = "system";
  try { preference = localStorage.getItem("scketch3Dweb.theme") || "system"; } catch {}
  if (!["system", "light", "dark", "blue-violet", "blue-violet-dark"].includes(preference)) preference = "system";
  const resolved = preference === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : preference;
  document.documentElement.dataset.theme = resolved === "light" ? "light" : "dark";
  document.documentElement.dataset.appearance = preference;
  document.documentElement.style.colorScheme = resolved === "light" ? "light" : "dark";
}.toString()})();`;
