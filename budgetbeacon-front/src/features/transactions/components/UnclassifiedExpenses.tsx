import { useEffect, useRef } from "react";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Alert, Box, Button, Pagination, Stack, Typography } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { ApiError } from "../../../api/httpClient";
import { classifySpendingFlexibility, defaultTransactionQuery, type TransactionQueryRequest } from "../../../api/transactionsApi";
import { LoadingState, StatusMessage } from "../../../components/AsyncState";
import { useNetworkStatus } from "../../../hooks/useNetworkStatus";
import { useSlowLoading } from "../../../hooks/useSlowLoading";
import type { PaginatedTransactions, SpendingFlexibility } from "../../../types/api";
import { formatCalendarDate } from "../../../utils/formatDate";
import { transactionsListQueryKey, useTransactions } from "../hooks/useTransactions";
import { parseTransactionListUrlState, unclassifiedExpensesPath } from "../transactionListUrlState";
import { UnclassifiedExpenseRow } from "./UnclassifiedExpenseRow";

const pageSize = 10;

type ClassificationRequest = {
  transactionId: string;
  classification: SpendingFlexibility;
  listQueryKey: ReturnType<typeof transactionsListQueryKey>;
};

export const UnclassifiedExpenses = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { page: pageIndex, query: { startDate, endDate } } = parseTransactionListUrlState(searchParams);
  const page = pageIndex + 1;
  const query: TransactionQueryRequest = { ...defaultTransactionQuery, startDate, endDate, spendingFlexibility: "Unclassified" };
  const { data, isError, isPending, isPlaceholderData, refetch } = useTransactions(page, pageSize, query);
  const queryClient = useQueryClient();
  const isOnline = useNetworkStatus();
  const isSlow = useSlowLoading(isPending || isPlaceholderData);
  const listRef = useRef<HTMLUListElement>(null);
  const countRef = useRef<HTMLParagraphElement>(null);
  const focusAfterSave = useRef<number | null>(null);
  const total = data?.totalCount ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const outOfRange = Boolean(data && !isPlaceholderData && page > pageCount);

  const save = useMutation({
    mutationFn: ({ transactionId, classification }: ClassificationRequest) =>
      classifySpendingFlexibility(transactionId, classification),
    onSuccess: (transaction, { listQueryKey }) => {
      // Reflect the confirmed save even if the subsequent list refresh fails.
      queryClient.setQueryData<PaginatedTransactions>(listQueryKey, (current) => {
        if (!current?.data.some((item) => item.id === transaction.id)) return current;
        return { data: current.data.filter((item) => item.id !== transaction.id), totalCount: current.totalCount - 1 };
      });
      queryClient.removeQueries({
        queryKey: ["transactions", "list", { spendingFlexibility: "Unclassified" }],
        type: "inactive",
      });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  useEffect(() => {
    if (!outOfRange) return;
    const next = new URLSearchParams(searchParams);
    if (pageCount === 1) next.delete("page");
    else next.set("page", String(pageCount));
    setSearchParams(next, { replace: true });
  }, [outOfRange, pageCount, searchParams, setSearchParams]);

  useEffect(() => {
    const index = focusAfterSave.current;
    if (index === null || save.isPending || isPending || isPlaceholderData || outOfRange) return;
    focusAfterSave.current = null;
    const list = listRef.current;
    const active = document.activeElement;
    if (active !== document.body && !list?.contains(active) && !active?.closest("[data-classification-menu]")) return;
    if (save.isSuccess) {
      const buttons = list?.querySelectorAll<HTMLButtonElement>("button[data-classify]");
      (buttons?.[Math.min(index, buttons.length - 1)] ?? countRef.current)?.focus();
    } else if (save.isError) {
      list?.querySelector<HTMLButtonElement>("button[data-classification-error-action]")?.focus();
    }
  }, [save.isPending, save.isSuccess, save.isError, isPending, isPlaceholderData, outOfRange]);

  const isScoped = Boolean(startDate || endDate);
  const period = [startDate && `From ${formatCalendarDate(startDate)}`, endDate && `Through ${formatCalendarDate(endDate)}`]
    .filter(Boolean).join(" · ");
  const isLoading = isPending || isPlaceholderData || outOfRange;
  const refresh = () => { void refetch(); };

  return (
    <Stack spacing={2.5} sx={{ mx: "auto", width: "100%", maxWidth: 900 }}>
      <Box>
        <Button component={Link} to="/transactions" startIcon={<ArrowBackIcon />} sx={{ minHeight: 44, mb: 1 }}>
          Back to Transactions
        </Button>
        <Typography component="h1" variant="h4">Unclassified expenses</Typography>
        {isScoped ? (
          <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1} sx={{ mt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">{period}</Typography>
            <Button component={Link} to={unclassifiedExpensesPath} disabled={save.isPending} size="small" sx={{ minHeight: 44 }}>
              Show all dates
            </Button>
          </Stack>
        ) : null}
      </Box>

      {isLoading ? (
        <LoadingState label="Loading unclassified expenses…" isSlow={isSlow} isOffline={!isOnline} />
      ) : isError && !data ? (
        <StatusMessage
          title={isOnline ? "Unclassified expenses couldn’t be loaded" : "You’re offline"}
          description={isOnline ? "Try loading the list again." : "Reconnect to load unclassified expenses."}
          actionLabel="Retry"
          onAction={refresh}
        />
      ) : (
        <>
          <Typography ref={countRef} variant="body2" color="text.secondary" role="status" tabIndex={-1}>
            {total === 1 ? "1 unclassified expense" : `${total} unclassified expenses`}
          </Typography>
          {!isOnline && <Alert severity="info">Reconnect to classify expenses.</Alert>}
          {isOnline && isError && data && (
            <Alert severity="warning" action={<Button color="inherit" onClick={refresh}>Retry</Button>}>
              The list couldn’t be refreshed.
            </Alert>
          )}
          {total === 0 ? (
            <StatusMessage
              title={isScoped ? "No unclassified expenses in this period" : "No unclassified expenses"}
              description="New unclassified expenses will appear here."
            />
          ) : (
            <Stack ref={listRef} component="ul" spacing={1} sx={{ m: 0, p: 0, listStyle: "none" }}>
              {data?.data.map((transaction, index) => {
                const outcome = save.variables?.transactionId === transaction.id;
                const classify = (classification: SpendingFlexibility) => {
                  focusAfterSave.current = index;
                  save.mutate({
                    transactionId: transaction.id,
                    classification,
                    listQueryKey: transactionsListQueryKey(page, pageSize, query),
                  });
                };
                const stale = save.error instanceof ApiError && (save.error.status === 404 || save.error.status === 409);
                const failure = outcome && save.isError && save.variables ? {
                  message: stale ? "This transaction changed. Refresh the list to continue." : "The classification couldn’t be saved.",
                  action: stale ? "Refresh" : "Retry",
                  onAction: stale ? () => { save.reset(); refresh(); } : () => {
                    if (save.variables) classify(save.variables.classification);
                  },
                } : undefined;
                return (
                  <UnclassifiedExpenseRow
                    key={transaction.id}
                    transaction={transaction}
                    disabled={!isOnline || save.isPending}
                    saving={outcome && save.isPending}
                    failure={failure}
                    onClassify={classify}
                  />
                );
              })}
            </Stack>
          )}
          {pageCount > 1 && (
            <Pagination
              aria-label="Unclassified expenses pages"
              count={pageCount}
              page={page}
              disabled={save.isPending}
              onChange={(_, nextPage) => {
                save.reset();
                const next = new URLSearchParams(searchParams);
                if (nextPage === 1) next.delete("page");
                else next.set("page", String(nextPage));
                setSearchParams(next);
              }}
            />
          )}
        </>
      )}
    </Stack>
  );
};
