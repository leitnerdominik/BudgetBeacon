import { MenuItem, TextField } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { getSpendingFlexibilityCategoryDefaults } from "../../../api/transactionsApi";
import type { Transaction } from "../types";
import {
  getSpendingFlexibilitySummary,
  spendingFlexibilityChoices,
  type SpendingFlexibilityChoice,
} from "../spendingFlexibility";

type SpendingFlexibilityFieldProps = {
  value: SpendingFlexibilityChoice;
  category: string;
  transaction?: Transaction;
  disabled: boolean;
  onChange: (choice: SpendingFlexibilityChoice) => void;
};

export const SpendingFlexibilityField = ({
  value,
  category,
  transaction,
  disabled,
  onChange,
}: SpendingFlexibilityFieldProps) => {
  const defaults = useQuery({
    queryKey: ["spending-flexibility-category-defaults"],
    queryFn: getSpendingFlexibilityCategoryDefaults,
    staleTime: Infinity,
  });
  const summary = getSpendingFlexibilitySummary(value, category, transaction, defaults.data);
  const helperText = summary
    ? `${summary}. ${spendingFlexibilityChoices[value].description}`
    : defaults.isFetching
      ? "Loading the automatic assessment…"
      : "The automatic assessment is currently unavailable.";

  return (
    <TextField
      label="Financial Flexibility"
      select
      size="small"
      value={value}
      onChange={(event) => onChange(event.target.value as SpendingFlexibilityChoice)}
      disabled={disabled}
      helperText={helperText}
      fullWidth
    >
      {Object.entries(spendingFlexibilityChoices).map(([key, option]) => (
        <MenuItem key={key} value={key}>{option.label}</MenuItem>
      ))}
    </TextField>
  );
};
