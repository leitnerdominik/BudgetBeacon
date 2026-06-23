import { useMemo, useState } from "react";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { LoadingState, StatusMessage } from "../components/AsyncState";
import {
  defaultTransactionQuery,
  type TransactionQueryRequest,
} from "../api/transactionsApi";
import { TransactionCategoryIcon } from "../features/transactions/components/TransactionCategoryIcon";
import { useTransactions } from "../features/transactions/hooks/useTransactions";
import {
  DEFAULT_TIPS_TIMEFRAME,
  getTipsTimeframe,
  getTipsTransactionDateRange,
  isTipsTimeframeValue,
  type TipsTimeframeValue,
} from "../features/tips/tipsTimeframes";
import { isTipsSourceDataNotFound } from "../features/tips/tipErrors";
import { useTips } from "../features/tips/useTips";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { useSlowLoading } from "../hooks/useSlowLoading";
import { formatCurrency, formatDate } from "../utils/formatDate";
import type { RegionalTipCategory } from "../types/api";

type SupportingTransactionsProps = {
  category: RegionalTipCategory;
  timeframe: TipsTimeframeValue;
};

const supportingTransactionsPageSize = 10;

const SupportingTransactions = ({
  category,
  timeframe,
}: SupportingTransactionsProps) => {
  const [page, setPage] = useState(0);
  const isOnline = useNetworkStatus();
  const timeframeLabel = getTipsTimeframe(timeframe).label;
  const transactionQuery = useMemo<TransactionQueryRequest>(() => {
    const range = getTipsTransactionDateRange(timeframe);

    return {
      ...defaultTransactionQuery,
      category,
      transactionType: "expense",
      startDate: range.startDate,
      endDate: range.endDate,
      sortBy: "date",
      sortDirection: "desc",
    };
  }, [category, timeframe]);

  const { data, isError, isFetching, isLoading, refetch } = useTransactions(
    page + 1,
    supportingTransactionsPageSize,
    transactionQuery,
  );

  const transactions = data?.data ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / supportingTransactionsPageSize),
  );

  if (isLoading) {
    return (
      <LoadingState
        label="Loading supporting transactions..."
        isOffline={!isOnline}
        minHeight={220}
      />
    );
  }

  if (isError) {
    return (
      <StatusMessage
        title={
          isOnline
            ? "Supporting transactions are unavailable"
            : "You're offline"
        }
        description={
          isOnline
            ? "We couldn't load the matching transactions right now."
            : "Reconnect to load the matching transactions for this tip."
        }
        actionLabel="Retry"
        onAction={() => {
          void refetch();
        }}
        minHeight={220}
      />
    );
  }

  if (transactions.length === 0) {
    return (
      <StatusMessage
        title="No matching transactions found"
        description={`No ${category.toLowerCase()} expense transactions were found for ${timeframeLabel}.`}
        minHeight={220}
      />
    );
  }

  return (
    <Stack spacing={1.5}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
      >
        <Typography variant="body2" color="text.secondary">
          {totalCount} matching transaction(s) for {timeframeLabel}
          {isFetching ? " | refreshing..." : ""}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Page {Math.min(page + 1, totalPages)} of {totalPages}
        </Typography>
      </Stack>

      <Stack spacing={1}>
        {transactions.map((transaction) => (
          <Box
            key={transaction.id}
            sx={{
              p: { xs: 1.75, sm: 2 },
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              bgcolor: "background.paper",
            }}
          >
            <Stack
              direction="row"
              spacing={1.5}
              justifyContent="space-between"
              alignItems="flex-start"
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight={700} sx={{ overflowWrap: "anywhere" }}>
                  {transaction.description}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatDate(transaction.date)}
                </Typography>
              </Box>
              <Typography
                fontWeight={800}
                color="error.main"
                sx={{ whiteSpace: "nowrap" }}
              >
                {formatCurrency(transaction.amount)}
              </Typography>
            </Stack>
          </Box>
        ))}
      </Stack>

      <Stack direction="row" spacing={1.5}>
        <Button
          fullWidth
          variant="outlined"
          onClick={() => setPage((current) => Math.max(current - 1, 0))}
          disabled={page === 0 || isFetching}
        >
          Previous
        </Button>
        <Button
          fullWidth
          variant="contained"
          onClick={() =>
            setPage((current) => Math.min(current + 1, totalPages - 1))
          }
          disabled={page >= totalPages - 1 || isFetching}
        >
          Next
        </Button>
      </Stack>
    </Stack>
  );
};

