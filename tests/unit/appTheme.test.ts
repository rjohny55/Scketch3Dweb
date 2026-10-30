import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import {
  APP_THEME_BOOTSTRAP,
  APP_THEME_OPTIONS,
  APP_THEME_STORAGE_KEY,
  normalizeAppThemePreference,
  readStoredAppTheme,
  resolveAppTheme,
  storeAppTheme,
} from "@/lib/appTheme";

describe("application theme preference", () => {
  it("boots both named palettes before the first paint", () => {
    expect(APP_THEME_OPTIONS.map((option) => option.value)).toEqual([
      "system", "light", "dark", "blue-violet", "blue-violet-dark",
    ]);
    for (const preference of ["blue-violet", "blue-violet-dark"] as const) {
      const root = { dataset: {} as Record<string, string>, style: { colorScheme: "" } };
      runInNewContext(APP_THEME_BOOTSTRAP, {
        localStorage: { getItem: () => preference },
        matchMedia: () => ({ matches: false }),
        document: { documentElement: root },
      });
      expect(root.dataset.appearance).toBe(preference);
      expect(root.dataset.theme).toBe("dark");
      expect(root.style.colorScheme).toBe("dark");
    }
  });

  it("normalizes stored values and resolves the system theme", () => {
    expect(normalizeAppThemePreference("light")).toBe("light");
    expect(normalizeAppThemePreference("dark")).toBe("dark");
    expect(normalizeAppThemePreference("blue-violet")).toBe("blue-violet");
    expect(resolveAppTheme("blue-violet", false)).toBe("blue-violet");
    expect(resolveAppTheme("blue-violet", true)).toBe("blue-violet");
    expect(normalizeAppThemePreference("blue-violet-dark")).toBe("blue-violet-dark");
    expect(resolveAppTheme("blue-violet-dark", false)).toBe("blue-violet-dark");
    expect(normalizeAppThemePreference("unexpected")).toBe("system");
    expect(resolveAppTheme("system", true)).toBe("dark");
    expect(resolveAppTheme("system", false)).toBe("light");
    expect(resolveAppTheme("light", true)).toBe("light");
  });

  it("persists the selected preference and safely falls back for invalid storage", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    storeAppTheme(storage, "dark");
    expect(values.get(APP_THEME_STORAGE_KEY)).toBe("dark");
    expect(readStoredAppTheme(storage)).toBe("dark");
    storeAppTheme(storage, "blue-violet");
    expect(readStoredAppTheme(storage)).toBe("blue-violet");
    values.set(APP_THEME_STORAGE_KEY, "neon");
    expect(readStoredAppTheme(storage)).toBe("system");
  });
});
