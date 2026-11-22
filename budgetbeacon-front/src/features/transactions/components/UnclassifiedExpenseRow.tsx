import { useId, useState } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Alert, Box, Button, Menu, MenuItem, Paper, Stack, Typography } from "@mui/material";

import type { SpendingFlexibility, Transaction } from "../../../types/api";
import { formatCalendarDate, formatCurrency } from "../../../utils/formatDate";
import { spendingFlexibilityChoices } from "../spendingFlexibility";

const classifications = ["Essential", "Optimizable", "Optional"] as const;

type UnclassifiedExpenseRowProps = {
  transaction: Transaction;
  disabled: boolean;
  saving: boolean;
  failure?: { message: string; action: string; onAction: () => void };
  onClassify: (classification: SpendingFlexibility) => void;
};

export const UnclassifiedExpenseRow = ({
  transaction, disabled, saving, failure, onClassify,
}: UnclassifiedExpenseRowProps) => {
  const buttonId = useId();
  const menuId = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const description = transaction.description || "Expense";

  return (
    <Paper component="li" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Stack spacing={1}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ sm: "center" }}
          justifyContent="space-between"
          spacing={1}
        >
          <Box sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
            <Typography component="h2" variant="subtitle1" fontWeight={700}>{description}</Typography>
            <Typography variant="body2" color="text.secondary">
              {formatCalendarDate(transaction.date)} · {transaction.category}
            </Typography>
          </Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
            <Typography fontWeight={700} sx={{ fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}>
              {formatCurrency(transaction.amount)}
            </Typography>
            <Button
              id={buttonId}
              data-classify
              aria-label={`Classify ${description}`}
              aria-haspopup="menu"
              aria-expanded={anchor ? true : undefined}
              aria-controls={anchor ? menuId : undefined}
              disabled={disabled}
              loading={saving}
              endIcon={<ExpandMoreIcon />}
              onClick={(event) => setAnchor(event.currentTarget)}
              sx={{ minHeight: 44, flexShrink: 0 }}
            >
              Classify
            </Button>
            <Menu
              id={menuId}
              data-classification-menu
              anchorEl={anchor}
              open={Boolean(anchor)}
              onClose={() => setAnchor(null)}
              slotProps={{ list: { "aria-labelledby": buttonId } }}
            >
              {classifications.map((value) => (
                <MenuItem
                  key={value}
                  sx={{ display: "block", whiteSpace: "normal", maxWidth: 320 }}
                  onClick={() => {
                    setAnchor(null);
                    onClassify(value);
                  }}
                >
                  <Typography variant="body2" fontWeight={700}>{spendingFlexibilityChoices[value].label}</Typography>
                  <Typography variant="body2" color="text.secondary">{spendingFlexibilityChoices[value].description}</Typography>
                </MenuItem>
              ))}
            </Menu>
          </Stack>
        </Stack>
        {failure ? (
          <Alert severity="error" action={
            <Button data-classification-error-action color="inherit" size="small" disabled={disabled} onClick={failure.onAction}>
              {failure.action}
            </Button>
          }>
            {failure.message}
          </Alert>
        ) : null}
      </Stack>
    </Paper>
  );
};
