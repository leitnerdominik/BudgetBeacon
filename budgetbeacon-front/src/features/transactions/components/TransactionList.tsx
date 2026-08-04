import { lazy, Suspense, useMemo, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ClearIcon from "@mui/icons-material/Clear";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  Box,
  Badge,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { LoadingState, StatusMessage } from "../../../components/AsyncState";
import {
  type TransactionQueryRequest,
  type TransactionSortDirection,
  type TransactionSortField,
} from "../../../api/transactionsApi";
import { useNetworkStatus } from "../../../hooks/useNetworkStatus";
import { useSlowLoading } from "../../../hooks/useSlowLoading";
import { formatCurrency, formatDate } from "../../../utils/formatDate";
import { transactionCategories } from "../transactionCategories";
import { useCategorizeUncategorizedTransactions } from "../hooks/useCategorizeUncategorizedTransactions";
import { useDeleteTransaction } from "../hooks/useDeleteTransaction";
import { useRegenerateTransactionCategory } from "../hooks/useRegenerateTransactionCategory";
import { useTransactions } from "../hooks/useTransactions";
import { TransactionImportButton } from "./TransactionImportButton";
import { TransactionCategoryIcon } from "./TransactionCategoryIcon";
import { getTransactionTreatmentLabel } from "../transactionTreatment";
import {
  buildTransactionListSearchParams,
  parseTransactionListUrlState,
  type TransactionListState,
} from "../transactionListUrlState";
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
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isOnline = useNetworkStatus();
  const listState = useMemo(
    () => parseTransactionListUrlState(searchParams),
    [searchParams],
  );
  const transactionQuery = listState.query;
  const paginationModel = {
    page: listState.page,
    pageSize: listState.pageSize,
  };
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction>();
  const [isCategorizeDialogOpen, setIsCategorizeDialogOpen] = useState(false);

  const { data, isError, isFetching, isLoading, refetch } = useTransactions(
    paginationModel.page + 1,
    paginationModel.pageSize,
    transactionQuery,
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
  const hasActiveFilters =
    transactionQuery.searchTerm.trim().length > 0 ||
    transactionQuery.category.length > 0 ||
    transactionQuery.transactionType !== "all" ||
    transactionQuery.startDate.length > 0 ||
    transactionQuery.endDate.length > 0;
  const activeFilterCount = [
    transactionQuery.searchTerm.trim(),
    transactionQuery.category,
    transactionQuery.transactionType !== "all" ? transactionQuery.transactionType : "",
    transactionQuery.startDate,
    transactionQuery.endDate,
  ].filter(Boolean).length;
  const activeFilterChips = [
    transactionQuery.searchTerm.trim().length > 0
      ? {
          key: "search",
          label: `Search: ${transactionQuery.searchTerm.trim()}`,
          onDelete: () => handleQueryChange("searchTerm", ""),
        }
      : null,
    transactionQuery.category.length > 0
      ? {
          key: "category",
          label: `Category: ${transactionQuery.category}`,
          onDelete: () => handleQueryChange("category", ""),
        }
      : null,
    transactionQuery.transactionType !== "all"
      ? {
          key: "transactionType",
          label: `Type: ${
            transactionQuery.transactionType === "income" ? "Income" : "Expense"
          }`,
          onDelete: () => handleQueryChange("transactionType", "all"),
        }
      : null,
    transactionQuery.startDate.length > 0
      ? {
          key: "startDate",
          label: `From: ${transactionQuery.startDate}`,
          onDelete: () => handleQueryChange("startDate", ""),
        }
      : null,
    transactionQuery.endDate.length > 0
      ? {
          key: "endDate",
          label: `To: ${transactionQuery.endDate}`,
          onDelete: () => handleQueryChange("endDate", ""),
        }
      : null,
  ].filter((chip) => chip !== null);

  const updateListState = (
    getNextState: (current: TransactionListState) => TransactionListState,
  ) => {
    const nextState = getNextState(listState);
    setSearchParams(buildTransactionListSearchParams(nextState), {
      replace: true,
    });
  };

  const navigateToTransactionForm = (path: string) => {
    navigate(`${path}${location.search}`);
  };

  const handlePreviousPage = () => {
    updateListState((current) => ({
      ...current,
      page: Math.max(current.page - 1, 0),
    }));
  };

  const handleNextPage = () => {
    updateListState((current) => ({
      ...current,
      page: Math.min(current.page + 1, totalPages - 1),
    }));
  };

  const handleAddTransaction = () => {
    navigateToTransactionForm("/transactions/new");
  };

  const handlePageSizeChange = (pageSize: number) => {
    updateListState((current) => ({
      ...current,
      page: 0,
      pageSize,
    }));
  };

  const handlePaginationModelChange = (model: GridPaginationModel) => {
    updateListState((current) => ({
      ...current,
      page: model.pageSize === current.pageSize ? model.page : 0,
      pageSize: model.pageSize,
    }));
  };

  const handleQueryChange = <Key extends keyof TransactionQueryRequest>(
    key: Key,
    value: TransactionQueryRequest[Key],
  ) => {
    updateListState((current) => ({
      ...current,
      page: 0,
      query: {
        ...current.query,
        [key]: value,
      },
    }));
  };

  const handleSortChange = (
    sortBy: TransactionSortField,
    sortDirection: TransactionSortDirection,
  ) => {
    updateListState((current) => ({
      ...current,
      page: 0,
      query: {
        ...current.query,
        sortBy,
        sortDirection,
      },
    }));
  };

  const handleClearFilters = () => {
    updateListState((current) => ({
      ...current,
      page: 0,
      query: {
        ...current.query,
        searchTerm: "",
        category: "",
        transactionType: "all",
        startDate: "",
        endDate: "",
      },
    }));
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

  const categorizeSummary = categorizeMutation.data ?? categorizeMutation.progress;
  const categorizeHasPartialFailure =
    categorizeMutation.isSuccess && categorizeMutation.data.outcome === "partial";
  const categorizeHasFailed =
    categorizeMutation.isError ||
    (categorizeMutation.isSuccess && categorizeMutation.data.outcome === "failed");
  const categorizeProgressValue =
    categorizeSummary.totalCount > 0
      ? Math.round(
          (categorizeSummary.completedCount / categorizeSummary.totalCount) * 100,
        )
      : categorizeMutation.isSuccess
        ? 100
        : 0;
  const categorizeStatusLabel = categorizeMutation.isPending
    ? "Categorizing uncategorized transactions..."
    : categorizeMutation.isSuccess
      ? categorizeHasFailed
        ? "Categorization stopped"
        : categorizeHasPartialFailure
          ? "Categorization partially completed"
          : "Categorization completed"
      : categorizeMutation.isError
        ? "Categorization failed"
        : "Ready to categorize";
  const categorizeProgressLabel = categorizeMutation.isPending
    ? categorizeSummary.totalCount > 0
      ? `${categorizeSummary.completedCount} of ${categorizeSummary.totalCount}`
      : "Preparing..."
    : categorizeMutation.isSuccess
      ? categorizeSummary.totalCount > 0
        ? `${categorizeProgressValue}%`
        : "Complete"
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
          <TransactionImportButton />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddTransaction}
            disabled={!isOnline}
          >
            Add transaction
          </Button>
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

      <Box
        sx={{
          p: 2,
          mb: 2,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
          bgcolor: "background.paper",
        }}
      >
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems="stretch"
            sx={{ display: { xs: "flex", md: "none" } }}
          >
            <TextField
              label="Search"
              size="small"
              value={transactionQuery.searchTerm}
              onChange={(event) =>
                handleQueryChange("searchTerm", event.target.value)
              }
              placeholder="Description or notes"
              fullWidth
            />
            <Stack
              direction="row"
              spacing={1}
              sx={{ width: { xs: "100%", sm: "auto" } }}
            >
              <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
                <InputLabel id="mobile-transaction-sort-field-label">
                  Sort by
                </InputLabel>
                <Select
                  labelId="mobile-transaction-sort-field-label"
                  label="Sort by"
                  value={transactionQuery.sortBy}
                  onChange={(event) =>
                    handleSortChange(
                      event.target.value as TransactionSortField,
                      transactionQuery.sortDirection,
                    )
                  }
                >
                  <MenuItem value="date">Date</MenuItem>
                  <MenuItem value="amount">Amount</MenuItem>
                  <MenuItem value="category">Category</MenuItem>
                  <MenuItem value="description">Description</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
                <InputLabel id="mobile-transaction-sort-direction-label">
                  Direction
                </InputLabel>
                <Select
                  labelId="mobile-transaction-sort-direction-label"
                  label="Direction"
                  value={transactionQuery.sortDirection}
                  onChange={(event) =>
                    handleSortChange(
                      transactionQuery.sortBy,
                      event.target.value as TransactionSortDirection,
                    )
                  }
                >
                  <MenuItem value="desc">Descending</MenuItem>
                  <MenuItem value="asc">Ascending</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Stack>
          <Stack
            direction="row"
            spacing={1}
            sx={{ display: { xs: "flex", md: "none" } }}
          >
            <Badge
              badgeContent={activeFilterCount}
              color="primary"
              invisible={activeFilterCount === 0}
              sx={{
                flex: 1,
                "& .MuiBadge-badge": {
                  right: 10,
                  top: 8,
                },
              }}
            >
              <Button
                fullWidth
                variant="outlined"
                aria-expanded={isMobileFilterOpen}
                onClick={() => setIsMobileFilterOpen((current) => !current)}
              >
                Filters
              </Button>
            </Badge>
            <Button
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={handleClearFilters}
              disabled={!hasActiveFilters}
              sx={{ flex: 1 }}
            >
              Clear
            </Button>
          </Stack>
          <Collapse in={isMobileFilterOpen} timeout="auto" unmountOnExit>
            <Stack
              spacing={1.5}
              sx={{ display: { xs: "flex", md: "none" }, pt: 0.5 }}
            >
              <Divider />
              <FormControl size="small" fullWidth>
                <InputLabel id="mobile-transaction-category-filter-label">
                  Category
                </InputLabel>
                <Select
                  labelId="mobile-transaction-category-filter-label"
                  label="Category"
                  value={transactionQuery.category}
                  onChange={(event) =>
                    handleQueryChange("category", event.target.value)
                  }
                >
                  <MenuItem value="">All categories</MenuItem>
                  {transactionCategories.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                  <MenuItem value="Uncategorized">Uncategorized</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel id="mobile-transaction-type-filter-label">
                  Type
                </InputLabel>
                <Select
                  labelId="mobile-transaction-type-filter-label"
                  label="Type"
                  value={transactionQuery.transactionType}
                  onChange={(event) =>
                    handleQueryChange(
                      "transactionType",
                      event.target.value as TransactionQueryRequest["transactionType"],
                    )
                  }
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="income">Income</MenuItem>
                  <MenuItem value="expense">Expense</MenuItem>
                </Select>
              </FormControl>
              <Stack direction="row" spacing={1}>
                <TextField
                  label="Start date"
                  type="date"
                  size="small"
                  value={transactionQuery.startDate}
                  onChange={(event) =>
                    handleQueryChange("startDate", event.target.value)
                  }
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: 1, minWidth: 0 }}
                />
                <TextField
                  label="End date"
                  type="date"
                  size="small"
                  value={transactionQuery.endDate}
                  onChange={(event) =>
                    handleQueryChange("endDate", event.target.value)
                  }
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: 1, minWidth: 0 }}
                />
              </Stack>
            </Stack>
          </Collapse>

          <Stack
            direction="column"
            spacing={1.5}
            sx={{ display: { xs: "none", md: "flex" } }}
          >
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
            >
              <TextField
                label="Search"
                size="small"
                value={transactionQuery.searchTerm}
                onChange={(event) =>
                  handleQueryChange("searchTerm", event.target.value)
                }
                placeholder="Description or notes"
                sx={{ flex: 1.2 }}
              />
              <FormControl size="small" sx={{ minWidth: 190 }}>
                <InputLabel id="transaction-category-filter-label">
                  Category
                </InputLabel>
                <Select
                  labelId="transaction-category-filter-label"
                  label="Category"
                  value={transactionQuery.category}
                  onChange={(event) =>
                    handleQueryChange("category", event.target.value)
                  }
                >
                  <MenuItem value="">All categories</MenuItem>
                  {transactionCategories.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                  <MenuItem value="Uncategorized">Uncategorized</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel id="transaction-type-filter-label">Type</InputLabel>
                <Select
                  labelId="transaction-type-filter-label"
                  label="Type"
                  value={transactionQuery.transactionType}
                  onChange={(event) =>
                    handleQueryChange(
                      "transactionType",
                      event.target.value as TransactionQueryRequest["transactionType"],
                    )
                  }
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="income">Income</MenuItem>
                  <MenuItem value="expense">Expense</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Start date"
                type="date"
                size="small"
                value={transactionQuery.startDate}
                onChange={(event) =>
                  handleQueryChange("startDate", event.target.value)
                }
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 160 }}
              />
              <TextField
                label="End date"
                type="date"
                size="small"
                value={transactionQuery.endDate}
                onChange={(event) =>
                  handleQueryChange("endDate", event.target.value)
                }
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 160 }}
              />
            </Stack>
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              justifyContent="space-between"
            >
              <Stack direction="row" spacing={1.5} sx={{ flex: 1 }}>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel id="transaction-sort-field-label">
                    Sort by
                  </InputLabel>
                  <Select
                    labelId="transaction-sort-field-label"
                    label="Sort by"
                    value={transactionQuery.sortBy}
                    onChange={(event) =>
                      handleSortChange(
                        event.target.value as TransactionSortField,
                        transactionQuery.sortDirection,
                      )
                    }
                  >
                    <MenuItem value="date">Date</MenuItem>
                    <MenuItem value="amount">Amount</MenuItem>
                    <MenuItem value="category">Category</MenuItem>
                    <MenuItem value="description">Description</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel id="transaction-sort-direction-label">
                    Direction
                  </InputLabel>
                  <Select
                    labelId="transaction-sort-direction-label"
                    label="Direction"
                    value={transactionQuery.sortDirection}
                    onChange={(event) =>
                      handleSortChange(
                        transactionQuery.sortBy,
                        event.target.value as TransactionSortDirection,
                      )
                    }
                  >
                    <MenuItem value="desc">Descending</MenuItem>
                    <MenuItem value="asc">Ascending</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
              <Button
                variant="outlined"
                startIcon={<ClearIcon />}
                onClick={handleClearFilters}
                disabled={!hasActiveFilters}
              >
                Clear filters
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Box>

      {isMobile && activeFilterChips.length > 0 ? (
        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          sx={{ mb: 2 }}
        >
          {activeFilterChips.map((chip) => (
            <Chip
              key={chip.key}
              label={chip.label}
              onDelete={chip.onDelete}
              size="small"
              variant="outlined"
              sx={{
                maxWidth: "100%",
                "& .MuiChip-label": {
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                },
              }}
            />
          ))}
        </Stack>
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
          title={
            hasActiveFilters
              ? "No transactions match your filters"
              : "No transactions available yet"
          }
          description={
            hasActiveFilters
              ? "Try adjusting or clearing the filters to widen your transaction list."
              : "Add a transaction manually or import a CSV/XLSX file to populate your transaction history."
          }
          actionLabel={hasActiveFilters ? "Clear filters" : undefined}
          onAction={hasActiveFilters ? handleClearFilters : undefined}
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
                            label={getTransactionTreatmentLabel(transaction.treatment)}
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
                                  navigateToTransactionForm(
                                    `/transactions/${transaction.id}/edit`,
                                  )
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
              navigateToTransactionForm(`/transactions/${transactionId}/edit`)
            }
            onRegenerateCategory={handleRegenerateCategory}
            onSortChange={handleSortChange}
            paginationModel={paginationModel}
            regeneratingCategoryId={
              regenerateCategoryMutation.isPending
                ? regenerateCategoryMutation.variables
                : undefined
            }
            setPaginationModel={handlePaginationModelChange}
            sortBy={transactionQuery.sortBy}
            sortDirection={transactionQuery.sortDirection}
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
                variant={
                  categorizeMutation.isPending && categorizeSummary.totalCount === 0
                    ? "indeterminate"
                    : "determinate"
                }
                value={categorizeProgressValue}
                color={
                  categorizeHasFailed
                    ? "error"
                    : categorizeHasPartialFailure
                      ? "warning"
                      : "primary"
                }
                aria-label="Categorization progress"
              />
            </Box>

            {categorizeMutation.isPending ? (
              <DialogContentText>
                Transactions are being analyzed in small batches. Completed batches are
                saved immediately.
              </DialogContentText>
            ) : null}

            {categorizeMutation.isSuccess ? (
              <Typography
                variant="body2"
                color={categorizeHasFailed ? "error" : "text.primary"}
              >
                {categorizeMutation.data.message}
              </Typography>
            ) : null}

            {(categorizeSummary.totalCount > 0 || categorizeMutation.isSuccess) ? (
              <Stack spacing={1}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Chip
                    label={`${categorizeSummary.processedCount} processed`}
                    color="primary"
                    variant="outlined"
                  />
                  <Chip
                    label={`${categorizeSummary.changedCount} changed`}
                    color={
                      categorizeSummary.changedCount > 0
                        ? "success"
                        : "default"
                    }
                    variant="outlined"
                  />
                  <Chip
                    label={`${categorizeSummary.failedCount} failed`}
                    color={
                      categorizeSummary.failedCount > 0
                        ? "warning"
                        : "default"
                    }
                    variant="outlined"
                  />
                  <Chip
                    label={`${categorizeSummary.remainingCount} remaining`}
                    color={
                      categorizeSummary.remainingCount > 0
                        ? "warning"
                        : "default"
                    }
                    variant="outlined"
                  />
                  {categorizeSummary.skippedCount > 0 ? (
                    <Chip
                      label={`${categorizeSummary.skippedCount} skipped`}
                      variant="outlined"
                    />
                  ) : null}
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
    </Box>
  );
};
