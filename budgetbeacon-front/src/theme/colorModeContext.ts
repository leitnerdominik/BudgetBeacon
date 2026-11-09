import { createContext, useContext } from "react";
import type { ColorMode } from "./colorMode";
export const ColorModeContext = createContext<{ mode: ColorMode; toggleMode: () => void } | null>(null);
export function useColorMode() {
  const value = useContext(ColorModeContext);
  if (!value) throw new Error("useColorMode requires AppThemeProvider");
  return value;
}
