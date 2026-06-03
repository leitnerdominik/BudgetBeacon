import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import BarChartIcon from "@mui/icons-material/BarChart";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import SavingsIcon from "@mui/icons-material/Savings";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

import { LoadingState, StatusMessage } from "../../components/AsyncState";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { useSlowLoading } from "../../hooks/useSlowLoading";
import { formatCurrency } from "../../utils/formatDate";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { MonthComparison } from "./MonthComparison";
import { MonthlyTrend } from "./MonthlyTrend";
import { RecurringExpenses } from "./RecurringExpenses";
import { SpendingPace } from "./SpendingPace";
import { TopExpenses } from "./TopExpenses";
import { useMonthlyStatistics, type MonthReference } from "./useMonthlyStatistics";

type MetricCard = {
  color: string;
  icon: React.ReactNode;
  label: string;
  value: string | number;
};

const monthFormatter = new Intl.DateTimeFormat("de-DE", {
  month: "long",
  year: "numeric",
});

const percentFormatter = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

const getCurrentMonthSelection = (): MonthReference => {
  const today = new Date();

  return {
    month: today.getMonth() + 1,
    year: today.getFullYear(),
  };
};

const toMonthInputValue = ({ month, year }: MonthReference) =>
  `${year}-${String(month).padStart(2, "0")}`;

const parseMonthInputValue = (value: string): MonthReference | null => {
  const [yearValue, monthValue] = value.split("-");
  const year = Number(yearValue);
  const month = Number(monthValue);

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return null;
  }

  if (year < 2000 || year > 2100 || month < 1 || month > 12) {
    return null;
  }

  return { year, month };
};

