import { alpha, createTheme } from "@mui/material/styles";
import type {} from "@mui/x-data-grid/themeAugmentation";

const bankingLight = {
  background: "#f7f8f5",
  paper: "#ffffff",
  border: "#dde3dc",
  primary: "#246b5a",
  primaryDark: "#17483c",
  primaryLight: "#e6f1ed",
  secondary: "#53616c",
  text: "#16211d",
  textMuted: "#65736d",
  success: "#176b45",
  error: "#b33a2f",
  warning: "#b7791f",
};

const bankingDark = {
  background: "#111a17", paper: "#1b2722", border: "#35473e",
  primary: "#82cbb0", primaryDark: "#17483c", primaryLight: "#b6e5d2",
  secondary: "#b3c4ce", text: "#e5eee9", textMuted: "#adbeb4",
  success: "#81c995", error: "#ffb4ab", warning: "#edc078",
};

export const createAppTheme = (mode: "light" | "dark") => {
  const colors = mode === "dark" ? bankingDark : bankingLight;
  return createTheme({
    shape: {
      borderRadius: 8,
    },
    palette: {
      mode,
      primary: {
        main: colors.primary,
        dark: colors.primaryDark,
        light: colors.primaryLight,
        contrastText: mode === "dark" ? "#11251d" : "#ffffff",
      },
      secondary: {
        main: colors.secondary,
      },
      success: {
        main: colors.success,
      },
      error: {
        main: colors.error,
      },
      warning: {
        main: colors.warning,
      },
      background: {
        default: colors.background,
        paper: colors.paper,
      },
      text: {
        primary: colors.text,
        secondary: colors.textMuted,
      },
      divider: colors.border,
      action: {
        hover: alpha(colors.primary, 0.06),
        selected: alpha(colors.primary, 0.1),
      },
    },
    typography: {
      fontFamily:
        '"Inter", "Roboto", "Helvetica Neue", "Arial", sans-serif',
      h4: {
        fontWeight: 700,
        letterSpacing: 0,
      },
      h5: {
        fontWeight: 700,
        letterSpacing: 0,
      },
      h6: {
        fontWeight: 700,
        letterSpacing: 0,
      },
      subtitle1: {
        fontWeight: 650,
      },
      button: {
        fontWeight: 700,
        letterSpacing: 0,
        textTransform: "none",
      },
      overline: {
        fontWeight: 700,
        letterSpacing: 0.3,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: colors.background,
            color: colors.text,
          },
        },
      },
      MuiAppBar: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            backgroundImage: "none",
            borderBottom: `1px solid ${colors.border}`,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: "none",
            borderRight: `1px solid ${colors.border}`,
          },
        },
      },
      MuiPaper: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
          rounded: {
            borderRadius: 8,
          },
        },
      },
      MuiCard: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            backgroundImage: "none",
            boxShadow: mode === "dark" ? "0 8px 24px rgba(0,0,0,0.18)" : "0 8px 24px rgba(22, 33, 29, 0.05)",
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            borderRadius: 8,
            boxShadow: "none",
            minHeight: 38,
          },
          contained: {
            boxShadow: "none",
            "&:hover": {
              boxShadow: "none",
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 10,
            border: `1px solid ${colors.border}`,
            boxShadow: mode === "dark" ? "0 24px 70px rgba(0,0,0,0.4)" : "0 24px 70px rgba(22, 33, 29, 0.18)",
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 650,
          },
        },
      },
      MuiDataGrid: {
        styleOverrides: {
          root: {
            borderColor: colors.border,
            borderRadius: 8,
            backgroundColor: colors.paper,
          },
          columnHeaders: {
            backgroundColor: mode === "dark" ? "#24362c" : "#fbfcf9",
            color: colors.textMuted,
            fontWeight: 700,
          },
          cell: {
            borderColor: mode === "dark" ? colors.border : "#edf1eb",
          },
          footerContainer: {
            borderColor: colors.border,
          },
        },
      },
    },
  });

};

export const appTheme = createAppTheme("light");
export const darkTheme = createAppTheme("dark");
