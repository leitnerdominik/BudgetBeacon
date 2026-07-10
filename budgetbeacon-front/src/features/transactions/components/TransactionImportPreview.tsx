import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ContentCutIcon from "@mui/icons-material/ContentCut";

import type {
  TransactionImportDuplicateReason,
  TransactionImportPreviewResponse,
} from "../../../api/transactionsApi";
import { formatCurrency, formatDate } from "../../../utils/formatDate";

type TransactionImportPreviewProps = {
  preview: TransactionImportPreviewResponse;
  isImporting: boolean;
  onBack: () => void;
  onCancel: () => void;
  onImport: () => void;
};

const rowsPerPageOptions = [10, 25, 50];

const getDuplicateReasonLabel = (
  duplicateReason: TransactionImportDuplicateReason | null,
) => {
  if (duplicateReason === "existingDuplicate") {
    return "Already imported";
  }

  if (duplicateReason === "fileDuplicate") {
    return "Repeated in file";
  }

  return null;
};

export const TransactionImportPreview = ({
  preview,
  isImporting,
  onBack,
  onCancel,
  onImport,
}: TransactionImportPreviewProps) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(rowsPerPageOptions[0]);

  const visibleTransactions = preview.transactions.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage,
  );

  return (
    <Stack spacing={2.5}>
      <Stack spacing={0.5}>
        <Typography variant="h6" component="h2">
          Confirm transaction import
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Review the backend-evaluated result before any transactions are saved.
        </Typography>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(2, minmax(0, 1fr))",
            md: "repeat(5, minmax(0, 1fr))",
          },
          gap: 1.5,
        }}
      >
        {[
          { label: "Parsed", value: preview.totalParsed },
          { label: "Ready", value: preview.importable },
          { label: "Skipped", value: preview.duplicatesSkipped },
          { label: "Already imported", value: preview.existingDuplicates },
          { label: "Repeated in file", value: preview.fileDuplicates },
        ].map((summary) => (
          <Paper key={summary.label} variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="h5" fontWeight={700}>
              {summary.value}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {summary.label}
            </Typography>
          </Paper>
        ))}
      </Box>

      {preview.redactedTransactions > 0 ? (
        <Alert severity="info" icon={<ContentCutIcon />}>
          {preview.redactedTransactions} transaction description(s) were redacted
          using your import blacklist rules. The table shows the text that will be
          saved.
        </Alert>
      ) : null}

      {preview.importable === 0 ? (
        <Alert severity="info">
          Nothing new will be imported. Every parsed transaction is a duplicate.
        </Alert>
      ) : (
        <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
          {preview.importable} transaction(s) are ready to import. The final import
          result remains authoritative if account data changes before confirmation.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        <TableContainer>
          <Table size="small" sx={{ minWidth: 760 }}>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleTransactions.map((transaction, index) => {
                const duplicateReason = getDuplicateReasonLabel(
                  transaction.duplicateReason,
                );

                return (
                  <TableRow
                    key={`${transaction.date}-${transaction.amount}-${page}-${index}`}
                    sx={
                      transaction.status === "skipped"
                        ? { bgcolor: "action.hover" }
                        : undefined
                    }
                  >
                    <TableCell>{formatDate(transaction.date)}</TableCell>
                    <TableCell>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        flexWrap="wrap"
                        useFlexGap
                      >
                        <Typography variant="body2">
                          {transaction.description || "No description"}
                        </Typography>
                        {transaction.descriptionRedacted ? (
                          <Chip label="Redacted" size="small" variant="outlined" />
                        ) : null}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        color={transaction.amount < 0 ? "error.main" : "success.main"}
                      >
                        {formatCurrency(transaction.amount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.25} alignItems="flex-start">
                        <Chip
                          label={
                            transaction.status === "willImport"
                              ? "Will import"
                              : "Skipped"
                          }
                          color={
                            transaction.status === "willImport" ? "success" : "default"
                          }
                          size="small"
                        />
                        {duplicateReason ? (
                          <Typography variant="caption" color="text.secondary">
                            {duplicateReason}
                          </Typography>
                        ) : null}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={preview.transactions.length}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={rowsPerPageOptions}
          onPageChange={(_event, nextPage) => setPage(nextPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number.parseInt(event.target.value, 10));
            setPage(0);
          }}
        />
      </Paper>

      <Stack
        direction={{ xs: "column-reverse", sm: "row" }}
        spacing={1}
        justifyContent="flex-end"
      >
        <Button onClick={onCancel} disabled={isImporting}>
          Cancel
        </Button>
        <Button onClick={onBack} disabled={isImporting}>
          Back to mapping
        </Button>
        <Button
          variant="contained"
          onClick={onImport}
          disabled={isImporting || preview.importable === 0}
          startIcon={
            isImporting ? <CircularProgress size={18} color="inherit" /> : undefined
          }
        >
          {isImporting
            ? "Importing..."
            : `Import ${preview.importable} transaction(s)`}
        </Button>
      </Stack>
    </Stack>
  );
};
