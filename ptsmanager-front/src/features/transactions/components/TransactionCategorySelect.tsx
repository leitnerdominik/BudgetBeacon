import {
  FormControl,
  MenuItem,
  Select,
  type SelectChangeEvent,
} from "@mui/material";

import { transactionCategories } from "../transactionCategories";

type TransactionCategorySelectProps = {
  autoFocus?: boolean;
  category: string;
  disabled?: boolean;
  onBlur?: () => void;
  onChange: (category: string) => void;
};

export const TransactionCategorySelect = ({
  autoFocus = false,
  category,
  disabled = false,
  onBlur,
  onChange,
}: TransactionCategorySelectProps) => {
  const hasKnownCategory = transactionCategories.some(
    (option) => option === category,
  );

  const handleChange = (event: SelectChangeEvent<string>) => {
    if (event.target.value === category) {
      return;
    }

    onChange(event.target.value);
  };

  return (
    <FormControl size="small" sx={{ minWidth: 150 }}>
      <Select
        autoFocus={autoFocus}
        value={category}
        onChange={handleChange}
        onBlur={onBlur}
        disabled={disabled}
        inputProps={{ "aria-label": "Transaction category" }}
      >
        {hasKnownCategory ? null : (
          <MenuItem value={category} disabled>
            {category}
          </MenuItem>
        )}
        {transactionCategories.map((option) => (
          <MenuItem key={option} value={option}>
            {option}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
