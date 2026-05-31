import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import SaveIcon from "@mui/icons-material/Save";
import {
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { useUpdateUserPreferences } from "./useUpdateUserPreferences";

const maxLocationLength = 120;

interface SettingsFormProps {
  initialAiLocationContext: string;
  isOnline: boolean;
}

export const SettingsForm = ({
  initialAiLocationContext,
  isOnline,
}: SettingsFormProps) => {
  const updateMutation = useUpdateUserPreferences();
  const [aiLocationContext, setAiLocationContext] = useState(
    initialAiLocationContext,
  );

  const normalizedLocation = useMemo(
    () => aiLocationContext.replace(/\s+/g, " ").trim(),
    [aiLocationContext],
  );
  const hasChanges = normalizedLocation !== initialAiLocationContext;
  const isTooLong = aiLocationContext.length > maxLocationLength;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isTooLong || updateMutation.isPending) {
      return;
    }

    updateMutation.mutate({
      aiLocationContext: normalizedLocation.length > 0 ? normalizedLocation : null,
    });
  };

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
              onClick={() => setAiLocationContext(initialAiLocationContext)}
            >
              Reset
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
};
