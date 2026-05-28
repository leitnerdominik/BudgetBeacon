import { lazy, Suspense, useState } from "react";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  MenuItem,
  Select,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import { LoadingState, StatusMessage } from "../../../components/feedback/AsyncState";
import { useNetworkStatus } from "../../../hooks/useNetworkStatus";
import { useSlowLoading } from "../../../hooks/useSlowLoading";
import { useCategorizeUncategorizedTransactions } from "../hooks/useCategorizeUncategorizedTransactions";
import { useTransactions } from "../hooks/useTransactions";
import { CsvUploadButton } from "./CsvUploadButton";
import type { PaginatedTransactions } from "../types";

const currencyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  year: "numeric",
  month: "short",
  day: "2-digit",
});

type GridPaginationModel = {
  page: number;
  pageSize: number;
};

const formatConfidenceScore = (value: number | null | undefined) =>
  typeof value === "number" ? `${Math.round(value * 100)}%` : "N/A";

const DesktopTransactionGrid = lazy(async () => ({
  default: (await import("./DesktopTransactionGrid")).DesktopTransactionGrid,
}));

const DesktopGridFallback = () => (
  <Box
    sx={{
      width: "100%",
      height: 560,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <CircularProgress />
  </Box>
);

export const TransactionList = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isOnline = useNetworkStatus();
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  });

  const { data, isError, isFetching, isLoading, refetch } = useTransactions(
    paginationModel.page + 1,
    paginationModel.pageSize,
  );
  const categorizeMutation = useCategorizeUncategorizedTransactions();
  const isSlowLoading = useSlowLoading(isLoading);

  const transactions: PaginatedTransactions["data"] = data?.data ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / paginationModel.pageSize));
  const hasTransactions = transactions.length > 0;
  const showRefreshError = isError && hasTransactions;

  const handlePreviousPage = () => {
    setPaginationModel((current) => ({
      ...current,
      page: Math.max(current.page - 1, 0),
    }));
  };

  const handleNextPage = () => {
    setPaginationModel((current) => ({
      ...current,
      page: Math.min(current.page + 1, totalPages - 1),
    }));
  };

  const handlePageSizeChange = (pageSize: number) => {
    setPaginationModel({
      page: 0,
      pageSize,
    });
  };

  return (
    <Box sx={{ width: "100%" }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "stretch", sm: "center" },
          gap: 1.5,
          mb: 2,
        }}
      >
        <Typography variant="h4" component="h1">
          Transactions
        </Typography>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <Button
            variant="outlined"
            onClick={() => {
              categorizeMutation.mutate();
            }}
            disabled={
              !isOnline ||
              !hasTransactions ||
              isLoading ||
              categorizeMutation.isPending
            }
            startIcon={
              categorizeMutation.isPending ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <AutoAwesomeIcon />
              )
            }
          >
            Categorize uncategorized
          </Button>
          <CsvUploadButton />
        </Stack>
      </Box>
      {showRefreshError ? (
        <Box sx={{ mb: 2 }}>
          <StatusMessage
            title={isOnline ? "Couldn't refresh transactions" : "You're offline"}
            description={
              isOnline
                ? "Showing the last available transaction data. Retry when you're ready."
                : "You're viewing cached transaction data. Reconnect and retry to fetch the latest entries."
            }
            actionLabel="Retry"
            onAction={() => {
              void refetch();
            }}
            minHeight="auto"
          />
        </Box>
      ) : null}

      {isLoading && !hasTransactions ? (
        <LoadingState
          label="Loading transactions..."
          isOffline={!isOnline}
          isSlow={isSlowLoading}
          minHeight={300}
        />
      ) : isError && !hasTransactions ? (
        <StatusMessage
          title={isOnline ? "Transactions couldn't be loaded" : "You're offline"}
          description={
            isOnline
              ? "We couldn't load your transactions right now. Please try again."
              : "Reconnect to the internet and retry to load your transactions."
          }
          actionLabel="Retry"
          onAction={() => {
            void refetch();
          }}
          minHeight={320}
        />
      ) : !hasTransactions ? (
        <StatusMessage
          title="No transactions available yet"
          description="Import a CSV file to populate your transaction history and monthly insights."
          minHeight={280}
        />
      ) : isMobile ? (
        <Box>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", sm: "center" }}
            sx={{ mb: 2 }}
          >
            <Typography variant="body2" color="text.secondary">
              {totalCount} transaction(s) available
            </Typography>
            <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 140 } }}>
              <Select
                value={paginationModel.pageSize}
                onChange={(event) =>
                  handlePageSizeChange(Number(event.target.value))
                }
                displayEmpty
                inputProps={{ "aria-label": "Rows per page" }}
              >
                {[5, 10, 25].map((size) => (
                  <MenuItem key={size} value={size}>
                    {size} per page
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
          <Stack spacing={1.5}>
            {transactions.map((transaction) => {
              const amountColor =
                transaction.amount < 0 ? "error.main" : "success.main";

              return (
                <Card
                  key={transaction.id}
                  elevation={2}
                  sx={{
                    borderRadius: 3,
                  }}
                >
                  <CardContent sx={{ p: 2.25 }}>
                    <Stack spacing={1.5}>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="flex-start"
                        spacing={1.5}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography
                            variant="subtitle1"
                            fontWeight={700}
                            sx={{ lineHeight: 1.3 }}
                          >
                            {transaction.description}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {dateFormatter.format(new Date(transaction.date))}
                          </Typography>
                        </Box>
                        <Typography
                          variant="subtitle1"
                          fontWeight={800}
                          sx={{
                            color: amountColor,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {currencyFormatter.format(transaction.amount)}
                        </Typography>
                      </Stack>

                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip
                          label={transaction.category}
                          size="medium"
                          variant="outlined"
                        />
                        <Chip
                          label={`Confidence ${formatConfidenceScore(transaction.aiConfidenceScore)}`}
                          size="medium"
                          variant="filled"
                          sx={{
                            bgcolor: "action.hover",
                          }}
                        />
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>

          <Stack spacing={1} sx={{ mt: 2.5 }}>
            <Typography variant="body2" color="text.secondary">
              Page {Math.min(paginationModel.page + 1, totalPages)} of {totalPages}
              {isFetching
                ? isOnline
                  ? " | refreshing data..."
                  : " | waiting for network..."
                : ""}
            </Typography>
            <Stack direction="row" spacing={1.5}>
              <Button
                fullWidth
                variant="outlined"
                size="large"
                onClick={handlePreviousPage}
                disabled={paginationModel.page === 0 || isFetching}
              >
                Previous
              </Button>
              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={handleNextPage}
                disabled={paginationModel.page >= totalPages - 1 || isFetching}
              >
                Next
              </Button>
            </Stack>
          </Stack>
        </Box>
      ) : (
        <Suspense fallback={<DesktopGridFallback />}>
          <DesktopTransactionGrid
            transactions={transactions}
            totalCount={totalCount}
            isLoading={isLoading}
            paginationModel={paginationModel}
            setPaginationModel={setPaginationModel}
          />
        </Suspense>
      )}
    </Box>
  );
};
