import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import SaveIcon from "@mui/icons-material/Save";
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import type {
  LocationSuggestion,
  TransactionImportBlacklistRule,
  TransactionImportBlacklistRuleType,
} from "../../types/api";
import { getLocationSuggestions } from "../../api/userPreferencesApi";
import { useUpdateUserPreferences } from "./useUpdateUserPreferences";

const maxLocationLength = 120;
const maxBlacklistRuleCount = 50;
const maxBlacklistRuleLength = 200;

const defaultBlacklistRule: TransactionImportBlacklistRule = {
  type: "literal",
  value: "",
};

const normalizeRuleValue = (value: string) => value.replace(/\s+/g, " ").trim();

const normalizeBlacklistRules = (
  rules: TransactionImportBlacklistRule[],
): TransactionImportBlacklistRule[] =>
  rules
    .map((rule) => ({
      type: rule.type,
      value: normalizeRuleValue(rule.value),
    }))
    .filter((rule) => rule.value.length > 0);

interface SettingsFormProps {
  initialAiLocationContext: string;
  initialTransactionImportBlacklistRules: TransactionImportBlacklistRule[];
  isOnline: boolean;
}

export const SettingsForm = ({
  initialAiLocationContext,
  initialTransactionImportBlacklistRules,
  isOnline,
}: SettingsFormProps) => {
  const updateMutation = useUpdateUserPreferences();
  const [aiLocationContext, setAiLocationContext] = useState(
    initialAiLocationContext,
  );
  const [blacklistRules, setBlacklistRules] = useState<
    TransactionImportBlacklistRule[]
  >(initialTransactionImportBlacklistRules);
  const [locationSuggestions, setLocationSuggestions] = useState<
    LocationSuggestion[]
  >([]);
  const [isLoadingLocationSuggestions, setIsLoadingLocationSuggestions] =
    useState(false);

  const normalizedLocation = useMemo(
    () => aiLocationContext.replace(/\s+/g, " ").trim(),
    [aiLocationContext],
  );
  const normalizedInitialRules = useMemo(
    () => normalizeBlacklistRules(initialTransactionImportBlacklistRules),
    [initialTransactionImportBlacklistRules],
  );
  const normalizedBlacklistRules = useMemo(
    () => normalizeBlacklistRules(blacklistRules),
    [blacklistRules],
  );
  const hasChanges =
    normalizedLocation !== initialAiLocationContext ||
    JSON.stringify(normalizedBlacklistRules) !==
      JSON.stringify(normalizedInitialRules);
  const isTooLong = aiLocationContext.length > maxLocationLength;
  const hasTooManyRules = normalizedBlacklistRules.length > maxBlacklistRuleCount;
  const hasRuleTooLong = blacklistRules.some(
    (rule) => rule.value.length > maxBlacklistRuleLength,
  );
  const hasValidationError = isTooLong || hasTooManyRules || hasRuleTooLong;
  const canLoadLocationSuggestions =
    isOnline && !updateMutation.isPending && normalizedLocation.length >= 3;
  const visibleLocationSuggestions = canLoadLocationSuggestions
    ? locationSuggestions
    : [];
  const showLocationSuggestionsLoading =
    canLoadLocationSuggestions && isLoadingLocationSuggestions;

  useEffect(() => {
    if (!canLoadLocationSuggestions) {
      return;
    }

    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setIsLoadingLocationSuggestions(true);
      setLocationSuggestions([]);

      getLocationSuggestions(normalizedLocation, abortController.signal)
        .then((suggestions) => setLocationSuggestions(suggestions))
        .catch(() => {
          if (!abortController.signal.aborted) {
            setLocationSuggestions([]);
          }
        })
        .finally(() => {
          if (!abortController.signal.aborted) {
            setIsLoadingLocationSuggestions(false);
          }
        });
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [canLoadLocationSuggestions, normalizedLocation]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (hasValidationError || updateMutation.isPending) {
      return;
    }

    updateMutation.mutate({
      aiLocationContext: normalizedLocation.length > 0 ? normalizedLocation : null,
      transactionImportBlacklistRules: normalizedBlacklistRules,
    });
  };

  const handleRuleTypeChange = (
    index: number,
    type: TransactionImportBlacklistRuleType,
  ) => {
    setBlacklistRules((current) =>
      current.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, type } : rule,
      ),
    );
  };

  const handleRuleValueChange = (index: number, value: string) => {
    setBlacklistRules((current) =>
      current.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, value } : rule,
      ),
    );
  };

  const handleAddRule = () => {
    setBlacklistRules((current) => [...current, { ...defaultBlacklistRule }]);
  };

  const handleRemoveRule = (index: number) => {
    setBlacklistRules((current) =>
      current.filter((_, ruleIndex) => ruleIndex !== index),
    );
  };

  const handleReset = () => {
    setAiLocationContext(initialAiLocationContext);
    setBlacklistRules(initialTransactionImportBlacklistRules);
  };

  return (
    <Box sx={{ width: "100%", maxWidth: 720 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        Settings
      </Typography>

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          <Autocomplete
            freeSolo
            options={visibleLocationSuggestions}
            inputValue={aiLocationContext}
            loading={showLocationSuggestionsLoading}
            getOptionLabel={(option) =>
              typeof option === "string" ? option : option.label
            }
            isOptionEqualToValue={(option, value) =>
              typeof value !== "string" && option.id === value.id
            }
            onInputChange={(_, value) => setAiLocationContext(value)}
            onChange={(_, value) => {
              if (typeof value === "string") {
                setAiLocationContext(value);
                return;
              }

              if (value) {
                setAiLocationContext(value.label);
              }
            }}
            disabled={updateMutation.isPending || !isOnline}
            renderInput={(params) => (
              <TextField
                {...params}
                label="AI location"
                inputProps={{
                  ...params.inputProps,
                  maxLength: maxLocationLength + 1,
                }}
                error={isTooLong}
                helperText={`${aiLocationContext.length}/${maxLocationLength}`}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {showLocationSuggestionsLoading ? (
                        <CircularProgress color="inherit" size={18} />
                      ) : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />

          <Divider />

          <Stack spacing={1.5}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>
                Import description blacklist
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Matching text is removed from imported transaction descriptions
                before saving.
              </Typography>
            </Box>

            {blacklistRules.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No blacklist rules configured.
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {blacklistRules.map((rule, index) => {
                  const valueTooLong = rule.value.length > maxBlacklistRuleLength;

                  return (
                    <Stack
                      key={`${index}-${rule.type}`}
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1.5}
                      alignItems={{ xs: "stretch", sm: "flex-start" }}
                    >
                      <FormControl sx={{ minWidth: { sm: 140 } }}>
                        <InputLabel id={`blacklist-rule-type-${index}`}>
                          Type
                        </InputLabel>
                        <Select
                          labelId={`blacklist-rule-type-${index}`}
                          value={rule.type}
                          label="Type"
                          onChange={(event) =>
                            handleRuleTypeChange(
                              index,
                              event.target.value as TransactionImportBlacklistRuleType,
                            )
                          }
                          disabled={updateMutation.isPending || !isOnline}
                        >
                          <MenuItem value="literal">Literal phrase</MenuItem>
                          <MenuItem value="regex">Regex</MenuItem>
                        </Select>
                      </FormControl>

                      <TextField
                        label={rule.type === "regex" ? "Regex" : "Word or phrase"}
                        value={rule.value}
                        onChange={(event) =>
                          handleRuleValueChange(index, event.target.value)
                        }
                        inputProps={{ maxLength: maxBlacklistRuleLength + 1 }}
                        error={valueTooLong}
                        helperText={`${rule.value.length}/${maxBlacklistRuleLength}`}
                        disabled={updateMutation.isPending || !isOnline}
                        fullWidth
                      />

                      <Button
                        type="button"
                        variant="outlined"
                        color="error"
                        onClick={() => handleRemoveRule(index)}
                        disabled={updateMutation.isPending || !isOnline}
                        sx={{ minWidth: { sm: 96 }, mt: { sm: 1 } }}
                      >
                        Remove
                      </Button>
                    </Stack>
                  );
                })}
              </Stack>
            )}

            {hasTooManyRules ? (
              <Typography variant="body2" color="error">
                Keep the blacklist to {maxBlacklistRuleCount} active rule(s) or fewer.
              </Typography>
            ) : null}

            <Button
              type="button"
              variant="outlined"
              onClick={handleAddRule}
              disabled={
                updateMutation.isPending ||
                !isOnline ||
                blacklistRules.length >= maxBlacklistRuleCount
              }
              sx={{ alignSelf: "flex-start" }}
            >
              Add blacklist rule
            </Button>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              type="submit"
              variant="contained"
              startIcon={
                updateMutation.isPending ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <SaveIcon />
                )
              }
              disabled={
                !isOnline ||
                hasValidationError ||
                !hasChanges ||
                updateMutation.isPending
              }
            >
              Save settings
            </Button>
            <Button
              type="button"
              variant="outlined"
              disabled={updateMutation.isPending || !hasChanges}
              onClick={handleReset}
            >
              Reset
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
};
