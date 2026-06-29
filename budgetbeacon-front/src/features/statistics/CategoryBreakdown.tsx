import {
  Box,
  ButtonBase,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import CategoryIcon from "@mui/icons-material/Category";

import { StatusMessage } from "../../components/AsyncState";
import type { CategoryExpenseSummary } from "../../types/api";
import { formatCurrency } from "../../utils/formatDate";
import { TransactionCategoryIcon } from "../transactions/components/TransactionCategoryIcon";

type CategoryBreakdownProps = {
  categories: CategoryExpenseSummary[];
  onCategorySelect: (category: string) => void;
  periodLabel: string;
};

const percentFormatter = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

const formatPercent = (value: number) => `${percentFormatter.format(value)} %`;

export const CategoryBreakdown = ({
  categories,
  onCategorySelect,
  periodLabel,
}: CategoryBreakdownProps) => {
  const maxExpense = Math.max(
    1,
    ...categories.map((category) => category.totalExpense),
  );
  const totalExpenses = categories.reduce(
    (sum, category) => sum + category.totalExpense,
    0,
  );

  return (
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
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          <CategoryIcon color="primary" sx={{ flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" fontWeight={700}>
              Expenses by Category
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ overflowWrap: "anywhere" }}
            >
              {formatCurrency(totalExpenses)} across {categories.length} categories
            </Typography>
          </Box>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {categories.length === 0 ? (
          <StatusMessage
            title="No expenses for this period"
            description={`No expense categories were found for ${periodLabel}.`}
            minHeight={220}
          />
        ) : (
          <Stack spacing={1.75}>
            {categories.map((category) => (
              <ButtonBase
                key={category.category}
                aria-label={`View ${category.category} transactions for ${periodLabel}`}
                onClick={() => onCategorySelect(category.category)}
                sx={{
                  width: "100%",
                  display: "block",
                  p: 1,
                  borderRadius: 1,
                  textAlign: "left",
                  transition: "background-color 0.2s ease",
                  "&:hover": {
                    bgcolor: "action.hover",
                  },
                  "&:focus-visible": {
                    outline: "2px solid",
                    outlineColor: "primary.main",
                    outlineOffset: 2,
                  },
                }}
              >
                <Box>
                  <Stack
                    direction="row"
                    spacing={1.5}
                    alignItems="baseline"
                    justifyContent="space-between"
                    sx={{ mb: 0.75 }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Stack
                        direction="row"
                        spacing={0.75}
                        alignItems="center"
                        sx={{ minWidth: 0 }}
                      >
                        <TransactionCategoryIcon
                          category={category.category}
                          fontSize="small"
                          color="action"
                        />
                        <Typography
                          variant="subtitle2"
                          fontWeight={700}
                          sx={{ overflowWrap: "anywhere" }}
                        >
                          {category.category}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {category.transactionCount} transactions
                      </Typography>
                    </Box>
                    <Stack alignItems="flex-end" sx={{ flexShrink: 0 }}>
                      <Typography variant="subtitle2" fontWeight={700}>
                        {formatCurrency(category.totalExpense)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatPercent(category.percentage)}
                      </Typography>
                    </Stack>
                  </Stack>
                  <Box
                    aria-label={`${category.category}: ${formatCurrency(category.totalExpense)}, ${formatPercent(category.percentage)}`}
                    role="img"
                    sx={{
                      height: 8,
                      borderRadius: 1,
                      bgcolor: "action.hover",
                      overflow: "hidden",
                    }}
                  >
                    <Box
                      sx={{
                        width: `${Math.max((category.totalExpense / maxExpense) * 100, 3)}%`,
                        height: "100%",
                        borderRadius: 1,
                        bgcolor: "primary.main",
                      }}
                    />
                  </Box>
                </Box>
              </ButtonBase>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};
