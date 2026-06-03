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

import { LoadingState, StatusMessage } from "../../components/AsyncState";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { useSlowLoading } from "../../hooks/useSlowLoading";
import { formatCurrency, formatDate } from "../../utils/formatDate";
import {
  useMonthlyTopExpenses,
  type MonthReference,
} from "./useMonthlyStatistics";

type TopExpensesProps = {
  month: MonthReference;
};

const TOP_EXPENSE_LIMIT = 5;

export const TopExpenses = ({ month }: TopExpensesProps) => {
  const isOnline = useNetworkStatus();
  const {
    data: expenses = [],
    isError,
    isFetching,
    isLoading,
    refetch,
  } = useMonthlyTopExpenses(month.year, month.month, TOP_EXPENSE_LIMIT);
  const isSlow = useSlowLoading(isLoading);

  return (
    <Card
      elevation={1}
      sx={{
        mt: 2,
        borderRadius: 1,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <ReceiptLongIcon color="primary" />
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Largest Expenses
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Top {TOP_EXPENSE_LIMIT} expense transactions for this month
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

        {isLoading ? (
          <LoadingState
            label="Loading largest expenses..."
            isOffline={!isOnline}
            isSlow={isSlow}
            minHeight={260}
          />
        ) : isError ? (
          <StatusMessage
            title={isOnline ? "Largest expenses are unavailable" : "You're offline"}
            description={
              isOnline
                ? "We couldn't load the largest expenses right now. Retry to refresh this view."
                : "Reconnect to the internet and retry to load the largest expenses."
            }
            actionLabel="Retry expenses"
            onAction={() => {
              void refetch();
            }}
            minHeight={260}
          />
        ) : expenses.length === 0 ? (
          <StatusMessage
            title="No expense transactions"
            description="No expense transactions were found for the selected month."
            minHeight={220}
          />
        ) : (
          <>
            {isFetching ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 1 }}
              >
                Refreshing largest expenses...
              </Typography>
            ) : null}
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
                  <ListItemText
                    primary={expense.description}
                    secondary={`${expense.category} • ${formatDate(expense.date)}`}
                    sx={{ minWidth: 0, width: "100%" }}
                    primaryTypographyProps={{
                      fontWeight: 700,
                      fontSize: { xs: "0.95rem", sm: "1rem" },
                      sx: { overflowWrap: "anywhere" },
                    }}
                    secondaryTypographyProps={{
                      fontSize: { xs: "0.75rem", sm: "0.875rem" },
                    }}
                  />
                  <Typography
                    variant="subtitle1"
                    fontWeight={700}
                    color="error.main"
                    sx={{
                      alignSelf: { xs: "flex-end", sm: "center" },
                      ml: { xs: 0, sm: 2 },
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatCurrency(expense.amount)}
                  </Typography>
                </ListItem>
              ))}
            </List>
          </>
        )}
      </CardContent>
    </Card>
  );
};
