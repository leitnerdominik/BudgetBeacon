import {
  Box,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";

import { LoadingState, StatusMessage } from "../../components/AsyncState";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { useSlowLoading } from "../../hooks/useSlowLoading";
import { formatCurrency } from "../../utils/formatDate";
import {
  useMonthlyTrend,
  type MonthReference,
} from "./useMonthlyStatistics";

type MonthComparisonProps = {
  month: MonthReference;
};

type ComparisonMetric = {
  changeColor: string;
  changeLabel: string;
  currentValue: string;
  label: string;
  previousValue: string;
};

const COMPARISON_MONTH_COUNT = 2;

const shortMonthFormatter = new Intl.DateTimeFormat("de-DE", {
  month: "short",
  year: "2-digit",
});

const percentFormatter = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

const formatShortMonthLabel = ({ month, year }: MonthReference) =>
  shortMonthFormatter.format(new Date(year, month - 1, 1));

const formatChange = (current: number, previous: number) => {
  if (previous === 0) {
    return current === 0 ? "0 %" : "New";
  }

  const percentage = ((current - previous) / Math.abs(previous)) * 100;
  const prefix = percentage > 0 ? "+" : "";

  return `${prefix}${percentFormatter.format(percentage)} %`;
};

const getChangeColor = (
  current: number,
  previous: number,
  positiveIsGood: boolean,
) => {
  const delta = current - previous;

  if (delta === 0) {
    return "text.secondary";
  }

  return (delta > 0) === positiveIsGood ? "success.main" : "error.main";
};

export const MonthComparison = ({ month }: MonthComparisonProps) => {
  const isOnline = useNetworkStatus();
  const {
    data: comparisonPoints,
    isError,
    isFetching,
    isLoading,
    refetch,
  } = useMonthlyTrend(month, COMPARISON_MONTH_COUNT);
  const isSlow = useSlowLoading(isLoading);
  const previousPoint = comparisonPoints[0];
  const currentPoint = comparisonPoints[1];
  const previous = previousPoint?.summary;
  const current = currentPoint?.summary;

  const currentIncome = current?.totalIncome ?? 0;
  const previousIncome = previous?.totalIncome ?? 0;
  const currentExpenses = Math.abs(current?.totalExpense ?? 0);
  const previousExpenses = Math.abs(previous?.totalExpense ?? 0);
  const currentNet = current?.netBalance ?? 0;
  const previousNet = previous?.netBalance ?? 0;
  const currentTransactions = current?.transactionCount ?? 0;
  const previousTransactions = previous?.transactionCount ?? 0;

  const metrics: ComparisonMetric[] = [
    {
      label: "Income",
      currentValue: formatCurrency(currentIncome),
      previousValue: formatCurrency(previousIncome),
      changeLabel: formatChange(currentIncome, previousIncome),
      changeColor: getChangeColor(currentIncome, previousIncome, true),
    },
    {
      label: "Expenses",
      currentValue: formatCurrency(currentExpenses),
      previousValue: formatCurrency(previousExpenses),
      changeLabel: formatChange(currentExpenses, previousExpenses),
      changeColor: getChangeColor(currentExpenses, previousExpenses, false),
    },
    {
      label: "Net Balance",
      currentValue: formatCurrency(currentNet),
      previousValue: formatCurrency(previousNet),
      changeLabel: formatChange(currentNet, previousNet),
      changeColor: getChangeColor(currentNet, previousNet, true),
    },
    {
      label: "Transactions",
      currentValue: String(currentTransactions),
      previousValue: String(previousTransactions),
      changeLabel: formatChange(currentTransactions, previousTransactions),
      changeColor:
        currentTransactions === previousTransactions
          ? "text.secondary"
          : "primary.main",
    },
  ];

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
          <CompareArrowsIcon color="primary" />
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Month Comparison
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {previousPoint && currentPoint
                ? `${formatShortMonthLabel(currentPoint)} vs ${formatShortMonthLabel(previousPoint)}`
                : "Compared with the previous month"}
            </Typography>
          </Box>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {isLoading ? (
          <LoadingState
            label="Loading month comparison..."
            isOffline={!isOnline}
            isSlow={isSlow}
            minHeight={240}
          />
        ) : isError ? (
          <StatusMessage
            title={isOnline ? "Month comparison is unavailable" : "You're offline"}
            description={
              isOnline
                ? "We couldn't load the month comparison right now. Retry to refresh this view."
                : "Reconnect to the internet and retry to load the month comparison."
            }
            actionLabel="Retry comparison"
            onAction={() => {
              void refetch();
            }}
            minHeight={240}
          />
        ) : (
          <>
            {isFetching ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 1.5 }}
              >
                Refreshing month comparison...
              </Typography>
            ) : null}

            <Grid container spacing={1.5}>
              {metrics.map((metric) => (
                <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={metric.label}>
                  <Box
                    sx={{
                      height: "100%",
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1,
                      p: 2,
                    }}
                  >
                    <Typography variant="overline" color="text.secondary">
                      {metric.label}
                    </Typography>
                    <Typography variant="h6" fontWeight={700}>
                      {metric.currentValue}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{ mt: 1 }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Previous {metric.previousValue}
                      </Typography>
                      <Typography
                        variant="caption"
                        fontWeight={700}
                        color={metric.changeColor}
                      >
                        {metric.changeLabel}
                      </Typography>
                    </Stack>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </>
        )}
      </CardContent>
    </Card>
  );
};
