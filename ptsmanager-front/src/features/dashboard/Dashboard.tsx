import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
import LightbulbCircleIcon from "@mui/icons-material/LightbulbCircle";

import { LoadingState, StatusMessage } from "../../components/AsyncState";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { useSlowLoading } from "../../hooks/useSlowLoading";
import { formatCurrency, formatDate } from "../../utils/formatDate";
import { isTipsSourceDataNotFound } from "../tips/tipErrors";
import { useTips } from "../tips/useTips";
import { useMonthlySummary } from "../transactions/hooks/useMonthlySummary";
import { useTransactions } from "../transactions/hooks/useTransactions";

const MOBILE_TIP_PREVIEW_LINES = 4;

export const Dashboard = () => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const isOnline = useNetworkStatus();
  const [tipExpanded, setTipExpanded] = useState(false);
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  const {
    data: summaryData,
    isError: isSummaryError,
    isLoading: isLoadingSummary,
    refetch: refetchSummary,
  } = useMonthlySummary(year, month);
  const {
    data: transactionData,
    isError: isTransactionsError,
    isFetching: isFetchingTransactions,
    isLoading: isLoadingTransactions,
    refetch: refetchTransactions,
  } = useTransactions(1, 5);
  const {
    data: tips,
    error: tipsError,
    isError: isTipsError,
    isLoading: isLoadingTips,
    refetch: refetchTips,
  } = useTips({ showSuccessNotification: false });
  const isTransactionsSlow = useSlowLoading(isLoadingTransactions);
  const isTipsSlow = useSlowLoading(isLoadingTips);

  const tipOfTheDay = tips?.[0];
  const hasNoTransactionsForTips = isTipsSourceDataNotFound(tipsError);
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
              title={isOnline ? "Monthly summary is unavailable" : "You're offline"}
              description={
                isOnline
                  ? "We couldn't load this month's summary right now. Retry to refresh your dashboard metrics."
                  : "Reconnect to the internet and retry to load your latest monthly summary."
              }
              actionLabel="Retry summary"
              onAction={() => {
                void refetchSummary();
              }}
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
                  description="Import a CSV file to populate your dashboard with recent activity."
                  minHeight={220}
                />
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card
            sx={{
              height: "100%",
              backgroundColor: "primary.dark",
              color: "primary.contrastText",
            }}
          >
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
              <Box
                sx={{ display: "flex", alignItems: "center", mb: 1.5, gap: 1 }}
              >
                <LightbulbCircleIcon fontSize={isSmallScreen ? "medium" : "large"} />
                <Typography variant={isSmallScreen ? "subtitle1" : "h6"}>
                  Tip of the Day
                </Typography>
              </Box>

              {isLoadingTips ? (
                <LoadingState
                  label="Loading your tip of the day..."
                  isOffline={!isOnline}
                  isSlow={isTipsSlow}
                  minHeight={220}
                  inverted
                />
              ) : tipOfTheDay ? (
                <>
                  <Typography
                    variant={isSmallScreen ? "body1" : "subtitle1"}
                    fontWeight="bold"
                    gutterBottom
                  >
                    {tipOfTheDay.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    paragraph
                    sx={
                      isSmallScreen && !tipExpanded
                        ? {
                            display: "-webkit-box",
                            WebkitLineClamp: MOBILE_TIP_PREVIEW_LINES,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            mb: 1,
                          }
                        : undefined
                    }
                  >
                    {tipOfTheDay.description}
                  </Typography>
                  {isSmallScreen && tipOfTheDay.description.length > 140 ? (
                    <Button
                      size="small"
                      onClick={() => setTipExpanded((current) => !current)}
                      sx={{
                        mb: 1.5,
                        px: 0,
                        minWidth: 0,
                        color: "inherit",
                        textTransform: "none",
                        fontWeight: 700,
                      }}
                    >
                      {tipExpanded ? "Show less" : "Read more"}
                    </Button>
                  ) : null}
                  <Chip
                    label={tipOfTheDay.category}
                    size="small"
                    sx={{
                      backgroundColor: "rgba(255,255,255,0.14)",
                      color: "inherit",
                      border: "1px solid rgba(255,255,255,0.24)",
                    }}
                  />
                </>
              ) : isTipsError && hasNoTransactionsForTips ? (
                <StatusMessage
                  title="No transactions for tips yet"
                  description="Import transactions first to generate an AI savings tip."
                  minHeight={220}
                  inverted
                />
              ) : isTipsError ? (
                <StatusMessage
                  title={isOnline ? "Tip of the day is unavailable" : "You're offline"}
                  description={
                    isOnline
                      ? "We couldn't load AI savings tips right now. Retry to fetch a fresh tip."
                      : "Reconnect to the internet and retry to load your latest AI tip."
                  }
                  actionLabel="Retry"
                  onAction={() => {
                    void refetchTips();
                  }}
                  minHeight={220}
                  inverted
                />
              ) : (
                <StatusMessage
                  title="No tip available right now"
                  description="Check back later or upload more transaction data for fresh recommendations."
                  minHeight={220}
                  inverted
                />
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
