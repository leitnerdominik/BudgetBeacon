import { useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  List,
  ListItem,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type {
  SpendingFlexibilityRule,
  SpendingFlexibilityRuleWriteRequest,
} from "../../api/spendingFlexibilityRulesApi";
import { spendingFlexibilityChoices } from "../transactions/spendingFlexibility";
import { RulePatternFields } from "./RulePatternFields";
import {
  useSpendingFlexibilityRuleMutation,
  useSpendingFlexibilityRules,
} from "./useSpendingFlexibilityRules";

type RuleEditor = SpendingFlexibilityRuleWriteRequest & { id?: string };

const ruleClasses = ["Essential", "Optimizable", "Optional", "Unclassified"] as const;

export const SpendingFlexibilityRules = ({ isOnline }: { isOnline: boolean }) => {
  const rules = useSpendingFlexibilityRules();
  const mutation = useSpendingFlexibilityRuleMutation();
  const [editor, setEditor] = useState<RuleEditor | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<SpendingFlexibilityRule | null>(null);
  const isPending = mutation.isPending;
  const canChangeRules = isOnline && !isPending;

  const openEditor = (rule?: SpendingFlexibilityRule) => {
    mutation.reset();
    setEditor(rule ?? { matchType: "Exact", pattern: "", spendingFlexibility: "Essential" });
  };

  const saveRule = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor || !editor.pattern.trim() || !canChangeRules) return;

    const { id, ...request } = editor;
    mutation.mutate({ action: "save", id, request }, { onSuccess: () => setEditor(null) });
  };

  const deleteRule = () => {
    if (!ruleToDelete || !canChangeRules) return;

    mutation.mutate({ action: "delete", id: ruleToDelete.id }, {
      onSuccess: () => setRuleToDelete(null),
    });
  };

  const mutationError = mutation.error && <Alert severity="error">{mutation.error.message}</Alert>;

  return (
    <Stack component="section" spacing={1.5} aria-labelledby="spending-flexibility-rules-title">
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={1.5}
      >
        <Box>
          <Typography id="spending-flexibility-rules-title" variant="subtitle1" component="h2" fontWeight={700}>
            Financial Flexibility rules
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Apply an assessment to existing and future expenses with matching descriptions.
            Exact matches take priority, followed by the longest matching prefix.
          </Typography>
        </Box>
        <Button variant="outlined" onClick={() => openEditor()} disabled={!canChangeRules} sx={{ flexShrink: 0 }}>
          Add rule
        </Button>
      </Stack>

      {rules.isLoading && <CircularProgress size={24} aria-label="Loading rules" />}
      {rules.isError && (
        <Alert severity="error" action={<Button color="inherit" onClick={() => void rules.refetch()}>Retry</Button>}>
          {isOnline ? "Rules could not be loaded." : "Reconnect to load your rules."}
        </Alert>
      )}
      {rules.data?.length === 0 && <Typography color="text.secondary">No personal rules yet.</Typography>}
      {!!rules.data?.length && (
        <List disablePadding>
          {rules.data.map((rule) => (
            <ListItem key={rule.id} disableGutters divider>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                alignItems={{ xs: "flex-start", sm: "center" }}
                justifyContent="space-between"
                spacing={1}
                sx={{ width: "100%" }}
              >
                <Box sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                  <Typography fontWeight={600}>{rule.pattern}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {rule.matchType === "Exact" ? "Exact description" : "Description starts with"}
                    {" · "}{spendingFlexibilityChoices[rule.spendingFlexibility].label}
                  </Typography>
                </Box>
                <Stack direction="row" sx={{ flexShrink: 0 }}>
                  <Button disabled={!canChangeRules} onClick={() => openEditor(rule)}>Edit</Button>
                  <Button
                    color="error"
                    disabled={!canChangeRules}
                    onClick={() => {
                      mutation.reset();
                      setRuleToDelete(rule);
                    }}
                  >
                    Delete
                  </Button>
                </Stack>
              </Stack>
            </ListItem>
          ))}
        </List>
      )}

      <Dialog open={editor !== null} onClose={() => !isPending && setEditor(null)} fullWidth maxWidth="xs">
        {editor && (
          <Box component="form" onSubmit={saveRule}>
            <DialogTitle>{editor.id ? "Edit rule" : "Add rule"}</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <RulePatternFields
                  value={editor}
                  onChange={(pattern) => setEditor({ ...editor, ...pattern })}
                  disabled={isPending}
                />
                <TextField
                  label="Financial Flexibility"
                  select
                  size="small"
                  value={editor.spendingFlexibility}
                  onChange={(event) => {
                    const spendingFlexibility = ruleClasses.find((choice) => choice === event.target.value);
                    if (spendingFlexibility) setEditor({ ...editor, spendingFlexibility });
                  }}
                  disabled={isPending}
                  fullWidth
                >
                  {ruleClasses.map((choice) => (
                    <MenuItem key={choice} value={choice}>{spendingFlexibilityChoices[choice].label}</MenuItem>
                  ))}
                </TextField>
                {mutationError}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEditor(null)} disabled={isPending}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={!canChangeRules || !editor.pattern.trim()}>
                Save rule
              </Button>
            </DialogActions>
          </Box>
        )}
      </Dialog>

      <Dialog open={ruleToDelete !== null} onClose={() => !isPending && setRuleToDelete(null)} fullWidth maxWidth="xs">
        <DialogTitle>Delete rule?</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <DialogContentText sx={{ overflowWrap: "anywhere" }}>
              Delete the rule for “{ruleToDelete?.pattern}”? Matching expenses will use their next available assessment.
            </DialogContentText>
            {mutationError}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRuleToDelete(null)} disabled={isPending}>Cancel</Button>
          <Button variant="contained" color="error" onClick={deleteRule} disabled={!canChangeRules}>Delete rule</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};
