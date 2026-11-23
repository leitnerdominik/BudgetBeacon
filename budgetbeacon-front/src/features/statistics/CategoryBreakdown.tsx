import {
  Box,
  ButtonBase,
  Card,
  CardContent,
  Divider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import CategoryIcon from "@mui/icons-material/Category";
import { useId } from "react";

import { StatusMessage } from "../../components/AsyncState";
import type { CategoryExpenseSummary } from "../../types/api";
import { formatCurrency } from "../../utils/formatDate";
import { TransactionCategoryIcon } from "../transactions/components/TransactionCategoryIcon";
import type { CategorySpendingMetric } from "./statisticsContext";
import { statisticsContentSx, statisticsSurfaceSx } from "./statisticsLayout";

type CategoryBreakdownProps = {
  categories: CategoryExpenseSummary[];
  metric: CategorySpendingMetric;
  onMetricChange: (metric: CategorySpendingMetric) => void;
  onCategorySelect: (category: string) => void;
  periodLabel: string;
};

const percentFormatter = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

const formatPercent = (value: number) => `${percentFormatter.format(value)} %`;

type CategorySpendingRowProps = {
  category: CategoryExpenseSummary;
  amount: number;
  maximum: number;
  headingId: string;
  periodLabel: string;
  onSelect: (category: string) => void;
  showTotalDetails?: boolean;
};

const CategorySpendingRow = ({
  category,
  amount,
  maximum,
  headingId,
  periodLabel,
  onSelect,
  showTotalDetails = false,
}: CategorySpendingRowProps) => {
  const amountId = useId();

  return (
    <ButtonBase
      aria-label={`View ${category.category} transactions for ${periodLabel}`}
      aria-describedby={`${headingId} ${amountId}`}
      onClick={() => onSelect(category.category)}
      sx={{
        width: "100%",
        minHeight: 44,
        display: "block",
        p: 1,
        borderRadius: 1,
        textAlign: "left",
        transition: "background-color 0.2s ease",
        "&:hover": { bgcolor: "action.hover" },
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: 2,
        },
      }}
    >
      <Stack spacing={0.5}>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 0.5,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <TransactionCategoryIcon
                category={category.category}
                fontSize="small"
                color="action"
                sx={{ flexShrink: 0 }}
              />
              <Typography variant="subtitle2" fontWeight={700}>
                {category.category}
              </Typography>
            </Stack>
            {showTotalDetails && (
              <Typography variant="caption" color="text.secondary">
                {category.transactionCount} transactions
              </Typography>
            )}
          </Box>
          <Box
            id={amountId}
            sx={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: 1, minWidth: 0 }}
          >
            <Typography variant="body2" fontWeight={700} sx={{ fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(amount)}
            </Typography>
            {showTotalDetails && (
              <Typography variant="caption" color="text.secondary">
                {formatPercent(category.percentage)}
              </Typography>
            )}
          </Box>
        </Box>
        <Box aria-hidden="true" sx={{ height: 8, borderRadius: 1, bgcolor: "action.hover", overflow: "hidden" }}>
          <Box
            style={{ width: `${maximum > 0 ? (amount / maximum) * 100 : 0}%` }}
            sx={{ height: "100%", borderRadius: 1, bgcolor: showTotalDetails ? "primary.main" : "secondary.main" }}
          />
        </Box>
      </Stack>
    </ButtonBase>
  );
};

export const CategoryBreakdown = ({
  categories,
  metric,
  onMetricChange,
  onCategorySelect,
  periodLabel,
}: CategoryBreakdownProps) => {
  const headingId = useId();
  const medianUnavailable = categories.length > 0 &&
    categories.every((category) => category.medianMonthlyExpense === undefined);
  const activeMetric = medianUnavailable ? "total" : metric;
  const showTotal = activeMetric === "total";
  const rows: { category: CategoryExpenseSummary; amount: number }[] = [];
  let totalExpenses = 0;
  let maximum = 0;
  for (const category of categories) {
    const amount = showTotal ? category.totalExpense : category.medianMonthlyExpense;
    if (amount === undefined) continue;
    rows.push({ category, amount });
    maximum = Math.max(maximum, amount);
    if (showTotal) totalExpenses += amount;
  }

  return (
    <Card
      elevation={0}
      component="section"
      aria-label="Expenses by Category"
      sx={statisticsSurfaceSx}
    >
      <CardContent sx={statisticsContentSx}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
            <CategoryIcon color="primary" sx={{ flexShrink: 0 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography component="h2" variant="h6" fontWeight={700}>
                Expenses by Category
              </Typography>
              {showTotal && (
                <Typography variant="body2" color="text.secondary">
                  {formatCurrency(totalExpenses)} across {categories.length} categories
                </Typography>
              )}
            </Box>
          </Stack>
          <ToggleButtonGroup
            value={activeMetric}
            exclusive
            onChange={(_, nextMetric: CategorySpendingMetric | null) => {
              if (nextMetric) onMetricChange(nextMetric);
            }}
            aria-label="Category spending metric"
            size="small"
            color="primary"
            sx={{
              flexShrink: 0,
              "& .MuiToggleButton-root": { minHeight: 44, flex: { xs: 1, sm: "initial" }, px: 2 },
            }}
          >
            <ToggleButton value="total">Total</ToggleButton>
            <ToggleButton value="median" disabled={medianUnavailable}>Median</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        {medianUnavailable && (
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
            Median spending is unavailable for this data.
          </Typography>
        )}

        <Divider sx={{ my: 2 }} />

        {categories.length === 0 ? (
          <StatusMessage
            title="No expenses for this period"
            description={`No expense categories were found for ${periodLabel}.`}
            minHeight={160}
          />
        ) : (
          <Box component="section" aria-labelledby={headingId}>
            <Typography id={headingId} component="h3" variant="subtitle1" sx={{ mb: 0.75 }}>
              {showTotal ? "Total spending by category" : "Median monthly spending by category"}
            </Typography>
            <Stack spacing={0.75}>
              {rows.map(({ category, amount }) => (
                <CategorySpendingRow
                  key={category.category}
                  category={category}
                  amount={amount}
                  maximum={maximum}
                  headingId={headingId}
                  periodLabel={periodLabel}
                  onSelect={onCategorySelect}
                  showTotalDetails={showTotal}
                />
              ))}
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
