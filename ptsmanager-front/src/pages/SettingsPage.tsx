import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";

import { LoadingState, StatusMessage } from "../components/AsyncState";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { useSlowLoading } from "../hooks/useSlowLoading";
import { useUpdateUserPreferences } from "../features/settings/useUpdateUserPreferences";
import { useUserPreferences } from "../features/settings/useUserPreferences";

const maxLocationLength = 120;

export const SettingsPage = () => {
  const isOnline = useNetworkStatus();
  const { data, isError, isLoading, refetch } = useUserPreferences();
  const updateMutation = useUpdateUserPreferences();
  const isSlowLoading = useSlowLoading(isLoading);
  const [aiLocationContext, setAiLocationContext] = useState("");

  useEffect(() => {
    if (data) {
      setAiLocationContext(data.aiLocationContext ?? "");
    }
  }, [data]);

  const normalizedLocation = useMemo(
    () => aiLocationContext.replace(/\s+/g, " ").trim(),
    [aiLocationContext],
  );
  const hasChanges = normalizedLocation !== (data?.aiLocationContext ?? "");
  const isTooLong = aiLocationContext.length > maxLocationLength;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isTooLong || updateMutation.isPending) {
      return;
    }

    updateMutation.mutate({
      aiLocationContext: normalizedLocation.length > 0 ? normalizedLocation : null,
    });
  };

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

  return (
    <Box sx={{ width: "100%", maxWidth: 720 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        Settings
      </Typography>

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          <TextField
            label="AI location"
            value={aiLocationContext}
            onChange={(event) => setAiLocationContext(event.target.value)}
            inputProps={{ maxLength: maxLocationLength + 1 }}
            error={isTooLong}
            helperText={`${aiLocationContext.length}/${maxLocationLength}`}
            disabled={updateMutation.isPending || !isOnline}
            fullWidth
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              type="submit"
              variant="contained"
              startIcon={
                updateMutation.isPending ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <SaveIcon />
                )
              }
              disabled={
                !isOnline ||
                isTooLong ||
                !hasChanges ||
                updateMutation.isPending
              }
            >
              Save settings
            </Button>
            <Button
              type="button"
              variant="outlined"
              disabled={updateMutation.isPending || !hasChanges}
              onClick={() => setAiLocationContext(data?.aiLocationContext ?? "")}
            >
              Reset
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
};
