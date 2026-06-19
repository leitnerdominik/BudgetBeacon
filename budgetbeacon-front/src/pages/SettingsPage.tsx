import { LoadingState, StatusMessage } from "../components/AsyncState";
import { SettingsForm } from "../features/settings/SettingsForm";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { useSlowLoading } from "../hooks/useSlowLoading";
import { useUserPreferences } from "../features/settings/useUserPreferences";

export const SettingsPage = () => {
  const isOnline = useNetworkStatus();
  const { data, isError, isLoading, refetch } = useUserPreferences();
  const isSlowLoading = useSlowLoading(isLoading);

  if (isLoading) {
    return (
      <LoadingState
        label="Loading settings..."
        isOffline={!isOnline}
        isSlow={isSlowLoading}
        minHeight={300}
      />
    );
  }

  if (isError) {
    return (
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
    );
  }

  const aiLocationContext = data?.aiLocationContext ?? "";

  return (
    <SettingsForm
      key={aiLocationContext}
      initialAiLocationContext={aiLocationContext}
      isOnline={isOnline}
    />
  );
};