const shiftMonth = (
  { month, year }: MonthReference,
  offset: number,
): MonthReference => {
  const date = new Date(year, month - 1 + offset, 1);

  return {
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
};

const formatMonthLabel = ({ month, year }: MonthReference) =>
  monthFormatter.format(new Date(year, month - 1, 1));

const formatSavingsRate = (value: number | null) =>
  value === null ? "N/A" : `${percentFormatter.format(value)} %`;

export const MonthlyOverview = () => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const isOnline = useNetworkStatus();
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthSelection);

  const {
    data: summary,
    isError,
    isFetching,
    isLoading,
    refetch,
  } = useMonthlyStatistics(selectedMonth.year, selectedMonth.month);
  const isSlow = useSlowLoading(isLoading);

  const metrics = useMemo<MetricCard[]>(() => {
    const income = summary?.totalIncome ?? 0;
    const expenses = Math.abs(summary?.totalExpense ?? 0);
    const netBalance = summary?.netBalance ?? 0;
    const savingsRate = income > 0 ? (netBalance / income) * 100 : null;

    return [
      {
        label: "Income",
        value: formatCurrency(income),
        color: "success.main",
        icon: <TrendingUpIcon />,
      },
      {
        label: "Expenses",
        value: formatCurrency(expenses),
        color: "error.main",
        icon: <TrendingDownIcon />,
      },
      {
        label: "Net Balance",
        value: formatCurrency(netBalance),
        color: netBalance < 0 ? "error.main" : "primary.main",
        icon: <AccountBalanceWalletIcon />,
      },
      {
        label: "Savings Rate",
        value: formatSavingsRate(savingsRate),
        color: savingsRate !== null && savingsRate < 0 ? "error.main" : "success.main",
        icon: <SavingsIcon />,
      },
      {
        label: "Transactions",
        value: summary?.transactionCount ?? 0,
        color: "text.primary",
        icon: <ReceiptLongIcon />,
      },
    ];
  }, [summary]);

  const hasTransactions = (summary?.transactionCount ?? 0) > 0;

  const handleMonthChange = (value: string) => {
    const parsedMonth = parseMonthInputValue(value);

    if (parsedMonth) {
      setSelectedMonth(parsedMonth);
    }
  };

  const handlePreviousMonth = () => {
    setSelectedMonth((current) => shiftMonth(current, -1));
  };

  const handleNextMonth = () => {
    setSelectedMonth((current) => shiftMonth(current, 1));
  };

  const handleCurrentMonth = () => {
    setSelectedMonth(getCurrentMonthSelection());
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "flex-start" }}
        sx={{ mb: 3 }}
      >
        <Box>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <BarChartIcon color="primary" />
            <Typography variant={isSmallScreen ? "h5" : "h4"} fontWeight={700}>
              Statistics
            </Typography>
          </Stack>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.75 }}>
            {formatMonthLabel(selectedMonth)}
          </Typography>
        </Box>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Previous month">
              <IconButton aria-label="Previous month" onClick={handlePreviousMonth}>
                <ChevronLeftIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Next month">
              <IconButton aria-label="Next month" onClick={handleNextMonth}>
                <ChevronRightIcon />
              </IconButton>
            </Tooltip>
          </Stack>
          <TextField
            label="Month"
            type="month"
            size="small"
            value={toMonthInputValue(selectedMonth)}
            onChange={(event) => handleMonthChange(event.target.value)}
            inputProps={{
              min: "2000-01",
              max: "2100-12",
            }}
            InputLabelProps={{ shrink: true }}
          />
          <Button
            variant="outlined"
            startIcon={<CalendarMonthIcon />}
            onClick={handleCurrentMonth}
          >
            Current
          </Button>
        </Stack>
      </Stack>

      {isLoading ? (
        <LoadingState
          label="Loading monthly statistics..."
          isOffline={!isOnline}
          isSlow={isSlow}
          minHeight={340}
        />
      ) : isError ? (
        <StatusMessage
          title={isOnline ? "Statistics are unavailable" : "You're offline"}
          description={
            isOnline
              ? "We couldn't load the monthly statistics right now. Retry to refresh this view."
              : "Reconnect to the internet and retry to load your monthly statistics."
          }
          actionLabel="Retry"
          onAction={() => {
            void refetch();
          }}
          minHeight={340}
        />
      ) : (
        <>
          {isFetching ? (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mb: 1.5 }}
            >
              Refreshing monthly statistics...
            </Typography>
          ) : null}

          <Grid container spacing={{ xs: 1.5, sm: 2 }}>
            {metrics.map((metric) => (
              <Grid size={{ xs: 12, sm: 6, lg: 2.4 }} key={metric.label}>
                <Card
                  elevation={1}
                  sx={{
                    height: "100%",
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <CardContent sx={{ p: { xs: 2, sm: 2.25 } }}>
                    <Stack spacing={1.5}>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <Typography variant="overline" color="text.secondary">
                          {metric.label}
                        </Typography>
                        <Box sx={{ color: metric.color, display: "flex" }}>
                          {metric.icon}
                        </Box>
                      </Stack>
                      <Typography
                        variant={isSmallScreen ? "h6" : "h5"}
                        fontWeight={700}
                        color={metric.color}
                      >
                        {metric.value}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

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
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    Monthly Overview
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {hasTransactions
                      ? "Income, expenses and balance for the selected month."
                      : "No transactions found for the selected month."}
                  </Typography>
                </Box>
                <Chip
                  label={hasTransactions ? "Data available" : "No data"}
                  color={hasTransactions ? "success" : "default"}
                  variant={hasTransactions ? "filled" : "outlined"}
                />
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Average Expense
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {formatCurrency(Math.abs(summary?.averageExpense ?? 0))}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Median Expense
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {formatCurrency(Math.abs(summary?.medianExpense ?? 0))}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Expense Ratio
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {summary && summary.totalIncome > 0
                      ? formatSavingsRate(
                          (Math.abs(summary.totalExpense) / summary.totalIncome) * 100,
                        )
                      : "N/A"}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <SpendingPace month={selectedMonth} summary={summary} />

          <MonthComparison month={selectedMonth} />

          <CategoryBreakdown month={selectedMonth} />

          <TopExpenses month={selectedMonth} />

          <RecurringExpenses month={selectedMonth} />

          <MonthlyTrend endMonth={selectedMonth} />
        </>
      )}
    </Box>
  );
};
