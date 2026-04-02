// src/App.tsx
import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { Box, CircularProgress } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { appTheme } from "./theme";
import { GlobalError } from "./components/errors/GlobalError";
import { NotFound } from "./components/errors/NotFound";
import { NotificationProvider } from "./components/notifications/NotificationProvider";

// Auth imports
import { AuthProvider } from "./features/auth/contexts/AuthContext";

const RootLayout = lazy(async () => ({
  default: (await import("./components/layout/rootlayout")).RootLayout,
}));
const Dashboard = lazy(async () => ({
  default: (await import("./features/dashboard/components/Dashboard")).Dashboard,
}));
const TransactionList = lazy(async () => ({
  default: (await import("./features/transactions/components/TransactionList"))
    .TransactionList,
}));
const TipList = lazy(async () => ({
  default: (await import("./features/tips/components/TipList")).TipList,
}));
const ProtectedRoute = lazy(async () => ({
  default: (await import("./features/auth/components/ProtectedRoute"))
    .ProtectedRoute,
}));
const LoginPage = lazy(async () => ({
  default: (await import("./features/auth/components/LoginPage")).LoginPage,
}));

const queryClient = new QueryClient({
  /* ... */
});

const RouteFallback = () => (
  <Box
    sx={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      px: 2,
    }}
  >
    <CircularProgress />
  </Box>
);

const withSuspense = (element: ReactNode) => (
  <Suspense fallback={<RouteFallback />}>{element}</Suspense>
);

const router = createBrowserRouter([
  {
    path: "/login",
    element: withSuspense(<LoginPage />),
    errorElement: <GlobalError />,
  },
  {
    element: withSuspense(<ProtectedRoute />),
    errorElement: <GlobalError />,
    children: [
      {
        path: "/",
        element: withSuspense(<RootLayout />),
        children: [
          { index: true, element: withSuspense(<Dashboard />) },
          { path: "transactions", element: withSuspense(<TransactionList />) },
          { path: "tips", element: withSuspense(<TipList />) },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
]);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={appTheme}>
        <NotificationProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </NotificationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
