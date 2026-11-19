import { MenuItem, Stack, TextField } from "@mui/material";
import type { SpendingFlexibilityRulePattern } from "../../api/spendingFlexibilityRulesApi";

type RulePatternFieldsProps = {
  value: SpendingFlexibilityRulePattern;
  onChange: (value: SpendingFlexibilityRulePattern) => void;
  disabled: boolean;
};

export const RulePatternFields = ({ value, onChange, disabled }: RulePatternFieldsProps) => (
  <Stack spacing={2}>
    <TextField
      label="Match type"
      select
      size="small"
      value={value.matchType}
      onChange={(event) => onChange({
        ...value,
        matchType: event.target.value === "Prefix" ? "Prefix" : "Exact",
      })}
      disabled={disabled}
      fullWidth
    >
      <MenuItem value="Exact">Exact description</MenuItem>
      <MenuItem value="Prefix">Description starts with</MenuItem>
    </TextField>
    <TextField
      label="Description to match"
      value={value.pattern}
      onChange={(event) => onChange({ ...value, pattern: event.target.value })}
      helperText="Matching ignores letter case and extra whitespace."
      slotProps={{ htmlInput: { maxLength: 500 } }}
      disabled={disabled}
      size="small"
      fullWidth
      required
    />
  </Stack>
);
