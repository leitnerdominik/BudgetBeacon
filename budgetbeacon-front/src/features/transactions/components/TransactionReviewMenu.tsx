import { useId, useState } from "react";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import FilterListIcon from "@mui/icons-material/FilterList";
import TuneIcon from "@mui/icons-material/Tune";
import { Button, CircularProgress, ListItemIcon, Menu, MenuItem } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Link } from "react-router-dom";

import { unclassifiedExpensesPath } from "../transactionListUrlState";
import { SpendingFlexibilityReviewDialog } from "./SpendingFlexibilityReviewDialog";

type TransactionReviewMenuProps = {
  isOnline: boolean;
  canCategorize: boolean;
  isCategorizing: boolean;
  onCategorize: () => void;
};

export const TransactionReviewMenu = ({
  isOnline,
  canCategorize,
  isCategorizing,
  onCategorize,
}: TransactionReviewMenuProps) => {
  const buttonId = useId();
  const menuId = useId();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [isFlexibilityDialogOpen, setIsFlexibilityDialogOpen] = useState(false);
  const isOpen = Boolean(anchorEl);
  const closeMenu = () => setAnchorEl(null);

  return (
    <>
      <Button
        id={buttonId}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        startIcon={<FactCheckOutlinedIcon />}
        endIcon={<ExpandMoreIcon />}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={(theme) => ({
          bgcolor: alpha(theme.palette.primary.main, theme.palette.action.hoverOpacity * 2),
          "&:hover, &[aria-expanded='true']": {
            bgcolor: alpha(theme.palette.primary.main, theme.palette.action.selectedOpacity * 2),
          },
        })}
      >
        Review
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={isOpen}
        onClose={closeMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ list: { id: menuId, "aria-labelledby": buttonId } }}
      >
        <MenuItem
          disabled={!canCategorize}
          onClick={() => {
            closeMenu();
            onCategorize();
          }}
        >
          <ListItemIcon>
            {isCategorizing ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              <AutoAwesomeIcon fontSize="small" />
            )}
          </ListItemIcon>
          Categorize uncategorized
        </MenuItem>
        <MenuItem component={Link} to={unclassifiedExpensesPath} onClick={closeMenu}>
          <ListItemIcon><FilterListIcon fontSize="small" /></ListItemIcon>
          Unclassified expenses
        </MenuItem>
        <MenuItem
          disabled={!isOnline}
          onClick={() => {
            closeMenu();
            setIsFlexibilityDialogOpen(true);
          }}
        >
          <ListItemIcon><TuneIcon fontSize="small" /></ListItemIcon>
          Review spending flexibility
        </MenuItem>
      </Menu>
      <SpendingFlexibilityReviewDialog
        isOnline={isOnline}
        open={isFlexibilityDialogOpen}
        onClose={() => setIsFlexibilityDialogOpen(false)}
      />
    </>
  );
};
