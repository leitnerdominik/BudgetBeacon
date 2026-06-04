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
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { useNavigate } from "react-router-dom";

import { useNetworkStatus } from "../../../hooks/useNetworkStatus";
import { transactionCategoryOptions } from "../transactionCategories";
import { useCreateTransaction } from "../hooks/useCreateTransaction";

const getTodayDateInputValue = () => new Date().toISOString().slice(0, 10);

type TransactionDirection = "expense" | "income";

export const CreateTransactionForm = () => {
  const navigate = useNavigate();
  const isOnline = useNetworkStatus();
  const createTransactionMutation = useCreateTransaction();
  const [date, setDate] = useState(getTodayDateInputValue);
  const [direction, setDirection] = useState<TransactionDirection>("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState("Uncategorized");

  const parsedAmount = Number(amount);
  const signedAmount =
    direction === "expense" ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);
  const normalizedDescription = description.replace(/\s+/g, " ").trim();
  const normalizedNotes = notes.trim();
  const isAmountValid =
    amount.trim().length > 0 && Number.isFinite(parsedAmount) && parsedAmount > 0;
  const canSubmit =
    isOnline &&
    date.length > 0 &&
    isAmountValid &&
    normalizedDescription.length > 0 &&
    !createTransactionMutation.isPending;

  const handleDirectionChange = (
    _: MouseEvent<HTMLElement>,
    value: TransactionDirection | null,
  ) => {
    if (value) {
      setDirection(value);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    createTransactionMutation.mutate(
      {
        date,
        amount: signedAmount,
        description: normalizedDescription,
        category,
        notes: normalizedNotes || null,
      },
      {
        onSuccess: () => navigate("/transactions"),
      },
    );
  };

  const isPending = createTransactionMutation.isPending;

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
            Add transaction
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Record one income or expense entry manually.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/transactions")}
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
                  slotProps={{ inputLabel: { shrink: true } }}
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
                  slotProps={{ htmlInput: { step: "0.01", min: "0.01" } }}
                  error={amount.trim().length > 0 && !isAmountValid}
                  helperText={
                    amount.trim().length > 0 && !isAmountValid
                      ? "Enter an amount greater than zero."
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
                    <Grid key={option.value} size={{ xs: 6, sm: 4, md: 3 }}>
                      <ButtonBase
                        onClick={() => setCategory(option.value)}
                        disabled={isPending}
                        aria-pressed={selected}
                        sx={{
                          width: "100%",
                          minHeight: 104,
                          p: 1.5,
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
                        <Stack spacing={1} alignItems="center">
                          <option.Icon color="inherit" />
                          <Typography variant="body2" fontWeight={700} textAlign="center">
                            {option.value}
                          </Typography>
                        </Stack>
                      </ButtonBase>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>

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
                onClick={() => navigate("/transactions")}
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
                Save transaction
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};
