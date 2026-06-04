import { lazy, Suspense, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Fab,
  FormControl,
  IconButton,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import { LoadingState, StatusMessage } from "../../../components/AsyncState";
import { useNetworkStatus } from "../../../hooks/useNetworkStatus";
import { useSlowLoading } from "../../../hooks/useSlowLoading";
import { formatCurrency, formatDate } from "../../../utils/formatDate";
import { useCategorizeUncategorizedTransactions } from "../hooks/useCategorizeUncategorizedTransactions";
import { useDeleteTransaction } from "../hooks/useDeleteTransaction";
import { useRegenerateTransactionCategory } from "../hooks/useRegenerateTransactionCategory";
import { useTransactions } from "../hooks/useTransactions";
import { CsvUploadButton } from "./CsvUploadButton";
import { TransactionCategoryIcon } from "./TransactionCategoryIcon";
import type { PaginatedTransactions, Transaction } from "../types";

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
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isOnline = useNetworkStatus();
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  });
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction>();
  const [isCategorizeDialogOpen, setIsCategorizeDialogOpen] = useState(false);

  const { data, isError, isFetching, isLoading, refetch } = useTransactions(
    paginationModel.page + 1,
    paginationModel.pageSize,
  );
  const categorizeMutation = useCategorizeUncategorizedTransactions();
  const deleteTransactionMutation = useDeleteTransaction();
  const regenerateCategoryMutation = useRegenerateTransactionCategory();
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

  const handleRegenerateCategory = (transactionId: string) => {
    regenerateCategoryMutation.mutate(transactionId);
  };

  const handleCategorizeUncategorized = () => {
    setIsCategorizeDialogOpen(true);
    categorizeMutation.reset();
    categorizeMutation.mutate();
  };

  const handleCategorizeDialogClose = () => {
    if (!categorizeMutation.isPending) {
      setIsCategorizeDialogOpen(false);
    }
  };

  const handleDeleteRequest = (transactionId: string) => {
    const transaction = transactions.find((candidate) => candidate.id === transactionId);

    if (transaction) {
      setTransactionToDelete(transaction);
    }
  };

  const handleDeleteCancel = () => {
    if (!deleteTransactionMutation.isPending) {
      setTransactionToDelete(undefined);
    }
  };

  const handleDeleteConfirm = () => {
    if (!transactionToDelete) {
      return;
    }

    deleteTransactionMutation.mutate(transactionToDelete.id, {
      onSuccess: () => setTransactionToDelete(undefined),
    });
  };

  const categorizeProgressValue =
    categorizeMutation.isSuccess || categorizeMutation.isError ? 100 : 0;
  const categorizeStatusLabel = categorizeMutation.isPending
    ? "Categorizing uncategorized transactions..."
    : categorizeMutation.isSuccess
      ? "Categorization completed"
      : categorizeMutation.isError
        ? "Categorization failed"
        : "Ready to categorize";
  const categorizeProgressLabel = categorizeMutation.isPending
    ? "In progress"
    : categorizeMutation.isSuccess
      ? "100%"
      : categorizeMutation.isError
        ? "Failed"
        : "Waiting";

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
        <Box>
          <Typography variant="h4" component="h1">
            Transactions
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Review, categorize and maintain your financial activity.
          </Typography>
        </Box>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <Button
            variant="outlined"
            onClick={handleCategorizeUncategorized}
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
          description="Add a transaction manually or import a CSV file to populate your transaction history."
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
                  sx={{
                    borderLeft: "3px solid",
                    borderLeftColor: amountColor,
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
                            {formatDate(transaction.date)}
                          </Typography>
                          {transaction.notes ? (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ mt: 1, overflowWrap: "anywhere" }}
                            >
                              {transaction.notes}
                            </Typography>
                          ) : null}
                        </Box>
                        <Typography
                          variant="subtitle1"
                          fontWeight={800}
                          sx={{
                            color: amountColor,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatCurrency(transaction.amount)}
                        </Typography>
                      </Stack>

                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          <Chip
                            label={transaction.category}
                            icon={
                              <TransactionCategoryIcon
                                category={transaction.category}
                                fontSize="small"
                              />
                            }
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

                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="Regenerate category">
                            <span>
                              <IconButton
                                aria-label="Regenerate transaction category"
                                color="secondary"
                                size="small"
                                disabled={
                                  deleteTransactionMutation.isPending ||
                                  regenerateCategoryMutation.isPending
                                }
                                onClick={() => handleRegenerateCategory(transaction.id)}
                              >
                                <AutoAwesomeIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Edit transaction">
                            <span>
                              <IconButton
                                aria-label="Edit transaction"
                                size="small"
                                disabled={
                                  deleteTransactionMutation.isPending ||
                                  regenerateCategoryMutation.isPending
                                }
                                onClick={() =>
                                  navigate(`/transactions/${transaction.id}/edit`)
                                }
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Delete transaction">
                            <span>
                              <IconButton
                                aria-label="Delete transaction"
                                color="error"
                                size="small"
                                disabled={
                                  deleteTransactionMutation.isPending ||
                                  regenerateCategoryMutation.isPending
                                }
                                onClick={() => handleDeleteRequest(transaction.id)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
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
            deletingTransactionId={
              deleteTransactionMutation.isPending
                ? deleteTransactionMutation.variables
                : undefined
            }
            onDeleteRequest={handleDeleteRequest}
            onEditRequest={(transactionId) =>
              navigate(`/transactions/${transactionId}/edit`)
            }
            onRegenerateCategory={handleRegenerateCategory}
            paginationModel={paginationModel}
            regeneratingCategoryId={
              regenerateCategoryMutation.isPending
                ? regenerateCategoryMutation.variables
                : undefined
            }
            setPaginationModel={setPaginationModel}
          />
        </Suspense>
      )}
      <Dialog
        open={isCategorizeDialogOpen}
        onClose={handleCategorizeDialogClose}
        aria-labelledby="categorize-transactions-title"
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle id="categorize-transactions-title">
          Categorize uncategorized transactions
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5}>
            <Box>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={2}
                sx={{ mb: 1 }}
              >
                <Typography variant="body2" fontWeight={700}>
                  {categorizeStatusLabel}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {categorizeProgressLabel}
                </Typography>
              </Stack>
              <LinearProgress
                variant={categorizeMutation.isPending ? "indeterminate" : "determinate"}
                value={categorizeProgressValue}
                color={categorizeMutation.isError ? "error" : "primary"}
                aria-label="Categorization progress"
              />
            </Box>

            {categorizeMutation.isPending ? (
              <DialogContentText>
                Transactions without a category are being analyzed. This can take a
                moment depending on the number of entries.
              </DialogContentText>
            ) : null}

            {categorizeMutation.isSuccess ? (
              <Stack spacing={1}>
                <Typography variant="body2">
                  {categorizeMutation.data.message}
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Chip
                    label={`${categorizeMutation.data.processedCount} processed`}
                    color="primary"
                    variant="outlined"
                  />
                  <Chip
                    label={`${categorizeMutation.data.categorizedCount} categorized`}
                    color={
                      categorizeMutation.data.categorizedCount > 0
                        ? "success"
                        : "default"
                    }
                    variant="outlined"
                  />
                </Stack>
              </Stack>
            ) : null}

            {categorizeMutation.isError ? (
              <Typography variant="body2" color="error">
                {categorizeMutation.error instanceof Error
                  ? categorizeMutation.error.message
                  : "Transactions could not be categorized."}
              </Typography>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCategorizeDialogClose}
            disabled={categorizeMutation.isPending}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(transactionToDelete)}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-transaction-title"
      >
        <DialogTitle id="delete-transaction-title">Delete transaction?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this transaction? This action cannot be undone.
          </DialogContentText>
          {transactionToDelete ? (
            <Typography variant="body2" sx={{ mt: 2, fontWeight: 700 }}>
              {transactionToDelete.description} | {formatCurrency(transactionToDelete.amount)}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleDeleteCancel}
            disabled={deleteTransactionMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDeleteConfirm}
            disabled={deleteTransactionMutation.isPending}
          >
            {deleteTransactionMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
      <Tooltip title="Add transaction">
        <Fab
          color="primary"
          aria-label="Add transaction"
          onClick={() => navigate("/transactions/new")}
          disabled={!isOnline}
          sx={{
            position: "fixed",
            right: { xs: 16, sm: 24 },
            bottom: { xs: 16, sm: 24 },
            zIndex: (currentTheme) => currentTheme.zIndex.speedDial,
          }}
        >
          <AddIcon />
        </Fab>
      </Tooltip>
    </Box>
  );
};
