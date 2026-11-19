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
  const hasSavedAssessment = transaction && (
    transaction.category === category || transaction.spendingFlexibilitySource === "MerchantRule"
  );
  const possibleDefault = defaults.data?.[category];
  const helperText = value === "UseAutomatic" && (!hasSavedAssessment || !summary)
    ? possibleDefault
      ? `${possibleDefault} is the category default if no personal rule matches.`
      : "The automatic assessment will be shown after saving."
    : `${summary}. ${spendingFlexibilityChoices[value].description}`;

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
