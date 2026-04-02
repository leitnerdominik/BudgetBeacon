import { createTheme } from "@mui/material/styles";

export const appTheme = createTheme({
  palette: {
    primary: {
      main: "#1976d2", // We can adjust this to a preferred color later
    },
    secondary: {
      main: "#9c27b0",
    },
    background: {
      default: "#f4f6f8",
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    // We will customize specific MUI components here later (e.g., the Brixen tips cards)
  },
});
