import { useState } from "react";
import {
  Avatar,
  Box,
  ButtonBase,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  AppBar,
} from "@mui/material";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ReceiptIcon from "@mui/icons-material/Receipt";
import BarChartIcon from "@mui/icons-material/BarChart";
import LocationCityIcon from "@mui/icons-material/LocationCity";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import SavingsIcon from "@mui/icons-material/Savings";

import { ApiError } from "../api/httpClient";
import { logoutCurrentSession } from "../api/authApi";
import { useAuth } from "../hooks/useAuth";
import { useNotification } from "./NotificationProvider";

const DRAWER_WIDTH = 240;
const ACCOUNT_MENU_ID = "account-menu";

interface NavItem {
  title: string;
  path: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", path: "/", icon: <DashboardIcon /> },
  { title: "Transactions", path: "/transactions", icon: <ReceiptIcon /> },
  { title: "Statistics", path: "/statistics", icon: <BarChartIcon /> },
  { title: "Tips", path: "/tips", icon: <LocationCityIcon /> },
  { title: "Settings", path: "/settings", icon: <SettingsIcon /> },
];

export const RootLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { showNotification } = useNotification();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const menuOpen = Boolean(anchorEl);
  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : "Account";
  const initials = user
    ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase()
    : "A";

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleToggleMobileDrawer = () => {
    setMobileDrawerOpen((current) => !current);
  };

  const handleCloseMobileDrawer = () => {
    setMobileDrawerOpen(false);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    handleCloseMobileDrawer();
  };

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    handleCloseMenu();
    handleCloseMobileDrawer();
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

  const drawerContent = (
    <>
      <Toolbar />
      <Box
        sx={{
          display: { xs: "block", md: "none" },
          px: 2,
          py: 2,
          color: "text.primary",
          backgroundColor: "background.paper",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Avatar
              sx={{
                bgcolor: "primary.light",
                color: "primary.dark",
                fontWeight: 700,
                width: 42,
                height: 42,
              }}
            >
              {initials}
            </Avatar>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>
                {displayName}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.84 }}>
                {user?.email}
              </Typography>
            </Box>
          </Box>
          <IconButton
            aria-label="Close navigation menu"
            onClick={handleCloseMobileDrawer}
            sx={{
              color: "text.secondary",
              border: "1px solid",
              borderColor: "divider",
              "&:hover": {
                bgcolor: "action.hover",
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 1.5 }}
        >
          Quick navigation
        </Typography>
      </Box>
      <Box sx={{ overflow: "auto", px: 1.25, py: 1.5 }}>
        <List aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <ListItem key={item.title} disablePadding sx={{ mb: 0.75 }}>
                <ListItemButton
                  onClick={() => handleNavigate(item.path)}
                  selected={isActive}
                  aria-current={isActive ? "page" : undefined}
                  sx={{
                    minHeight: { xs: 56, md: 50 },
                    px: 1.5,
                    borderRadius: 1,
                    transition:
                      "background-color 0.2s ease, color 0.2s ease",
                    "&.Mui-selected": {
                      backgroundColor: "primary.light",
                      color: "primary.dark",
                      "& .MuiListItemIcon-root": {
                        color: "primary.dark",
                      },
                    },
                    "&.Mui-selected:hover": {
                      backgroundColor: "primary.light",
                    },
                    "&:hover": {
                      backgroundColor: isActive ? "primary.light" : "action.hover",
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 40,
                      color: isActive ? "inherit" : "text.secondary",
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.title}
                    primaryTypographyProps={{
                      fontWeight: isActive ? 700 : 600,
                      fontSize: { xs: "0.98rem", md: "0.95rem" },
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>
    </>
  );

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />

      <AppBar
        position="fixed"
        color="default"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          bgcolor: "background.paper",
          color: "text.primary",
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            onClick={handleToggleMobileDrawer}
            aria-label="Open navigation menu"
            sx={{ mr: 1.5, display: { xs: "inline-flex", md: "none" } }}
          >
            <MenuIcon />
          </IconButton>

          <ButtonBase
            aria-label="Go to BudgetBeacon home"
            onClick={() => handleNavigate("/")}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              minWidth: 0,
              borderRadius: 1,
              textAlign: "left",
              color: "inherit",
              px: 0.5,
              py: 0.25,
              "&:hover": {
                bgcolor: "action.hover",
              },
              "&:focus-visible": {
                outline: "2px solid",
                outlineColor: "primary.main",
                outlineOffset: 2,
              },
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                width: 36,
                height: 36,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                borderRadius: 1,
                color: "primary.dark",
                bgcolor: "primary.light",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <SavingsIcon fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="h6"
                noWrap
                component="div"
                sx={{ fontSize: "1.05rem", lineHeight: 1.15 }}
              >
                BudgetBeacon
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
                sx={{ display: { xs: "none", sm: "block" }, lineHeight: 1.2 }}
              >
                Personal finance workspace
              </Typography>
            </Box>
          </ButtonBase>

          <Box sx={{ flexGrow: 1 }} />

          <IconButton
            onClick={handleOpenMenu}
            aria-label="Open account menu"
            aria-controls={menuOpen ? ACCOUNT_MENU_ID : undefined}
            aria-expanded={menuOpen ? "true" : undefined}
            aria-haspopup="menu"
            sx={{ gap: 1 }}
          >
            <Avatar
              sx={{
                width: 34,
                height: 34,
                bgcolor: "primary.light",
                color: "primary.dark",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              {initials}
            </Avatar>
            <Box
              sx={{
                display: { xs: "none", sm: "flex" },
                flexDirection: "column",
                alignItems: "flex-start",
              }}
            >
              <Typography variant="body2" fontWeight="bold" color="inherit">
                {displayName}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
              >
                {user?.email}
              </Typography>
            </Box>
            <KeyboardArrowDownIcon fontSize="small" />
          </IconButton>

          <Menu
            id={ACCOUNT_MENU_ID}
            anchorEl={anchorEl}
            open={menuOpen}
            onClose={handleCloseMenu}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <Box sx={{ px: 2, py: 1.5, minWidth: 220 }}>
              <Typography variant="subtitle2">{displayName}</Typography>
              <Typography variant="body2" color="text.secondary">
                {user?.email}
              </Typography>
            </Box>
            <Divider />
            <MenuItem onClick={handleLogout} disabled={isLoggingOut}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{isLoggingOut ? "Logging out..." : "Logout"}</ListItemText>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="temporary"
        open={mobileDrawerOpen}
        onClose={handleCloseMobileDrawer}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          [`& .MuiDrawer-paper`]: {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            bgcolor: "background.paper",
          },
        }}
      >
        {drawerContent}
      </Drawer>

      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", md: "block" },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            bgcolor: "background.paper",
          },
        }}
      >
        {drawerContent}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minHeight: "100vh",
          p: { xs: 2, sm: 3 },
          bgcolor: "background.default",
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
};
