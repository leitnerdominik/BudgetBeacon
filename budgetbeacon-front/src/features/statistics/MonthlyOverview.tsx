import { useMemo } from "react";
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
  ToggleButton,
  ToggleButtonGroup,
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
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  defaultTransactionQuery,
  type StatisticsRequest,
} from "../../api/transactionsApi";
import { LoadingState, StatusMessage } from "../../components/AsyncState";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { useSlowLoading } from "../../hooks/useSlowLoading";
import { formatCurrency } from "../../utils/formatDate";
import { buildTransactionListSearchParams } from "../transactions/transactionListUrlState";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { MonthComparison } from "./MonthComparison";
import { MonthlyTrend } from "./MonthlyTrend";
import { RecurringExpenses } from "./RecurringExpenses";
import { SpendingPace } from "./SpendingPace";
import { TopExpenses } from "./TopExpenses";
import { useStatistics, type MonthReference } from "./useStatistics";

type MetricCard = {
  color: string;
  icon: React.ReactNode;
  label: string;
  value: string | number;
};

type TimeframeValue = "all" | "12" | "6" | "3" | "1";

const timeframeOptions: Array<{ label: string; value: TimeframeValue }> = [
  { value: "all", label: "All time" },
  { value: "12", label: "1 year" },
  { value: "6", label: "6 months" },
  { value: "3", label: "3 months" },
  { value: "1", label: "1 month" },
];

const timeframeValues = new Set<TimeframeValue>(
  timeframeOptions.map((option) => option.value),
);

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

const parseTimeframeValue = (value: string | null): TimeframeValue =>
  value && timeframeValues.has(value as TimeframeValue)
    ? (value as TimeframeValue)
    : "1";

