import { Stack } from "@mui/material";
import { LoadingState, StatusMessage } from "../components/AsyncState";
import { SettingsForm } from "../features/settings/SettingsForm";
import { TransactionExport } from "../features/settings/TransactionExport";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { useSlowLoading } from "../hooks/useSlowLoading";
import { useUserPreferences } from "../features/settings/useUserPreferences";

export const SettingsPage = () => {
  const isOnline = useNetworkStatus();
  const { data, isError, isLoading, refetch } = useUserPreferences();
  const isSlowLoading = useSlowLoading(isLoading);

  const preferencesContent = isLoading ? (
    <LoadingState
      label="Loading settings..."
      isOffline={!isOnline}
      isSlow={isSlowLoading}
      minHeight={300}
    />
  ) : isError ? (
    <StatusMessage
      title={isOnline ? "Settings couldn't be loaded" : "You're offline"}
      description={
        isOnline
          ? "We couldn't load your settings right now."
          : "Reconnect to the internet and retry to load your settings."
      }
      actionLabel="Retry"
      onAction={() => {
        void refetch();
      }}
      minHeight={320}
    />
  ) : null;

  const aiLocationContext = data?.aiLocationContext ?? "";
  const transactionImportBlacklistRules =
    data?.transactionImportBlacklistRules ?? [];

  return (
    <Stack spacing={4}>
      {preferencesContent ?? (
        <SettingsForm
          key={`${aiLocationContext}:${JSON.stringify(transactionImportBlacklistRules)}`}
          initialAiLocationContext={aiLocationContext}
          initialTransactionImportBlacklistRules={transactionImportBlacklistRules}
          isOnline={isOnline}
        />
      )}
      <TransactionExport isOnline={isOnline} />
    </Stack>
  );
};
