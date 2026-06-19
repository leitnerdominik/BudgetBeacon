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

export const appTheme = createTheme({
  shape: {
    borderRadius: 8,
  },
  palette: {
    mode: "light",
    primary: {
      main: bankingLight.primary,
      dark: bankingLight.primaryDark,
      light: bankingLight.primaryLight,
      contrastText: "#ffffff",
    },
    secondary: {
      main: bankingLight.secondary,
    },
    success: {
      main: bankingLight.success,
    },
    error: {
      main: bankingLight.error,
    },
    warning: {
      main: bankingLight.warning,
    },
    background: {
      default: bankingLight.background,
      paper: bankingLight.paper,
    },
    text: {
      primary: bankingLight.text,
      secondary: bankingLight.textMuted,
    },
    divider: bankingLight.border,
    action: {
      hover: alpha(bankingLight.primary, 0.06),
      selected: alpha(bankingLight.primary, 0.1),
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
          backgroundColor: bankingLight.background,
          color: bankingLight.text,
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
          borderBottom: `1px solid ${bankingLight.border}`,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: "none",
          borderRight: `1px solid ${bankingLight.border}`,
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
          border: `1px solid ${bankingLight.border}`,
          borderRadius: 8,
          backgroundImage: "none",
          boxShadow: "0 8px 24px rgba(22, 33, 29, 0.05)",
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
          border: `1px solid ${bankingLight.border}`,
          boxShadow: "0 24px 70px rgba(22, 33, 29, 0.18)",
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
          borderColor: bankingLight.border,
          borderRadius: 8,
          backgroundColor: bankingLight.paper,
        },
        columnHeaders: {
          backgroundColor: "#fbfcf9",
          color: bankingLight.textMuted,
          fontWeight: 700,
        },
        cell: {
          borderColor: "#edf1eb",
        },
        footerContainer: {
          borderColor: bankingLight.border,
        },
      },
    },
  },
});
