import {
  Box,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import CategoryIcon from "@mui/icons-material/Category";

import { LoadingState, StatusMessage } from "../../components/AsyncState";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { useSlowLoading } from "../../hooks/useSlowLoading";
import { formatCurrency } from "../../utils/formatDate";
import {
  useMonthlyCategorySummary,
  type MonthReference,
} from "./useMonthlyStatistics";

type CategoryBreakdownProps = {
  month: MonthReference;
};

const percentFormatter = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

const formatPercent = (value: number) => `${percentFormatter.format(value)} %`;

export const CategoryBreakdown = ({ month }: CategoryBreakdownProps) => {
  const isOnline = useNetworkStatus();
  const {
    data: categories = [],
    isError,
    isFetching,
    isLoading,
    refetch,
  } = useMonthlyCategorySummary(month.year, month.month);
  const isSlow = useSlowLoading(isLoading);
  const maxExpense = Math.max(
    1,
    ...categories.map((category) => category.totalExpense),
  );
  const totalExpenses = categories.reduce(
    (sum, category) => sum + category.totalExpense,
    0,
  );

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
        <Stack direction="row" spacing={1} alignItems="center">
          <CategoryIcon color="primary" />
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Expenses by Category
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatCurrency(totalExpenses)} across {categories.length} categories
            </Typography>
          </Box>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {isLoading ? (
          <LoadingState
            label="Loading category expenses..."
            isOffline={!isOnline}
            isSlow={isSlow}
            minHeight={260}
          />
        ) : isError ? (
          <StatusMessage
            title={isOnline ? "Category expenses are unavailable" : "You're offline"}
            description={
              isOnline
                ? "We couldn't load category expenses right now. Retry to refresh this view."
                : "Reconnect to the internet and retry to load category expenses."
            }
            actionLabel="Retry categories"
            onAction={() => {
              void refetch();
            }}
            minHeight={260}
          />
        ) : categories.length === 0 ? (
          <StatusMessage
            title="No expenses for this month"
            description="No expense categories were found for the selected month."
            minHeight={220}
          />
        ) : (
          <Stack spacing={1.75}>
            {isFetching ? (
              <Typography variant="caption" color="text.secondary">
                Refreshing category expenses...
              </Typography>
            ) : null}

            {categories.map((category) => (
              <Box key={category.category}>
                <Stack
                  direction="row"
                  spacing={1.5}
                  alignItems="baseline"
                  justifyContent="space-between"
                  sx={{ mb: 0.75 }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="subtitle2"
                      fontWeight={700}
                      sx={{ overflowWrap: "anywhere" }}
                    >
                      {category.category}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {category.transactionCount} transactions
                    </Typography>
                  </Box>
                  <Stack alignItems="flex-end" sx={{ flexShrink: 0 }}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      {formatCurrency(category.totalExpense)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatPercent(category.percentage)}
                    </Typography>
                  </Stack>
                </Stack>
                <Box
                  aria-label={`${category.category}: ${formatCurrency(category.totalExpense)}, ${formatPercent(category.percentage)}`}
                  role="img"
                  sx={{
                    height: 8,
                    borderRadius: 1,
                    bgcolor: "action.hover",
                    overflow: "hidden",
                  }}
                >
                  <Box
                    sx={{
                      width: `${Math.max((category.totalExpense / maxExpense) * 100, 3)}%`,
                      height: "100%",
                      borderRadius: 1,
                      bgcolor: "primary.main",
                    }}
                  />
                </Box>
              </Box>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};