export const TipDetailPage = () => {
  const navigate = useNavigate();
  const { tipId } = useParams();
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const isOnline = useNetworkStatus();
  const requestedTimeframe = searchParams.get("timeframe") ?? DEFAULT_TIPS_TIMEFRAME;
  const timeframe = isTipsTimeframeValue(requestedTimeframe)
    ? requestedTimeframe
    : DEFAULT_TIPS_TIMEFRAME;
  const timeframeLabel = getTipsTimeframe(timeframe).label;
  const {
    data: tips,
    error: tipsError,
    isLoading,
    isError,
    refreshTips,
  } = useTips({
    timeframe,
    showSuccessNotification: false,
  });
  const isSlowLoading = useSlowLoading(isLoading);
  const hasNoTransactionsForTips = isTipsSourceDataNotFound(tipsError);
  const tip = tips?.find((candidate) => candidate.id === tipId);

  const handleBack = () => {
    navigate(`/tips?timeframe=${timeframe}`);
  };

  if (isLoading) {
    return (
      <Box sx={{ flexGrow: 1 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ mb: 2 }}>
          Back to tips
        </Button>
        <LoadingState
          label="Loading tip details..."
          isOffline={!isOnline}
          isSlow={isSlowLoading}
          minHeight={320}
        />
      </Box>
    );
  }

  if (isError && hasNoTransactionsForTips) {
    return (
      <Box sx={{ flexGrow: 1 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ mb: 2 }}>
          Back to tips
        </Button>
        <StatusMessage
          title="No transactions found for AI tips"
          description="Add or import transactions first, then AI tips can analyze your recent spending."
        />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ flexGrow: 1 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ mb: 2 }}>
          Back to tips
        </Button>
        <StatusMessage
          title={isOnline ? "Tip details are unavailable" : "You're offline"}
          description={
            isOnline
              ? "We couldn't load this AI tip right now. Please try again."
              : "Reconnect to the internet and retry to load this AI tip."
          }
          actionLabel="Retry"
          onAction={() => {
            void refreshTips();
          }}
        />
      </Box>
    );
  }

  if (!tip) {
    return (
      <Box sx={{ flexGrow: 1 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ mb: 2 }}>
          Back to tips
        </Button>
        <StatusMessage
          title="Tip not found"
          description="This tip is no longer available for the selected timeframe."
          actionLabel="View all tips"
          onAction={handleBack}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ mb: 2 }}>
        Back to tips
      </Button>

      <Stack spacing={2.5}>
        <Card>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack spacing={2}>
              <Box>
                <Typography
                  variant={isSmallScreen ? "h5" : "h4"}
                  component="h1"
                  gutterBottom
                >
                  {tip.title}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    label={tip.category}
                    icon={
                      <TransactionCategoryIcon
                        category={tip.category}
                        fontSize="small"
                      />
                    }
                    variant="outlined"
                  />
                  <Chip
                    label={`${tip.impact} Impact`}
                    color={tip.impact === "High" ? "success" : "default"}
                  />
                  <Chip label={timeframeLabel} variant="outlined" />
                </Stack>
              </Box>

              <Divider />

              <Box>
                <Typography variant="h6" gutterBottom>
                  Recommendation
                </Typography>
                <Typography color="text.secondary">{tip.description}</Typography>
              </Box>

              <Box>
                <Typography variant="h6" gutterBottom>
                  Why AI made this tip
                </Typography>
                <Typography color="text.secondary">{tip.reasoning}</Typography>
              </Box>

              <Box>
                <Typography variant="h6" gutterBottom>
                  Supporting signals
                </Typography>
                <Stack component="ul" spacing={1} sx={{ pl: 2.5, m: 0 }}>
                  {tip.supportingSignals.map((signal) => (
                    <Typography component="li" color="text.secondary" key={signal}>
                      {signal}
                    </Typography>
                  ))}
                </Stack>
              </Box>

              <Box
                sx={{
                  p: 2,
                  borderRadius: 1,
                  bgcolor: "action.hover",
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  AI tips are suggestions, not professional financial advice. The
                  AI used category-level expense totals. The transactions below
                  are shown locally so you can review the activity that
                  contributed to this category summary.
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h6" gutterBottom>
                  Supporting transactions
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  These are your matching {tip.category.toLowerCase()} expense
                  transactions for {timeframeLabel}. They were not sent to the AI
                  provider as raw rows.
                </Typography>
              </Box>
              <SupportingTransactions
                category={tip.category}
                timeframe={timeframe}
              />
            </Stack>
          </CardContent>
        </Card>
      </Stack>

    </Box>
  );
};
