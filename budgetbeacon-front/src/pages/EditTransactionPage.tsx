import { useLocation, useNavigate, useParams } from "react-router-dom";

import { ApiError } from "../api/httpClient";
import { LoadingState, StatusMessage } from "../components/AsyncState";
import { TransactionForm } from "../features/transactions/components/TransactionForm";
import { useTransaction } from "../features/transactions/hooks/useTransaction";
import { getTransactionsReturnPath } from "../features/transactions/transactionListUrlState";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { useSlowLoading } from "../hooks/useSlowLoading";

export const EditTransactionPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { transactionId = "" } = useParams();
  const isOnline = useNetworkStatus();
  const { data, error, isError, isLoading, refetch } =
    useTransaction(transactionId);
  const isSlowLoading = useSlowLoading(isLoading);
  const isNotFound = error instanceof ApiError && error.status === 404;
  const transactionsReturnPath = getTransactionsReturnPath(location.search);

  if (isLoading) {
    return (
      <LoadingState
        label="Loading transaction..."
        isOffline={!isOnline}
        isSlow={isSlowLoading}
        minHeight={300}
      />
    );
  }

  if (!transactionId || isNotFound) {
    return (
      <StatusMessage
        title="Transaction not found"
        description="The requested transaction could not be found for your account."
        actionLabel="Back to transactions"
        onAction={() => navigate(transactionsReturnPath)}
        minHeight={320}
      />
    );
  }

  if (isError || !data) {
    return (
      <StatusMessage
        title={isOnline ? "Transaction couldn't be loaded" : "You're offline"}
        description={
          isOnline
            ? "We couldn't load this transaction right now."
            : "Reconnect to the internet and retry to load this transaction."
        }
        actionLabel="Retry"
        onAction={() => {
          void refetch();
        }}
        minHeight={320}
      />
    );
  }

  return <TransactionForm key={data.id} transaction={data} />;
};
