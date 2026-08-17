import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import Grid from "@mui/material/Grid";

import { LoadingState, StatusMessage } from "../../components/AsyncState";
import { defaultTransactionQuery } from "../../api/transactionsApi";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { useSlowLoading } from "../../hooks/useSlowLoading";
import { formatCurrency, formatDate } from "../../utils/formatDate";
import { isTipsSourceDataNotFound } from "../tips/tipErrors";
import { useTips } from "../tips/useTips";
import { useTransactions } from "../transactions/hooks/useTransactions";
import { TipOfTheDayCard } from "./TipOfTheDayCard";
import { useDashboardMonthlyOverview } from "./useDashboardMonthlyOverview";

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

export const Dashboard = () => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const isOnline = useNetworkStatus();

  const {
    data: summaryData,
    period: summaryPeriod,
    isFallback: isFallbackSummary,
    isError: isSummaryError,
    isLoading: isLoadingSummary,
    retry: retrySummary,
  } = useDashboardMonthlyOverview();
  const {
    data: transactionData,
    isError: isTransactionsError,
    isFetching: isFetchingTransactions,
    isLoading: isLoadingTransactions,
    refetch: refetchTransactions,
  } = useTransactions(1, 5, defaultTransactionQuery);
  const {
    data: tips,
    error: tipsError,
    isError: isTipsError,
    isFetching: isGeneratingTips,
    generateTips,
  } = useTips({ showSuccessNotification: false });
  const isTransactionsSlow = useSlowLoading(isLoadingTransactions);
  const isTipsSlow = useSlowLoading(isGeneratingTips);

  const tipOfTheDay = tips?.[0];
  const hasNoTransactionsForTips = isTipsSourceDataNotFound(tipsError);
  const summaryMonthLabel = monthFormatter.format(
    new Date(summaryPeriod.year, summaryPeriod.month - 1, 1),
  );
  const summaryCards = [
    {
      label: "Income",
      value: summaryData?.totalIncome ?? 0,
      color: "success.main",
      isCount: false,
    },
    {
      label: "Expenses",
      value: summaryData?.totalExpense ?? 0,
      color: "error.main",
      isCount: false,
    },
    {
      label: "Net Balance",
      value: summaryData?.netBalance ?? 0,
      color: "primary.main",
      isCount: false,
    },
    {
      label: "Transactions",
      value: summaryData?.transactionCount ?? 0,
      color: "text.primary",
      isCount: true,
    },
  ];

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Box sx={{ mb: { xs: 2, sm: 3 } }}>
        <Typography variant={isSmallScreen ? "h5" : "h4"} gutterBottom>
          Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Monthly overview and recent account activity.
        </Typography>
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "flex-start", sm: "baseline" },
          gap: { xs: 0.25, sm: 1.5 },
          mb: { xs: 1.5, sm: 2 },
        }}
      >
        <Typography variant="h6">Monthly overview</Typography>
        <Box>
          <Typography variant="body2" color="text.secondary">
            {summaryMonthLabel}
          </Typography>
          {isFallbackSummary ? (
            <Typography variant="caption" color="text.secondary">
              Latest month with transactions
            </Typography>
          ) : null}
        </Box>
      </Box>

      <Grid container spacing={{ xs: 1.5, sm: 2.5 }}>
        {summaryCards.map((card) => (
          <Grid size={{ xs: 6, sm: 6, lg: 3 }} key={card.label}>
            <Card
              sx={{
                height: "100%",
                borderTop: "3px solid",
                borderTopColor: card.color,
              }}
            >
              <CardContent sx={{ p: { xs: 1.75, sm: 2.25 } }}>
                <Typography
                  variant="overline"
                  color="text.secondary"
                  sx={{ lineHeight: 1.1 }}
                >
                  {card.label}
                </Typography>
                {isSummaryError ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Unavailable
                  </Typography>
                ) : isLoadingSummary ? (
                  <CircularProgress size={18} />
                ) : (
                  <Typography
                    variant={isSmallScreen ? "h6" : "h5"}
                    fontWeight="bold"
                    color={card.color}
                    sx={{ mt: 0.5 }}
                  >
                    {card.isCount
                      ? card.value
                      : formatCurrency(Number(card.value))}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
        {isSummaryError ? (
          <Grid size={{ xs: 12 }}>
            <StatusMessage
              title={isOnline ? "Monthly overview is unavailable" : "You're offline"}
              description={
                isOnline
                  ? "We couldn't load the monthly overview right now. Retry to refresh your dashboard metrics."
                  : "Reconnect to the internet and retry to load your monthly overview."
              }
              actionLabel="Retry summary"
              onAction={retrySummary}
              minHeight="auto"
            />
          </Grid>
        ) : null}

        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
              <Typography variant="h6" gutterBottom>
                Recent Transactions
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 1 }}
              >
                Latest entries from the backend
              </Typography>
              <Divider sx={{ mb: 1.5 }} />

              {isLoadingTransactions ? (
                <LoadingState
                  label="Loading recent transactions..."
                  isOffline={!isOnline}
                  isSlow={isTransactionsSlow}
                  minHeight={220}
                />
              ) : isTransactionsError ? (
                <StatusMessage
                  title={isOnline ? "Recent transactions are unavailable" : "You're offline"}
                  description={
                    isOnline
                      ? "We couldn't load recent transactions for the dashboard. Please try again."
                      : "Reconnect to the internet and retry to load recent transactions."
                  }
                  actionLabel="Retry"
                  onAction={() => {
                    void refetchTransactions();
                  }}
                  minHeight={220}
                />
              ) : transactionData?.data.length ? (
                <>
                  {isFetchingTransactions ? (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block", mb: 1 }}
                    >
                      {isOnline
                        ? "Refreshing recent transactions..."
                        : "Waiting for network to refresh transactions..."}
                    </Typography>
                  ) : null}
                  <List disablePadding>
                    {transactionData.data.map((tx) => (
                      <ListItem
                        key={tx.id}
                        divider
                        disableGutters
                        sx={{ py: { xs: 1.25, sm: 1.5 } }}
                      >
                        <ListItemText
                          primary={tx.description}
                          secondary={formatDate(tx.date)}
                          primaryTypographyProps={{
                            fontSize: { xs: "0.95rem", sm: "1rem" },
                            fontWeight: 600,
                          }}
                          secondaryTypographyProps={{
                            fontSize: { xs: "0.75rem", sm: "0.875rem" },
                          }}
                        />
                        <Typography
                          variant="body1"
                          fontWeight="bold"
                          color={tx.amount < 0 ? "error.main" : "success.main"}
                          sx={{ ml: 2, whiteSpace: "nowrap", fontSize: { xs: "0.95rem", sm: "1rem" } }}
                        >
                          {formatCurrency(tx.amount)}
                        </Typography>
                      </ListItem>
                    ))}
                  </List>
                </>
              ) : (
                <StatusMessage
                  title="No recent transactions yet"
                  description="Add a transaction manually or import a CSV file to populate your dashboard."
                  minHeight={220}
                />
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <TipOfTheDayCard
            tip={tipOfTheDay}
            hasGeneratedTips={tips !== undefined}
            isGenerating={isGeneratingTips}
            isError={isTipsError}
            hasNoTransactionsForTips={hasNoTransactionsForTips}
            isOnline={isOnline}
            isSmallScreen={isSmallScreen}
            isSlow={isTipsSlow}
            onGenerate={() => {
              void generateTips();
            }}
          />
        </Grid>
      </Grid>
    </Box>
  );
};
