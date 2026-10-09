import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";

import { StatusMessage } from "../../components/AsyncState";
import type { TopExpense } from "../../types/api";
import { formatCurrency, formatDate } from "../../utils/formatDate";
import { TransactionCategoryIcon } from "../transactions/components/TransactionCategoryIcon";
import { statisticsContentSx, statisticsSurfaceSx } from "./statisticsLayout";

type TopExpensesProps = {
  expenses: TopExpense[];
  periodLabel: string;
};

export const TopExpenses = ({
  expenses,
  periodLabel,
}: TopExpensesProps) => (
  <Card
    elevation={0}
    component="section"
    aria-label="Largest Expenses"
    sx={statisticsSurfaceSx}
  >
    <CardContent sx={statisticsContentSx}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        sx={{ minWidth: 0 }}
      >
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ minWidth: 0, maxWidth: "100%" }}
        >
          <ReceiptLongIcon color="primary" sx={{ flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h2" variant="h6" fontWeight={700}>
              Largest Expenses
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ overflowWrap: "anywhere" }}
            >
              Top expense transactions for {periodLabel}
            </Typography>
          </Box>
        </Stack>
        <Chip
          label={`${expenses.length} shown`}
          size="small"
          color={expenses.length > 0 ? "primary" : "default"}
          variant={expenses.length > 0 ? "filled" : "outlined"}
        />
      </Stack>

      <Divider sx={{ my: 2 }} />

      {expenses.length === 0 ? (
        <StatusMessage
          title="No expense transactions"
          description={`No expense transactions were found for ${periodLabel}.`}
          minHeight={160}
        />
      ) : (
        <List disablePadding>
          {expenses.map((expense) => (
            <ListItem
              key={expense.id}
              disableGutters
              divider
              sx={{
                py: { xs: 1.25, sm: 1.5 },
                alignItems: { xs: "flex-start", sm: "center" },
                flexDirection: { xs: "column", sm: "row" },
                gap: { xs: 0.75, sm: 0 },
              }}
            >
              <Stack direction="row" spacing={1} sx={{ minWidth: 0, width: "100%" }}>
                <Box sx={{ pt: 0.25, flexShrink: 0 }}>
                  <TransactionCategoryIcon
                    category={expense.category}
                    fontSize="small"
                    color="action"
                  />
                </Box>
                <ListItemText
                  primary={expense.description}
                  secondary={`${expense.category} - ${formatDate(expense.date)}`}
                  sx={{ minWidth: 0, width: "100%", m: 0 }}
                  primaryTypographyProps={{
                    fontWeight: 700,
                    fontSize: { xs: "0.95rem", sm: "1rem" },
                    sx: { overflowWrap: "anywhere" },
                  }}
                  secondaryTypographyProps={{
                    fontSize: { xs: "0.75rem", sm: "0.875rem" },
                    sx: { overflowWrap: "anywhere" },
                  }}
                />
              </Stack>
              <Typography
                variant="subtitle1"
                fontWeight={700}
                color="text.primary"
                sx={{
                  alignSelf: { xs: "flex-end", sm: "center" },
                  ml: { xs: 0, sm: 2 },
                  minWidth: 0,
                  maxWidth: "100%",
                  overflowWrap: "anywhere",
                }}
              >
                {formatCurrency(expense.amount)}
              </Typography>
            </ListItem>
          ))}
        </List>
      )}
    </CardContent>
  </Card>
);
