import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import RepeatIcon from "@mui/icons-material/Repeat";

import { StatusMessage } from "../../components/AsyncState";
import type { RecurringExpenseCandidate } from "../../types/api";
import { formatCurrency, formatDate } from "../../utils/formatDate";
import { TransactionCategoryIcon } from "../transactions/components/TransactionCategoryIcon";

type RecurringExpensesProps = {
  candidates: RecurringExpenseCandidate[];
  periodLabel: string;
};

export const RecurringExpenses = ({
  candidates,
  periodLabel,
}: RecurringExpensesProps) => (
  <Card
    elevation={1}
    sx={{
      mt: 2,
      minWidth: 0,
      maxWidth: "100%",
      borderRadius: 1,
      border: "1px solid",
      borderColor: "divider",
    }}
  >
    <CardContent sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        sx={{ minWidth: 0 }}
      >
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ minWidth: 0, maxWidth: "100%" }}
        >
          <RepeatIcon color="primary" sx={{ flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" fontWeight={700}>
              Recurring Expense Candidates
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ overflowWrap: "anywhere" }}
            >
              Repeated expenses for {periodLabel}
            </Typography>
          </Box>
        </Stack>
        <Chip
          label={`${candidates.length} candidates`}
          size="small"
          color={candidates.length > 0 ? "primary" : "default"}
          variant={candidates.length > 0 ? "filled" : "outlined"}
        />
      </Stack>

      <Divider sx={{ my: 2 }} />

      {candidates.length === 0 ? (
        <StatusMessage
          title="No recurring candidates"
          description="No expense pattern appeared in at least two months of the selected period."
          minHeight={220}
        />
      ) : (
        <List disablePadding>
          {candidates.map((candidate) => (
            <ListItem
              key={`${candidate.category}-${candidate.description}`}
              disableGutters
              divider
              sx={{
                py: { xs: 1.25, sm: 1.5 },
                alignItems: { xs: "flex-start", sm: "center" },
                flexDirection: { xs: "column", sm: "row" },
                gap: { xs: 0.75, sm: 0 },
              }}
            >
              <Stack direction="row" spacing={1} sx={{ minWidth: 0, width: "100%" }}>
                <Box sx={{ pt: 0.25, flexShrink: 0 }}>
                  <TransactionCategoryIcon
                    category={candidate.category}
                    fontSize="small"
                    color="action"
                  />
                </Box>
                <ListItemText
                  primary={candidate.description}
                  secondary={`${candidate.category} - ${candidate.occurrenceCount} occurrences across ${candidate.monthCount} months - Last ${formatDate(candidate.lastDate)}`}
                  sx={{ minWidth: 0, width: "100%", m: 0 }}
                  primaryTypographyProps={{
                    fontWeight: 700,
                    fontSize: { xs: "0.95rem", sm: "1rem" },
                    textTransform: "capitalize",
                    sx: { overflowWrap: "anywhere" },
                  }}
                  secondaryTypographyProps={{
                    fontSize: { xs: "0.75rem", sm: "0.875rem" },
                  }}
                />
              </Stack>
              <Stack
                alignItems="flex-end"
                sx={{
                  alignSelf: { xs: "flex-end", sm: "center" },
                  ml: { xs: 0, sm: 2 },
                  flexShrink: 0,
                }}
              >
                <Typography variant="subtitle1" fontWeight={700}>
                  {formatCurrency(candidate.averageAmount)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  avg
                </Typography>
              </Stack>
            </ListItem>
          ))}
        </List>
      )}
    </CardContent>
  </Card>
);
