import { useState, type MouseEvent } from "react";
import {
  Avatar,
  ButtonBase,
  Divider,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAuth } from "../hooks/useAuth";
import { useColorMode } from "../theme/colorModeContext";

const ACCOUNT_MENU_ID = "account-menu";
const ACCOUNT_LABEL = "Open account menu";

interface AccountMenuProps {
  compact: boolean;
  inHeader?: boolean;
  isLoggingOut: boolean;
  onLogout: () => void;
}

export function AccountMenu({ compact, inHeader, isLoggingOut, onLogout }: AccountMenuProps) {
  const { user } = useAuth();
  const { mode, toggleMode } = useColorMode();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const open = Boolean(anchorEl);
  const displayName = user ? `${user.firstName} ${user.lastName}`.trim() || "Account" : "Account";
  const initials = user
    ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase() || "A"
    : "A";
  const darkMode = mode === "dark";

  const handleOpen = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const handleSwitchAppearance = () => {
    toggleMode();
    handleClose();
  };
  const handleLogout = () => {
    handleClose();
    onLogout();
  };

  return (
    <>
      <Tooltip title={compact ? ACCOUNT_LABEL : ""} placement={inHeader ? "bottom" : "right"}>
        <ButtonBase
          onClick={handleOpen}
          aria-label={ACCOUNT_LABEL}
          aria-controls={open ? ACCOUNT_MENU_ID : undefined}
          aria-expanded={open}
          aria-haspopup="menu"
          sx={{
            width: inHeader ? 44 : "100%",
            minHeight: 44,
            justifyContent: compact ? "center" : "flex-start",
            gap: 1.25,
            px: compact ? 0 : 1.25,
            borderRadius: 1.5,
            textAlign: "left",
            "&:hover, &[aria-expanded='true']": { bgcolor: "action.hover" },
            "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: -2 },
          }}
        >
          <Avatar
            aria-hidden="true"
            sx={{
              width: 32,
              height: 32,
              flexShrink: 0,
              bgcolor: "primary.light",
              color: "primary.dark",
              fontSize: "0.8rem",
              fontWeight: 700,
            }}
          >
            {initials}
          </Avatar>
          {!compact && (
            <>
              <Typography variant="body2" fontWeight={650} noWrap sx={{ flex: 1 }}>
                {displayName}
              </Typography>
              <KeyboardArrowDownRoundedIcon fontSize="small" sx={{ color: "text.secondary" }} />
            </>
          )}
        </ButtonBase>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={inHeader
          ? { vertical: "top", horizontal: "right" }
          : { vertical: "bottom", horizontal: "left" }}
        slotProps={{ list: { id: ACCOUNT_MENU_ID, "aria-label": "Account" } }}
      >
        <ListSubheader
          role="presentation"
          disableSticky
          sx={{ px: 2, py: 1, minWidth: 200, maxWidth: 280, overflowWrap: "anywhere" }}
        >
          <Typography variant="subtitle2" color="text.primary">{displayName}</Typography>
          <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
        </ListSubheader>
        <Divider component="li" />
        <MenuItem onClick={handleSwitchAppearance}>
          <ListItemIcon>
            {darkMode ? <LightModeOutlinedIcon fontSize="small" /> : <DarkModeOutlinedIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText>{darkMode ? "Switch to light mode" : "Switch to dark mode"}</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleLogout} disabled={isLoggingOut}>
          <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{isLoggingOut ? "Logging out..." : "Logout"}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
