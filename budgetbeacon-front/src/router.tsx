/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense, type ReactNode } from "react";
import { Box, CircularProgress } from "@mui/material";
import { createBrowserRouter } from "react-router-dom";

import { GlobalError } from "./components/GlobalError";
import { NotFound } from "./components/NotFound";

const RootLayout = lazy(async () => ({
  default: (await import("./components/RootLayout")).RootLayout,
}));
const DashboardPage = lazy(async () => ({
  default: (await import("./pages/DashboardPage")).DashboardPage,
}));
const TransactionsPage = lazy(async () => ({
  default: (await import("./pages/TransactionsPage")).TransactionsPage,
}));
const CreateTransactionPage = lazy(async () => ({
  default: (await import("./pages/CreateTransactionPage")).CreateTransactionPage,
}));
const EditTransactionPage = lazy(async () => ({
  default: (await import("./pages/EditTransactionPage")).EditTransactionPage,
}));
const StatisticsPage = lazy(async () => ({
  default: (await import("./pages/StatisticsPage")).StatisticsPage,
}));
const TipsPage = lazy(async () => ({
  default: (await import("./pages/TipsPage")).TipsPage,
}));
const TipDetailPage = lazy(async () => ({
  default: (await import("./pages/TipDetailPage")).TipDetailPage,
}));
const SettingsPage = lazy(async () => ({
  default: (await import("./pages/SettingsPage")).SettingsPage,
}));
const ProtectedRoute = lazy(async () => ({
  default: (await import("./features/auth/ProtectedRoute")).ProtectedRoute,
}));
const LoginPage = lazy(async () => ({
  default: (await import("./pages/LoginPage")).LoginPage,
}));

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

export const router = createBrowserRouter([
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
          { index: true, element: withSuspense(<DashboardPage />) },
          { path: "transactions", element: withSuspense(<TransactionsPage />) },
          {
            path: "transactions/new",
            element: withSuspense(<CreateTransactionPage />),
          },
          {
            path: "transactions/:transactionId/edit",
            element: withSuspense(<EditTransactionPage />),
          },
          { path: "statistics", element: withSuspense(<StatisticsPage />) },
          { path: "tips", element: withSuspense(<TipsPage />) },
          { path: "tips/:tipId", element: withSuspense(<TipDetailPage />) },
          { path: "settings", element: withSuspense(<SettingsPage />) },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
]);
