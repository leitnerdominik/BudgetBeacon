import { useState, type ReactNode } from "react";
import { CssBaseline, useMediaQuery } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { appTheme, darkTheme } from "./index";
import { ColorModeContext } from "./colorModeContext";
import { readColorMode, resolveColorMode, saveColorMode } from "./colorMode";
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState(readColorMode);
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)", { noSsr: true });
  const mode = resolveColorMode(preference, systemDark);
  const toggleMode = () => {
    const next = mode === "dark" ? "light" : "dark";
    setPreference(next);
    saveColorMode(next);
  };
  return (
    <ColorModeContext.Provider value={{ mode, toggleMode }}>
      <ThemeProvider theme={mode === "dark" ? darkTheme : appTheme}>
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
