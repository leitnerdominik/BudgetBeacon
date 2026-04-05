import { useEffect, useState } from "react";
import {
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

import {
  getCsvColumnMappingValidationMessage,
  normalizeCsvColumnMapping,
  type CsvColumnMapping,
} from "../utils/csvColumnMapping";

interface CsvColumnMappingDialogProps {
  open: boolean;
  value: CsvColumnMapping;
  onClose: () => void;
  onSave: (value: CsvColumnMapping) => void;
}

export const CsvColumnMappingDialog = ({
  open,
  value,
  onClose,
  onSave,
}: CsvColumnMappingDialogProps) => {
  const [draftValue, setDraftValue] = useState<CsvColumnMapping>(value);

  useEffect(() => {
    if (open) {
      setDraftValue(value);
    }
  }, [open, value]);

  const normalizedDraftValue = normalizeCsvColumnMapping(draftValue);
  const validationMessage = getCsvColumnMappingValidationMessage(
    normalizedDraftValue,
  );

  const handleSave = () => {
    if (validationMessage) {
      return;
    }

    onSave(normalizedDraftValue);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>CSV column mapping</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Define which CSV columns should be used for the transaction date,
            amount, and description before the file is uploaded.
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={draftValue.enabled}
                onChange={(event) =>
                  setDraftValue((current) => ({
                    ...current,
                    enabled: event.target.checked,
                  }))
                }
              />
            }
            label="Use custom column mapping"
          />

          <FormControlLabel
            control={
              <Switch
                checked={draftValue.hasHeaderRow}
                onChange={(event) =>
                  setDraftValue((current) => ({
                    ...current,
                    hasHeaderRow: event.target.checked,
                  }))
                }
                disabled={!draftValue.enabled}
              />
            }
            label="First row contains headers"
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              fullWidth
              label="Date column"
              value={draftValue.dateColumn}
              onChange={(event) =>
                setDraftValue((current) => ({
                  ...current,
                  dateColumn: event.target.value.toUpperCase(),
                }))
              }
              disabled={!draftValue.enabled}
              placeholder="B"
              helperText="Column letter, e.g. B"
            />
            <TextField
              fullWidth
              label="Amount column"
              value={draftValue.amountColumn}
              onChange={(event) =>
                setDraftValue((current) => ({
                  ...current,
                  amountColumn: event.target.value.toUpperCase(),
                }))
              }
              disabled={!draftValue.enabled}
              placeholder="E"
              helperText="Column letter, e.g. E"
            />
            <TextField
              fullWidth
              label="Description column"
              value={draftValue.descriptionColumn}
              onChange={(event) =>
                setDraftValue((current) => ({
                  ...current,
                  descriptionColumn: event.target.value.toUpperCase(),
                }))
              }
              disabled={!draftValue.enabled}
              placeholder="H"
              helperText="Column letter, e.g. H"
            />
          </Stack>

          <Alert severity={draftValue.enabled ? "info" : "success"}>
            {draftValue.enabled
              ? "The selected file will be remapped client-side to the existing import format."
              : "With custom mapping disabled, the uploader continues to use the original header-based CSV import."}
          </Alert>

          {validationMessage ? (
            <Alert severity="error">{validationMessage}</Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={Boolean(validationMessage)}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};
