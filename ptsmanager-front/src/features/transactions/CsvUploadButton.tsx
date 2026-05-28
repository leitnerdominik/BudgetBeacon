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

import { useNotification } from "../../components/NotificationProvider";
import { useUploadCsv } from "./useUploadCsv";
import {
  createMappedCsvFile,
  getCsvImportMappingValidationMessage,
  getCsvImportPreview,
  parseCsvFile,
  readStoredCsvImportMapping,
  storeCsvImportMapping,
  suggestCsvImportMapping,
  type CsvDelimiterOption,
  type CsvImportMapping,
  type ParsedCsvFile,
} from "./csvImport";

const delimiterOptions: { value: CsvDelimiterOption; label: string }[] = [
  { value: "auto", label: "Auto-detect" },
  { value: "semicolon", label: "Semicolon (;)" },
  { value: "comma", label: "Comma (,)" },
  { value: "tab", label: "Tab" },
];

export const CsvUploadButton = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showNotification } = useNotification();
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDelimiter, setSelectedDelimiter] =
    useState<CsvDelimiterOption>("auto");
  const [parsedCsv, setParsedCsv] = useState<ParsedCsvFile | null>(null);
  const [mapping, setMapping] = useState<CsvImportMapping>(() =>
    readStoredCsvImportMapping(),
  );

  // Destructure our mutation function (mutate) and the loading state (isPending)
  const { mutateAsync, isPending } = useUploadCsv();
  const preview = useMemo(
    () => (parsedCsv ? getCsvImportPreview(parsedCsv, mapping.hasHeaderRow) : null),
    [parsedCsv, mapping.hasHeaderRow],
  );
  const validationMessage = preview
    ? getCsvImportMappingValidationMessage(mapping, preview.columns)
    : null;

  const handleButtonClick = () => {
    // Programmatically click the hidden file input
    fileInputRef.current?.click();
  };

  const closeWizard = () => {
    setIsWizardOpen(false);
    setSelectedFile(null);
    setParsedCsv(null);
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

    try {
      const storedMapping = readStoredCsvImportMapping();
      const parsedFile = await parseCsvFile(file, selectedDelimiter);
      const initialPreview = getCsvImportPreview(parsedFile, storedMapping.hasHeaderRow);
      const suggestedMapping = suggestCsvImportMapping(
        initialPreview.columns,
        storedMapping,
      );

      setSelectedFile(file);
      setParsedCsv(parsedFile);
      setMapping({
        ...suggestedMapping,
        hasHeaderRow: storedMapping.hasHeaderRow,
      });
      setIsWizardOpen(true);
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

  const handleHeaderRowChange = (hasHeaderRow: boolean) => {
    if (!parsedCsv) {
      setMapping((current) => ({
        ...current,
        hasHeaderRow,
      }));
      return;
    }

    const previewForHeaderMode = getCsvImportPreview(parsedCsv, hasHeaderRow);

    setMapping((current) =>
      suggestCsvImportMapping(previewForHeaderMode.columns, {
        ...current,
        hasHeaderRow,
      }),
    );
  };

  const handleDelimiterChange = async (delimiter: CsvDelimiterOption) => {
    setSelectedDelimiter(delimiter);

    if (!selectedFile) {
      return;
    }

    setIsParsingFile(true);

    try {
      const parsedFile = await parseCsvFile(selectedFile, delimiter);
      const previewForDelimiter = getCsvImportPreview(
        parsedFile,
        mapping.hasHeaderRow,
      );
      const suggestedMapping = suggestCsvImportMapping(previewForDelimiter.columns, {
        ...mapping,
        hasHeaderRow: mapping.hasHeaderRow,
      });

      setParsedCsv(parsedFile);
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
    setMapping((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleImport = async () => {
    if (!selectedFile || !parsedCsv || !preview || validationMessage) {
      return;
    }

    try {
      const preparedFile = createMappedCsvFile(selectedFile, parsedCsv, mapping);
      storeCsvImportMapping(mapping);
      await mutateAsync({ file: preparedFile, delimiter: selectedDelimiter });
      closeWizard();
    } catch (error) {
      showNotification({
        severity: "error",
        message:
          error instanceof Error ? error.message : "Failed to prepare the CSV import.",
      });
    }
  };

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
        {isPending ? "Uploading..." : isParsingFile ? "Reading CSV..." : "Upload CSV"}
      </Button>

      {/* The hidden native file input */}
      <input
        type="file"
        accept=".csv"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      <Dialog
        open={isWizardOpen}
        onClose={isPending ? undefined : closeWizard}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>Import CSV</DialogTitle>
        <DialogContent dividers>
          {selectedFile && preview ? (
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
                    {preview.totalRowCount} row(s) ready for import. Extra columns will
                    be ignored.
                  </Typography>
                </Stack>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  alignItems={{ xs: "stretch", sm: "center" }}
                >
                  <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel id="csv-import-delimiter-label">
                      Delimiter
                    </InputLabel>
                    <Select
                      labelId="csv-import-delimiter-label"
                      value={selectedDelimiter}
                      label="Delimiter"
                      onChange={(event) => {
                        void handleDelimiterChange(
                          event.target.value as CsvDelimiterOption,
                        );
                      }}
                      disabled={isPending || isParsingFile}
                    >
                      {delimiterOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={mapping.hasHeaderRow}
                        onChange={(event) =>
                          handleHeaderRowChange(event.target.checked)
                        }
                        disabled={isPending}
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
                  <InputLabel id="csv-import-date-label">Date</InputLabel>
                  <Select
                    labelId="csv-import-date-label"
                    value={mapping.dateColumnKey}
                    label="Date"
                    onChange={(event) =>
                      handleMappingChange("dateColumnKey", event.target.value)
                    }
                    disabled={isPending}
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
                  <InputLabel id="csv-import-amount-label">Amount</InputLabel>
                  <Select
                    labelId="csv-import-amount-label"
                    value={mapping.amountColumnKey}
                    label="Amount"
                    onChange={(event) =>
                      handleMappingChange("amountColumnKey", event.target.value)
                    }
                    disabled={isPending}
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
                  <InputLabel id="csv-import-description-label">
                    Description
                  </InputLabel>
                  <Select
                    labelId="csv-import-description-label"
                    value={mapping.descriptionColumnKey}
                    label="Description"
                    onChange={(event) =>
                      handleMappingChange("descriptionColumnKey", event.target.value)
                    }
                    disabled={isPending}
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
        <DialogActions>
          <Button onClick={closeWizard} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={isPending || Boolean(validationMessage) || !preview}
          >
            {isPending ? "Importing..." : "Import transactions"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
