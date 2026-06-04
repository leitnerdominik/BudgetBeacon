import {
  ListItemIcon,
  ListItemText,
  FormControl,
  MenuItem,
  Select,
  type SelectChangeEvent,
} from "@mui/material";

import { transactionCategories } from "../transactionCategories";
import { TransactionCategoryIcon } from "./TransactionCategoryIcon";

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
            <ListItemIcon>
              <TransactionCategoryIcon category={category} fontSize="small" />
            </ListItemIcon>
            <ListItemText>{category}</ListItemText>
          </MenuItem>
        )}
        {transactionCategories.map((option) => (
          <MenuItem key={option} value={option}>
            <ListItemIcon>
              <TransactionCategoryIcon category={option} fontSize="small" />
            </ListItemIcon>
            <ListItemText>{option}</ListItemText>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
