import { RouterProvider } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { appTheme } from "./theme";
import { NotificationProvider } from "./components/NotificationProvider";
import { AuthProvider } from "./features/auth/AuthContext";
import { PwaInstallProvider } from "./features/pwa/PwaInstallContext";
import { router } from "./router";

const queryClient = new QueryClient({
  /* ... */
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={appTheme}>
        <NotificationProvider>
          <PwaInstallProvider>
            <AuthProvider>
              <RouterProvider router={router} />
            </AuthProvider>
          </PwaInstallProvider>
        </NotificationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
