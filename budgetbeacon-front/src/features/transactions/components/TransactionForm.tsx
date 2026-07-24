import { useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import {
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { useLocation, useNavigate } from "react-router-dom";

import { useNetworkStatus } from "../../../hooks/useNetworkStatus";
import { transactionCategoryOptions } from "../transactionCategories";
import {
  getDefaultTransactionTreatment,
  transactionTreatmentOptions,
} from "../transactionTreatment";
import { useCreateTransaction } from "../hooks/useCreateTransaction";
import { useUpdateTransaction } from "../hooks/useUpdateTransaction";
import { getTransactionsReturnPath } from "../transactionListUrlState";
import type { Transaction } from "../types";
import {
  maximumAbsoluteTransactionAmountInput,
  maximumSupportedTransactionDate,
  minimumSupportedTransactionDate,
  validateTransactionAmount,
  validateTransactionDate,
} from "../financialValueValidation";
import { getLocalCalendarDate } from "../../../utils/calendarDate";

type TransactionDirection = "expense" | "income";

type TransactionFormProps = {
  transaction?: Transaction;
};

export const TransactionForm = ({ transaction }: TransactionFormProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isOnline = useNetworkStatus();
  const createTransactionMutation = useCreateTransaction();
  const updateTransactionMutation = useUpdateTransaction();
  const isEdit = Boolean(transaction);
  const transactionsReturnPath = getTransactionsReturnPath(location.search);
  const [date, setDate] = useState(
    transaction ? transaction.date.slice(0, 10) : getLocalCalendarDate,
  );
  const [direction, setDirection] = useState<TransactionDirection>(
    transaction && transaction.amount > 0 ? "income" : "expense",
  );
  const [amount, setAmount] = useState(
    transaction ? String(Math.abs(transaction.amount)) : "",
  );
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [notes, setNotes] = useState(transaction?.notes ?? "");
  const [category, setCategory] = useState(
    transaction?.category ?? "Food & Groceries",
  );
  const [treatment, setTreatment] = useState(
    transaction?.treatment ??
      getDefaultTransactionTreatment(
        transaction?.amount ?? -1,
        transaction?.category ?? "Food & Groceries",
      ),
  );

  const amountValidation = validateTransactionAmount(amount);
  const parsedAmount = amountValidation.value ?? 0;
  const signedAmount =
    direction === "expense" ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);
  const normalizedDescription = description.replace(/\s+/g, " ").trim();
  const normalizedNotes = notes.trim();
  const dateValidationError = validateTransactionDate(date);
  const isAmountValid = amountValidation.error === null;
  const isDateValid = dateValidationError === null;
  const canSubmit =
    isOnline &&
    isDateValid &&
    isAmountValid &&
    normalizedDescription.length > 0 &&
    !createTransactionMutation.isPending &&
    !updateTransactionMutation.isPending;

  const handleDirectionChange = (
    _: MouseEvent<HTMLElement>,
    value: TransactionDirection | null,
  ) => {
    if (value) {
      setDirection(value);
      setTreatment(
        getDefaultTransactionTreatment(
          value === "expense" ? -1 : 1,
          category,
        ),
      );
    }
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    setTreatment(getDefaultTransactionTreatment(signedAmount, value));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    const request = {
      date,
      amount: signedAmount,
      description: normalizedDescription,
      category,
      treatment,
      notes: normalizedNotes || null,
    };
    const options = {
      onSuccess: () => navigate(transactionsReturnPath),
    };

    if (transaction) {
      updateTransactionMutation.mutate(
        { transactionId: transaction.id, request },
        options,
      );
      return;
    }

    createTransactionMutation.mutate(request, options);
  };

  const isPending =
    createTransactionMutation.isPending || updateTransactionMutation.isPending;

  return (
    <Box sx={{ width: "100%", maxWidth: 960, mx: "auto" }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h4" component="h1">
            {isEdit ? "Edit transaction" : "Add transaction"}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {isEdit
              ? "Update the details of this transaction."
              : "Record one income or expense entry manually."}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(transactionsReturnPath)}
          disabled={isPending}
        >
          Back to transactions
        </Button>
      </Stack>

      <Card>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack component="form" spacing={3} onSubmit={handleSubmit}>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Transaction type
              </Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                value={direction}
                onChange={handleDirectionChange}
                aria-label="Transaction type"
                sx={{
                  maxWidth: 420,
                  "& .MuiToggleButtonGroup-grouped": {
                    flex: 1,
                    py: 1,
                    borderColor: "divider",
                    fontWeight: 700,
                    "&.Mui-selected": {
                      color: "primary.dark",
                      backgroundColor: "primary.light",
                    },
                  },
                }}
              >
                <ToggleButton value="expense" aria-label="Expense" disabled={isPending}>
                  Expense
                </ToggleButton>
                <ToggleButton value="income" aria-label="Income" disabled={isPending}>
                  Income
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  disabled={isPending}
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: {
                      min: minimumSupportedTransactionDate,
                      max: maximumSupportedTransactionDate,
                    },
                  }}
                  error={dateValidationError !== null}
                  helperText={dateValidationError ?? " "}
                  required
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Amount"
                  type="number"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  disabled={isPending}
                  slotProps={{
                    htmlInput: {
                      step: "0.01",
                      min: "0.01",
                      max: maximumAbsoluteTransactionAmountInput,
                    },
                  }}
                  error={amount.trim().length > 0 && !isAmountValid}
                  helperText={
                    amount.trim().length > 0 && !isAmountValid
                      ? amountValidation.error
                      : " "
                  }
                  required
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  disabled={isPending}
                  slotProps={{ htmlInput: { maxLength: 200 } }}
                  helperText={`${description.length}/200`}
                  required
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  disabled={isPending}
                  slotProps={{ htmlInput: { maxLength: 500 } }}
                  helperText={`${notes.length}/500 / Optional`}
                  minRows={3}
                  multiline
                  fullWidth
                />
              </Grid>
            </Grid>

            <Divider />

            <Box>
              <Typography variant="subtitle1" fontWeight={700}>
                Category
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                Choose the category that best matches this transaction.
              </Typography>
              <Grid container spacing={1.5} role="group" aria-label="Transaction category">
                {transactionCategoryOptions.map((option) => {
                  const selected = option.value === category;

                  return (
                    <Grid key={option.value} size={{ xs: 12, sm: 6, md: 4 }}>
                      <ButtonBase
                        onClick={() => handleCategoryChange(option.value)}
                        disabled={isPending}
                        aria-pressed={selected}
                        sx={{
                          width: "100%",
                          height: "100%",
                          minHeight: 142,
                          p: 1.5,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1px solid",
                          borderColor: selected ? "primary.main" : "divider",
                          borderRadius: 1,
                          color: selected ? "primary.dark" : "text.primary",
                          bgcolor: selected ? "primary.light" : "background.paper",
                          transition: "border-color 0.2s ease, background-color 0.2s ease",
                          "&:hover": {
                            borderColor: "primary.main",
                            bgcolor: selected ? "primary.light" : "action.hover",
                          },
                          "&:focus-visible": {
                            outline: "2px solid",
                            outlineColor: "primary.main",
                            outlineOffset: 2,
                          },
                        }}
                      >
                        <Stack
                          spacing={1}
                          alignItems="center"
                          justifyContent="center"
                          sx={{ width: "100%", height: "100%", textAlign: "center" }}
                        >
                          <option.Icon color="inherit" />
                          <Box>
                            <Typography variant="body2" fontWeight={700}>
                              {option.value}
                            </Typography>
                            <Typography
                              variant="caption"
                              color={selected ? "primary.dark" : "text.secondary"}
                              sx={{ display: "block", mt: 0.5, lineHeight: 1.35 }}
                            >
                              {option.description}
                            </Typography>
                          </Box>
                        </Stack>
                      </ButtonBase>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>

            <TextField
              label="Statistics treatment"
              select
              value={treatment}
              onChange={(event) =>
                setTreatment(event.target.value as Transaction["treatment"])
              }
              disabled={isPending}
              helperText="Expenses affect spending charts; transfers do not; savings and investments are tracked separately."
              fullWidth
            >
              {transactionTreatmentOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  <Box>
                    <Typography variant="body2">{option.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </TextField>

            {!isOnline ? (
              <Typography variant="body2" color="error">
                Reconnect to the internet before saving this transaction.
              </Typography>
            ) : null}

            <Stack
              direction={{ xs: "column-reverse", sm: "row" }}
              spacing={1}
              justifyContent="flex-end"
            >
              <Button
                variant="outlined"
                onClick={() => navigate(transactionsReturnPath)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={
                  isPending ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />
                }
                disabled={!canSubmit}
              >
                {isEdit ? "Update transaction" : "Save transaction"}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};
