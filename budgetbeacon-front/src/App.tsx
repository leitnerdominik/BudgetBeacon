import { RouterProvider } from "react-router-dom";
import { AppThemeProvider } from "./theme/AppThemeProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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
      <AppThemeProvider>
        <NotificationProvider>
          <PwaInstallProvider>
            <AuthProvider>
              <RouterProvider router={router} />
            </AuthProvider>
          </PwaInstallProvider>
        </NotificationProvider>
      </AppThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
