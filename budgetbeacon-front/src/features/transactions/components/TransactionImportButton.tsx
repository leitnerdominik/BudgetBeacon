import { useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import TuneIcon from "@mui/icons-material/Tune";

import { useNotification } from "../../../components/NotificationProvider";
import { usePreviewTransactionImport } from "../hooks/usePreviewTransactionImport";
import { useUploadTransactions } from "../hooks/useUploadTransactions";
import {
  createMappedCsvFile,
  getTransactionImportMappingValidationMessage,
  getTransactionImportPreview,
  parseTransactionImportFile,
  readStoredTransactionImportMapping,
  resolveImportColumnIndex,
  storeTransactionImportMapping,
  suggestTransactionImportMapping,
  type CsvDelimiterOption,
  type ParsedTransactionImportFile,
  type TransactionImportMapping,
} from "../utils/transactionImport";
import { TransactionImportPreview } from "./TransactionImportPreview";

const delimiterOptions: { value: CsvDelimiterOption; label: string }[] = [
  { value: "auto", label: "Auto-detect" },
  { value: "semicolon", label: "Semicolon (;)" },
  { value: "comma", label: "Comma (,)" },
  { value: "tab", label: "Tab" },
];

export const TransactionImportButton = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showNotification } = useNotification();
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDelimiter, setSelectedDelimiter] =
    useState<CsvDelimiterOption>("auto");
  const [parsedFile, setParsedFile] = useState<ParsedTransactionImportFile | null>(
    null,
  );
  const [mapping, setMapping] = useState<TransactionImportMapping>(() =>
    readStoredTransactionImportMapping(),
  );

  const { mutateAsync, isPending } = useUploadTransactions();
  const {
    mutateAsync: previewImportAsync,
    isPending: isPreviewPending,
    data: importPreview,
    reset: resetImportPreview,
  } = usePreviewTransactionImport();
  const preview = useMemo(
    () =>
      parsedFile ? getTransactionImportPreview(parsedFile, mapping.hasHeaderRow) : null,
    [parsedFile, mapping.hasHeaderRow],
  );
  const validationMessage = preview
    ? getTransactionImportMappingValidationMessage(mapping, preview.columns)
    : null;
  const isXlsxImport = parsedFile?.fileKind === "xlsx";

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const closeWizard = () => {
    setIsWizardOpen(false);
    setSelectedFile(null);
    setParsedFile(null);
    resetImportPreview();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (!file) {
      return;
    }

    setIsParsingFile(true);
    resetImportPreview();

    try {
      const storedMapping = readStoredTransactionImportMapping();
      const parsedImportFile = await parseTransactionImportFile(
        file,
        selectedDelimiter,
      );
      const initialPreview = getTransactionImportPreview(
        parsedImportFile,
        storedMapping.hasHeaderRow,
      );
      const suggestedMapping = suggestTransactionImportMapping(
        initialPreview.columns,
        storedMapping,
      );

      setSelectedFile(file);
      setParsedFile(parsedImportFile);
      setMapping({
        ...suggestedMapping,
        hasHeaderRow: storedMapping.hasHeaderRow,
      });
      setIsWizardOpen(true);
    } catch (error) {
      showNotification({
        severity: "error",
        message:
          error instanceof Error ? error.message : "Failed to read the file.",
      });
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleHeaderRowChange = (hasHeaderRow: boolean) => {
    resetImportPreview();

    if (!parsedFile) {
      setMapping((current) => ({
        ...current,
        hasHeaderRow,
      }));
      return;
    }

    const previewForHeaderMode = getTransactionImportPreview(
      parsedFile,
      hasHeaderRow,
    );

    setMapping((current) =>
      suggestTransactionImportMapping(previewForHeaderMode.columns, {
        ...current,
        hasHeaderRow,
      }),
    );
  };

  const handleDelimiterChange = async (delimiter: CsvDelimiterOption) => {
    setSelectedDelimiter(delimiter);
    resetImportPreview();

    if (!selectedFile) {
      return;
    }

    setIsParsingFile(true);

    try {
      const parsedImportFile = await parseTransactionImportFile(
        selectedFile,
        delimiter,
      );
      const previewForDelimiter = getTransactionImportPreview(
        parsedImportFile,
        mapping.hasHeaderRow,
      );
      const suggestedMapping = suggestTransactionImportMapping(
        previewForDelimiter.columns,
        {
          ...mapping,
          hasHeaderRow: mapping.hasHeaderRow,
        },
      );

      setParsedFile(parsedImportFile);
      setMapping(suggestedMapping);
    } catch (error) {
      showNotification({
        severity: "error",
        message:
          error instanceof Error ? error.message : "Failed to read the CSV file.",
      });
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleMappingChange = (
    field: "dateColumnKey" | "amountColumnKey" | "descriptionColumnKey",
    value: string,
  ) => {
    resetImportPreview();
    setMapping((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const createUploadInput = () => {
    if (!selectedFile || !parsedFile || !preview || validationMessage) {
      throw new Error(
        validationMessage ?? "Select a valid transaction file before continuing.",
      );
    }

    if (parsedFile.fileKind === "xlsx") {
      return {
        file: selectedFile,
        delimiter: "auto",
        mapping: {
          hasHeaderRow: mapping.hasHeaderRow,
          dateColumnIndex: resolveImportColumnIndex(mapping.dateColumnKey),
          amountColumnIndex: resolveImportColumnIndex(mapping.amountColumnKey),
          descriptionColumnIndex: mapping.descriptionColumnKey
            ? resolveImportColumnIndex(mapping.descriptionColumnKey)
            : undefined,
        },
      };
    }

    return {
      file: createMappedCsvFile(selectedFile, parsedFile, mapping),
      delimiter: selectedDelimiter,
    };
  };

  const handlePreviewImport = async () => {
    try {
      storeTransactionImportMapping(mapping);
      await previewImportAsync(createUploadInput());
    } catch (error) {
      showNotification({
        severity: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to evaluate the transaction import.",
      });
    }
  };

  const handleImport = async () => {
    try {
      await mutateAsync(createUploadInput());

      closeWizard();
    } catch (error) {
      showNotification({
        severity: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to prepare the transaction import.",
      });
    }
  };

  const handleBackToMapping = () => {
    resetImportPreview();
  };

  const isWizardBusy = isPending || isPreviewPending || isParsingFile;

  return (
    <>
      <Button
        component="label"
        variant="contained"
        startIcon={
          isPending || isParsingFile ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            <CloudUploadIcon />
          )
        }
        onClick={handleButtonClick}
        disabled={isPending || isParsingFile}
      >
        {isPending
          ? "Uploading..."
          : isParsingFile
            ? "Reading file..."
            : "Upload transactions"}
      </Button>

      <input
        type="file"
        accept=".csv,.xlsx"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      <Dialog
        open={isWizardOpen}
        onClose={isWizardBusy ? undefined : closeWizard}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>Import transactions</DialogTitle>
        <DialogContent dividers>
          {importPreview ? (
            <TransactionImportPreview
              preview={importPreview}
              isImporting={isPending}
              onBack={handleBackToMapping}
              onCancel={closeWizard}
              onImport={() => {
                void handleImport();
              }}
            />
          ) : selectedFile && preview ? (
            <Stack spacing={2.5}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", md: "center" }}
              >
                <Stack spacing={0.5}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {selectedFile.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {preview.totalRowCount} row(s) ready for evaluation. Extra
                    columns will be ignored.
                  </Typography>
                </Stack>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  alignItems={{ xs: "stretch", sm: "center" }}
                >
                  {!isXlsxImport && (
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                      <InputLabel id="transaction-import-delimiter-label">
                        Delimiter
                      </InputLabel>
                      <Select
                        labelId="transaction-import-delimiter-label"
                        value={selectedDelimiter}
                        label="Delimiter"
                        onChange={(event) => {
                          void handleDelimiterChange(
                            event.target.value as CsvDelimiterOption,
                          );
                        }}
                        disabled={isWizardBusy || isParsingFile}
                      >
                        {delimiterOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                  <FormControlLabel
                    control={
                      <Switch
                        checked={mapping.hasHeaderRow}
                        onChange={(event) =>
                          handleHeaderRowChange(event.target.checked)
                        }
                        disabled={isWizardBusy}
                      />
                    }
                    label="First row contains headers"
                  />
                </Stack>
              </Stack>

              <Alert severity="info" icon={<TuneIcon />}>
                Map the source columns you want to import. Only the selected date,
                amount, and description columns are sent to the backend.
              </Alert>

              <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                <FormControl fullWidth>
                  <InputLabel id="transaction-import-date-label">Date</InputLabel>
                  <Select
                    labelId="transaction-import-date-label"
                    value={mapping.dateColumnKey}
                    label="Date"
                    onChange={(event) =>
                      handleMappingChange("dateColumnKey", event.target.value)
                    }
                    disabled={isWizardBusy}
                  >
                    {preview.columns.map((column) => (
                      <MenuItem key={column.key} value={column.key}>
                        {column.label}
                        {column.sampleValue ? ` - ${column.sampleValue}` : ""}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel id="transaction-import-amount-label">
                    Amount
                  </InputLabel>
                  <Select
                    labelId="transaction-import-amount-label"
                    value={mapping.amountColumnKey}
                    label="Amount"
                    onChange={(event) =>
                      handleMappingChange("amountColumnKey", event.target.value)
                    }
                    disabled={isWizardBusy}
                  >
                    {preview.columns.map((column) => (
                      <MenuItem key={column.key} value={column.key}>
                        {column.label}
                        {column.sampleValue ? ` - ${column.sampleValue}` : ""}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel id="transaction-import-description-label">
                    Description
                  </InputLabel>
                  <Select
                    labelId="transaction-import-description-label"
                    value={mapping.descriptionColumnKey}
                    label="Description"
                    onChange={(event) =>
                      handleMappingChange("descriptionColumnKey", event.target.value)
                    }
                    disabled={isWizardBusy}
                  >
                    <MenuItem value="">Ignore description</MenuItem>
                    {preview.columns.map((column) => (
                      <MenuItem key={column.key} value={column.key}>
                        {column.label}
                        {column.sampleValue ? ` - ${column.sampleValue}` : ""}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>

              {validationMessage ? (
                <Alert severity="error">{validationMessage}</Alert>
              ) : null}

              <TableContainer component={Paper} variant="outlined">
                <Table size="small" sx={{ minWidth: 720 }}>
                  <TableHead>
                    <TableRow>
                      {preview.columns.map((column) => {
                        const isDateColumn = mapping.dateColumnKey === column.key;
                        const isAmountColumn = mapping.amountColumnKey === column.key;
                        const isDescriptionColumn =
                          mapping.descriptionColumnKey === column.key;
                        const selectedLabel = isDateColumn
                          ? "Date"
                          : isAmountColumn
                            ? "Amount"
                            : isDescriptionColumn
                              ? "Description"
                              : null;

                        return (
                          <TableCell
                            key={column.key}
                            sx={
                              selectedLabel
                                ? {
                                    bgcolor: "action.selected",
                                  }
                                : undefined
                            }
                          >
                            <Stack spacing={0.25}>
                              <Typography variant="subtitle2" fontWeight={700}>
                                {column.label}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {selectedLabel ?? column.columnLetter}
                              </Typography>
                            </Stack>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {preview.previewRows.map((row, rowIndex) => (
                      <TableRow key={`${selectedFile.name}-${rowIndex}`}>
                        {preview.columns.map((column) => (
                          <TableCell key={column.key}>
                            {row[column.index] ?? ""}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          ) : null}
        </DialogContent>
        {!importPreview ? (
          <DialogActions>
            <Button onClick={closeWizard} disabled={isWizardBusy}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                void handlePreviewImport();
              }}
              disabled={
                isWizardBusy ||
                isParsingFile ||
                Boolean(validationMessage) ||
                !preview
              }
              startIcon={
                isPreviewPending ? (
                  <CircularProgress size={18} color="inherit" />
                ) : undefined
              }
            >
              {isPreviewPending ? "Evaluating..." : "Preview import"}
            </Button>
          </DialogActions>
        ) : null}
      </Dialog>
    </>
  );
};
