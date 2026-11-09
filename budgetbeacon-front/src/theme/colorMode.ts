export type ColorMode = "light" | "dark";
export const COLOR_MODE_KEY = "budgetbeacon.colorMode";
export function readColorMode(): ColorMode | null {
  try {
    const value = window.localStorage.getItem(COLOR_MODE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch { return null; }
}
export function saveColorMode(mode: ColorMode): void {
  try { window.localStorage.setItem(COLOR_MODE_KEY, mode); }
  catch { /* Appearance still works when browser storage is blocked. */ }
}
export const resolveColorMode = (preference: ColorMode | null, systemDark: boolean): ColorMode =>
  preference ?? (systemDark ? "dark" : "light");
