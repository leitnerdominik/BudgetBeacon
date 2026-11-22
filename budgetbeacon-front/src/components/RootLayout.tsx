import { useState } from "react";
import { Box, useMediaQuery } from "@mui/material";
import { Outlet, useNavigate } from "react-router-dom";
import { logoutCurrentSession } from "../api/authApi";
import { ApiError } from "../api/httpClient";
import { useAuth } from "../hooks/useAuth";
import { AccountMenu } from "./AccountMenu";
import { DesktopNavigation, MobileNavigation } from "./AppNavigation";
import { readNavigationCollapsed, saveNavigationCollapsed } from "./navigationPreference";
import { useNotification } from "./NotificationProvider";

export const RootLayout = () => {
  const isDesktop = useMediaQuery((theme) => theme.breakpoints.up("md"), { noSsr: true });
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { showNotification } = useNotification();
  const [collapsed, setCollapsed] = useState(readNavigationCollapsed);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const toggleNavigation = () => {
    const next = !collapsed;
    setCollapsed(next);
    saveNavigationCollapsed(next);
  };

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await logoutCurrentSession();
      logout();
      showNotification({
        severity: "success",
        message: "You have been signed out.",
      });
      navigate("/login", { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        logout();
        showNotification({
          severity: "info",
          message: "Your session had already ended.",
        });
        navigate("/login", { replace: true });
        return;
      }

      showNotification({
        severity: "error",
        message:
          "We couldn't sign you out on the server. Please try again while your connection is stable.",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const accountMenu = (
    <AccountMenu
      compact={!isDesktop || collapsed}
      inHeader={!isDesktop}
      isLoggingOut={isLoggingOut}
      onLogout={handleLogout}
    />
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh", bgcolor: "background.default" }}>
      {isDesktop && (
        <DesktopNavigation collapsed={collapsed} onToggle={toggleNavigation} accountMenu={accountMenu} />
      )}

      <Box sx={{ flex: 1, minWidth: 0 }}>
        {!isDesktop && <MobileNavigation accountMenu={accountMenu} />}
        <Box component="main" sx={{ minWidth: 0, overflowX: "hidden", p: { xs: 2, sm: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};
