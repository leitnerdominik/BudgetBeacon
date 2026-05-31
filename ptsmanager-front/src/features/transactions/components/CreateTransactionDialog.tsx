import { useState } from "react";
import type { FormEvent } from "react";
import SaveIcon from "@mui/icons-material/Save";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  type SelectChangeEvent,
} from "@mui/material";

import { transactionCategories } from "../transactionCategories";
import { useCreateTransaction } from "../hooks/useCreateTransaction";

const getTodayDateInputValue = () => new Date().toISOString().slice(0, 10);

type TransactionDirection = "expense" | "income";

interface CreateTransactionDialogProps {
  open: boolean;
  onClose: () => void;
}

export const CreateTransactionDialog = ({
  open,
  onClose,
}: CreateTransactionDialogProps) => {
  const createTransactionMutation = useCreateTransaction();
  const [date, setDate] = useState(getTodayDateInputValue);
  const [direction, setDirection] = useState<TransactionDirection>("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Uncategorized");

  const parsedAmount = Number(amount);
  const signedAmount =
    direction === "expense" ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);
  const normalizedDescription = description.replace(/\s+/g, " ").trim();
  const isAmountValid =
    amount.trim().length > 0 && Number.isFinite(parsedAmount) && parsedAmount > 0;
  const canSubmit =
    date.length > 0 &&
    isAmountValid &&
    normalizedDescription.length > 0 &&
    !createTransactionMutation.isPending;

  const resetForm = () => {
    setDate(getTodayDateInputValue());
    setDirection("expense");
    setAmount("");
    setDescription("");
    setCategory("Uncategorized");
  };

  const handleClose = () => {
    if (!createTransactionMutation.isPending) {
      resetForm();
      onClose();
    }
  };

  const handleCategoryChange = (event: SelectChangeEvent<string>) => {
    setCategory(event.target.value);
  };

  const handleDirectionChange = (event: SelectChangeEvent<TransactionDirection>) => {
    setDirection(event.target.value as TransactionDirection);
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
      },
      {
        onSuccess: () => {
          resetForm();
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Add transaction</DialogTitle>
      <DialogContent>
        <Stack component="form" id="create-transaction-form" spacing={2.25} onSubmit={handleSubmit} sx={{ pt: 1 }}>
          <TextField
            label="Date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            disabled={createTransactionMutation.isPending}
            InputLabelProps={{ shrink: true }}
            required
            fullWidth
          />

          <FormControl fullWidth>
            <InputLabel id="create-transaction-direction-label">
              Transaction type
            </InputLabel>
            <Select<TransactionDirection>
              labelId="create-transaction-direction-label"
              value={direction}
              label="Transaction type"
              onChange={handleDirectionChange}
              disabled={createTransactionMutation.isPending}
            >
              <MenuItem value="expense">Expense</MenuItem>
              <MenuItem value="income">Income</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Amount"
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={createTransactionMutation.isPending}
            inputProps={{ step: "0.01", min: "0.01" }}
            error={amount.trim().length > 0 && !isAmountValid}
            required
            fullWidth
          />

          <TextField
            label="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={createTransactionMutation.isPending}
            inputProps={{ maxLength: 200 }}
            required
            fullWidth
          />

          <FormControl fullWidth>
            <InputLabel id="create-transaction-category-label">Category</InputLabel>
            <Select
              labelId="create-transaction-category-label"
              value={category}
              label="Category"
              onChange={handleCategoryChange}
              disabled={createTransactionMutation.isPending}
            >
              {transactionCategories.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={createTransactionMutation.isPending}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="create-transaction-form"
          variant="contained"
          startIcon={
            createTransactionMutation.isPending ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              <SaveIcon />
            )
          }
          disabled={!canSubmit}
        >
          Save transaction
        </Button>
      </DialogActions>
    </Dialog>
  );
};
