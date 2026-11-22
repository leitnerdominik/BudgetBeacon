import { useState, type ReactNode } from "react";
import {
  AppBar,
  Box,
  ButtonBase,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import BarChartRoundedIcon from "@mui/icons-material/BarChartRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import FirstPageRoundedIcon from "@mui/icons-material/FirstPageRounded";
import LastPageRoundedIcon from "@mui/icons-material/LastPageRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { Link, NavLink } from "react-router-dom";

const DESKTOP_NAV_ID = "desktop-navigation";
const MOBILE_DRAWER_ID = "mobile-navigation";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/", Icon: DashboardOutlinedIcon },
  { label: "Transactions", path: "/transactions", Icon: ReceiptLongOutlinedIcon },
  { label: "Statistics", path: "/statistics", Icon: BarChartRoundedIcon },
  { label: "Tips", path: "/tips", Icon: AutoAwesomeOutlinedIcon },
];
const SETTINGS_ITEM = { label: "Settings", path: "/settings", Icon: SettingsOutlinedIcon };

const focusRing = {
  outline: "2px solid",
  outlineColor: "primary.main",
  outlineOffset: -2,
};

function BrandLink({ compact = false }: { compact?: boolean }) {
  return (
    <Tooltip title={compact ? "BudgetBeacon home" : ""} placement="right">
      <ButtonBase
        component={Link}
        to="/"
        aria-label="BudgetBeacon home"
        sx={{
          minWidth: 0,
          minHeight: 44,
          justifyContent: compact ? "center" : "flex-start",
          gap: 1.25,
          px: compact ? 0 : 0.75,
          borderRadius: 1.5,
          "&:hover": { bgcolor: "action.hover" },
          "&.Mui-focusVisible": focusRing,
        }}
      >
        <Box component="img" src="/favicon.svg" alt="" width={36} height={36} sx={{ flexShrink: 0 }} />
        {!compact && (
          <Typography variant="subtitle1" fontWeight={750} noWrap>
            BudgetBeacon
          </Typography>
        )}
      </ButtonBase>
    </Tooltip>
  );
}

function NavigationLinks({ items, compact, onNavigate }: {
  items: typeof NAV_ITEMS;
  compact: boolean;
  onNavigate?: () => void;
}) {
  return (
    <List disablePadding sx={{ display: "grid", gap: 0.5 }}>
      {items.map(({ label, path, Icon }) => (
        <ListItem key={path} disablePadding>
          <Tooltip title={compact ? label : ""} placement="right">
            <ListItemButton
              component={NavLink}
              to={path}
              end={path === "/"}
              onClick={onNavigate}
              aria-label={compact ? label : undefined}
              sx={{
                minHeight: 46,
                justifyContent: compact ? "center" : "flex-start",
                gap: 1.5,
                px: compact ? 0 : 1.5,
                color: "text.secondary",
                borderRadius: 1.5,
                "&[aria-current='page']": { bgcolor: "action.selected", color: "text.primary" },
                "&[aria-current='page']:hover": { bgcolor: "action.selected" },
                "&.Mui-focusVisible": focusRing,
              }}
            >
              <Icon fontSize="small" />
              {!compact && (
                <Typography variant="body2" fontWeight={650} color="text.primary" noWrap>
                  {label}
                </Typography>
              )}
            </ListItemButton>
          </Tooltip>
        </ListItem>
      ))}
    </List>
  );
}

export function DesktopNavigation({ collapsed, onToggle, accountMenu }: {
  collapsed: boolean;
  onToggle: () => void;
  accountMenu: ReactNode;
}) {
  const toggleLabel = collapsed ? "Expand navigation" : "Collapse navigation";

  return (
    <Box
      component="aside"
      aria-label="BudgetBeacon sidebar"
      sx={{
        position: "sticky",
        top: 0,
        alignSelf: "flex-start",
        width: collapsed ? 72 : 240,
        height: "100dvh",
        flexShrink: 0,
        overflowY: "auto",
        bgcolor: "background.paper",
        borderRight: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100%", px: 1.25, pt: 2.5, pb: 1 }}>
        <BrandLink compact={collapsed} />

        <Box
          component="nav"
          id={DESKTOP_NAV_ID}
          aria-label="Primary navigation"
          sx={{ display: "flex", flex: 1, flexDirection: "column", gap: 2.5, mt: 3, mb: 0.5 }}
        >
          <NavigationLinks items={NAV_ITEMS} compact={collapsed} />
          <Box sx={{ mt: "auto" }}>
            <NavigationLinks items={[SETTINGS_ITEM]} compact={collapsed} />
          </Box>
        </Box>

        {accountMenu}
        <Divider sx={{ my: 0.75 }} />
        <Tooltip title={toggleLabel} placement="right">
          <IconButton
            onClick={onToggle}
            aria-label={toggleLabel}
            aria-controls={DESKTOP_NAV_ID}
            aria-expanded={!collapsed}
            sx={{
              alignSelf: collapsed ? "center" : "flex-end",
              width: 44,
              height: 44,
              color: "text.secondary",
              "&.Mui-focusVisible": focusRing,
            }}
          >
            {collapsed ? <LastPageRoundedIcon /> : <FirstPageRoundedIcon />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

export function MobileNavigation({ accountMenu }: { accountMenu: ReactNode }) {
  const [open, setOpen] = useState(false);
  const closeDrawer = () => setOpen(false);

  return (
    <>
      <AppBar position="sticky" color="default" sx={{ bgcolor: "background.paper", color: "text.primary" }}>
        <Toolbar variant="dense" sx={{ minHeight: 56, gap: 0.5 }}>
          <IconButton
            edge="start"
            onClick={() => setOpen(true)}
            aria-label="Open navigation menu"
            aria-controls={open ? MOBILE_DRAWER_ID : undefined}
            aria-expanded={open}
            aria-haspopup="dialog"
            sx={{ width: 44, height: 44, "&.Mui-focusVisible": focusRing }}
          >
            <MenuRoundedIcon />
          </IconButton>
          <BrandLink />
          <Box sx={{ flex: 1 }} />
          {accountMenu}
        </Toolbar>
      </AppBar>

      <Drawer
        open={open}
        onClose={closeDrawer}
        slotProps={{
          paper: { id: MOBILE_DRAWER_ID, "aria-label": "Navigation", sx: { width: "min(264px, calc(100vw - 48px))" } },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, p: 1.25 }}>
          <Typography variant="subtitle1" sx={{ pl: 1.5 }}>Navigation</Typography>
          <IconButton
            onClick={closeDrawer}
            aria-label="Close navigation menu"
            sx={{ width: 44, height: 44, "&.Mui-focusVisible": focusRing }}
          >
            <CloseRoundedIcon />
          </IconButton>
        </Box>
        <Box
          component="nav"
          aria-label="Primary navigation"
          sx={{ display: "flex", flex: 1, flexDirection: "column", gap: 2.5, px: 1.25, pb: 1.25 }}
        >
          <NavigationLinks items={NAV_ITEMS} compact={false} onNavigate={closeDrawer} />
          <Box sx={{ mt: "auto" }}>
            <NavigationLinks items={[SETTINGS_ITEM]} compact={false} onNavigate={closeDrawer} />
          </Box>
        </Box>
      </Drawer>
    </>
  );
}