const buildStatisticsSearchParams = (
  currentSearchParams: URLSearchParams,
  timeframe: TimeframeValue,
  selectedMonth: MonthReference,
) => {
  const params = new URLSearchParams(currentSearchParams);

  params.set("timeframe", timeframe);

  if (timeframe === "all") {
    params.delete("month");
  } else {
    params.set("month", toMonthInputValue(selectedMonth));
  }

  return params;
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

const formatPeriodLabel = (
  timeframe: TimeframeValue,
  endMonth: MonthReference,
) => {
  if (timeframe === "all") {
    return "All time";
  }

  const monthCount = Number(timeframe);
  if (monthCount === 1) {
    return formatMonthLabel(endMonth);
  }

  const startMonth = shiftMonth(endMonth, -monthCount + 1);
  return `${formatMonthLabel(startMonth)} - ${formatMonthLabel(endMonth)}`;
};

const formatSavingsRate = (value: number | null) =>
  value === null ? "N/A" : `${percentFormatter.format(value)} %`;

const toTransactionFilterDate = (value: string | null | undefined) =>
  value ? value.slice(0, 10) : "";

export const MonthlyOverview = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const isOnline = useNetworkStatus();
  const timeframe = useMemo(
    () => parseTimeframeValue(searchParams.get("timeframe")),
    [searchParams],
  );
  const selectedMonth = useMemo(
    () =>
      parseMonthInputValue(searchParams.get("month") ?? "") ??
      getCurrentMonthSelection(),
    [searchParams],
  );
  const isAllTime = timeframe === "all";
  const isMonthlyView = timeframe === "1";
  const periodLabel = formatPeriodLabel(timeframe, selectedMonth);
  const request = useMemo<StatisticsRequest>(() => {
    if (timeframe === "all") {
      return { allTime: true };
    }

    return {
      allTime: false,
      endYear: selectedMonth.year,
      endMonth: selectedMonth.month,
      monthsBack: Number(timeframe) as 1 | 3 | 6 | 12,
    };
  }, [selectedMonth.month, selectedMonth.year, timeframe]);

  const {
    data,
    isError,
    isFetching,
    isLoading,
    refetch,
  } = useStatistics(request);
  const isSlow = useSlowLoading(isLoading);
  const summary = data?.summary;

  const metrics = useMemo<MetricCard[]>(() => {
    const income = summary?.totalIncome ?? 0;
    const expenses = Math.abs(summary?.totalExpense ?? 0);
    const netBalance = summary?.netBalance ?? 0;
    const savedOrInvested = summary?.totalSavedOrInvested ?? 0;
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
        label: "Saved / Invested",
        value: formatCurrency(savedOrInvested),
        color: "primary.main",
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
  const excludedTotal =
    (summary?.internalTransferTotal ?? 0) + (summary?.adjustmentTotal ?? 0);

  const updatePeriodSearchParams = (
    nextTimeframe: TimeframeValue,
    nextSelectedMonth: MonthReference,
  ) => {
    setSearchParams(
      buildStatisticsSearchParams(searchParams, nextTimeframe, nextSelectedMonth),
      { replace: true },
    );
  };

  const handleMonthChange = (value: string) => {
    const parsedMonth = parseMonthInputValue(value);

    if (parsedMonth) {
      updatePeriodSearchParams(timeframe, parsedMonth);
    }
  };

  const handleTimeframeChange = (value: TimeframeValue) => {
    updatePeriodSearchParams(value, selectedMonth);
  };

  const handleMonthShift = (offset: number) => {
    updatePeriodSearchParams(timeframe, shiftMonth(selectedMonth, offset));
  };

  const handleCurrentMonthSelect = () => {
    updatePeriodSearchParams(timeframe, getCurrentMonthSelection());
  };

  const handleCategorySelect = (category: string) => {
    const searchParams = buildTransactionListSearchParams({
      page: 0,
      pageSize: 10,
      query: {
        ...defaultTransactionQuery,
        category,
        transactionType: "expense",
        startDate: toTransactionFilterDate(data?.startDate),
        endDate: toTransactionFilterDate(data?.endDate),
      },
    });

    navigate(`/transactions?${searchParams.toString()}`);
  };

  return (
    <Box sx={{ flexGrow: 1, minWidth: 0, maxWidth: "100%" }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={{ xs: 1.75, sm: 2 }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "flex-start" }}
        sx={{ mb: { xs: 2, sm: 3 }, minWidth: 0, maxWidth: "100%" }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box
              aria-hidden="true"
              sx={{
                width: { xs: 34, sm: 38 },
                height: { xs: 34, sm: 38 },
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
              <BarChartIcon fontSize={isSmallScreen ? "small" : "medium"} />
            </Box>
            <Typography variant={isSmallScreen ? "h5" : "h4"} fontWeight={700}>
              Statistics
            </Typography>
          </Stack>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ mt: 0.75, overflowWrap: "anywhere" }}
          >
            {periodLabel}
          </Typography>
        </Box>

        <Stack
          spacing={1}
          alignItems={{ xs: "stretch", md: "flex-end" }}
          sx={{ width: { xs: "100%", md: "auto" }, minWidth: 0, maxWidth: "100%" }}
        >
          <ToggleButtonGroup
            value={timeframe}
            exclusive
            onChange={(_, value: TimeframeValue | null) => {
              if (value) {
                handleTimeframeChange(value);
              }
            }}
            aria-label="Statistics timeframe"
            size="small"
            sx={{
              width: { xs: "100%", md: "auto" },
              flexWrap: "wrap",
              "& .MuiToggleButton-root": {
                flex: { xs: "1 1 calc(50% - 1px)", sm: "initial" },
                minWidth: { xs: 0, sm: "auto" },
                px: { xs: 1, sm: 1.5 },
                whiteSpace: "nowrap",
              },
            }}
          >
            {timeframeOptions.map((option) => (
              <ToggleButton
                key={option.value}
                value={option.value}
                aria-label={option.label}
              >
                {option.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {!isAllTime ? (
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ xs: "stretch", sm: "center" }}
              sx={{
                width: { xs: "100%", sm: "auto" },
                minWidth: 0,
                p: { xs: 1, sm: 0 },
                border: { xs: "1px solid", sm: "none" },
                borderColor: "divider",
                borderRadius: { xs: 1, sm: 0 },
                bgcolor: { xs: "background.paper", sm: "transparent" },
              }}
            >
              <Stack direction="row" spacing={0.75} sx={{ minWidth: 0 }}>
                <Tooltip title="Previous month">
                  <IconButton
                    aria-label="Previous month"
                    onClick={() => handleMonthShift(-1)}
                    sx={{ flex: { xs: 1, sm: "initial" } }}
                  >
                    <ChevronLeftIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Next month">
                  <IconButton
                    aria-label="Next month"
                    onClick={() => handleMonthShift(1)}
                    sx={{ flex: { xs: 1, sm: "initial" } }}
                  >
                    <ChevronRightIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
              <TextField
                label={isMonthlyView ? "Month" : "End month"}
                type="month"
                size="small"
                value={toMonthInputValue(selectedMonth)}
                onChange={(event) => handleMonthChange(event.target.value)}
                inputProps={{
                  min: "2000-01",
                  max: "2100-12",
                }}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 0, width: { xs: "100%", sm: 170 } }}
              />
              <Button
                variant="outlined"
                startIcon={<CalendarMonthIcon />}
                onClick={handleCurrentMonthSelect}
                sx={{ whiteSpace: "nowrap", width: { xs: "100%", sm: "auto" } }}
              >
                Current
              </Button>
            </Stack>
          ) : null}
        </Stack>
      </Stack>

      {isLoading ? (
        <LoadingState
          label="Loading statistics..."
          isOffline={!isOnline}
          isSlow={isSlow}
          minHeight={340}
        />
      ) : isError ? (
        <StatusMessage
          title={isOnline ? "Statistics are unavailable" : "You're offline"}
          description={
            isOnline
              ? "We couldn't load the statistics right now. Retry to refresh this view."
              : "Reconnect to the internet and retry to load your statistics."
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
              Refreshing statistics...
            </Typography>
          ) : null}

          <Grid container spacing={{ xs: 1.25, sm: 2 }}>
            {metrics.map((metric) => (
              <Grid size={{ xs: 6, sm: 6, lg: 2 }} key={metric.label}>
                <Card
                  elevation={1}
                  sx={{
                    height: "100%",
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: "divider",
                    overflow: "hidden",
                  }}
                >
                  <CardContent sx={{ p: { xs: 1.5, sm: 2.25 } }}>
                    <Stack spacing={{ xs: 1, sm: 1.5 }}>
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
                        sx={{
                          fontSize: { xs: "1rem", sm: "1.5rem" },
                          lineHeight: 1.2,
                          overflowWrap: "anywhere",
                        }}
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
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h6" fontWeight={700}>
                    Period Overview
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ overflowWrap: "anywhere" }}
                  >
                    {hasTransactions
                      ? `Income, expenses and balance for ${periodLabel}.`
                      : `No transactions found for ${periodLabel}.`}
                  </Typography>
                </Box>
                <Chip
                  label={
                    excludedTotal > 0
                      ? `Excluded ${formatCurrency(excludedTotal)}`
                      : hasTransactions
                        ? "Data available"
                        : "No data"
                  }
                  color={excludedTotal > 0 ? "default" : hasTransactions ? "success" : "default"}
                  variant={hasTransactions && excludedTotal === 0 ? "filled" : "outlined"}
                />
              </Stack>
              {excludedTotal > 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Internal transfers and adjustments are excluded from income,
                  expenses, net balance, savings rate, and spending charts.
                </Typography>
              ) : null}

              <Divider sx={{ my: 2 }} />

              <Grid container spacing={{ xs: 1.5, sm: 2 }}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Average Expense
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {formatCurrency(Math.abs(summary?.averageExpense ?? 0))}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Median Expense
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {formatCurrency(Math.abs(summary?.medianExpense ?? 0))}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
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

          {isMonthlyView ? (
            <>
              <SpendingPace month={selectedMonth} summary={summary} />
              {summary && data?.previousMonthSummary ? (
                <MonthComparison
                  month={selectedMonth}
                  current={summary}
                  previous={data.previousMonthSummary}
                />
              ) : null}
            </>
          ) : null}

          <CategoryBreakdown
            categories={data?.categories ?? []}
            onCategorySelect={handleCategorySelect}
            periodLabel={periodLabel}
          />

          <TopExpenses expenses={data?.topExpenses ?? []} periodLabel={periodLabel} />

          {!isMonthlyView ? (
            <RecurringExpenses
              candidates={data?.recurringExpenses ?? []}
              periodLabel={periodLabel}
            />
          ) : null}

          <MonthlyTrend
            points={data?.trend ?? []}
            granularity={data?.trendGranularity ?? (isAllTime ? "year" : "month")}
            periodLabel={periodLabel}
          />
        </>
      )}
    </Box>
  );
};
