import type { TransactionTreatment } from "../../types/api";

export const transactionTreatmentOptions: Array<{
  value: TransactionTreatment;
  label: string;
  description: string;
}> = [
  {
    value: "Income",
    label: "Income",
    description: "Counts toward income.",
  },
  {
    value: "Expense",
    label: "Expense",
    description: "Counts toward spending charts.",
  },
  {
    value: "InternalTransfer",
    label: "Internal transfer",
    description: "Excluded from income, expenses and balance.",
  },
  {
    value: "SavingsInvestment",
    label: "Savings / investment",
    description: "Tracked separately from expenses.",
  },
  {
    value: "Refund",
    label: "Refund",
    description: "Reduces spending instead of income.",
  },
  {
    value: "Adjustment",
    label: "Adjustment",
    description: "Excluded from normal analytics.",
  },
];

export const getDefaultTransactionTreatment = (
  amount: number,
  category: string,
): TransactionTreatment => {
  if (category === "Income" || amount > 0) {
    return "Income";
  }

  if (category === "Transfers & Adjustments") {
    return "InternalTransfer";
  }

  if (category === "Savings & Investments") {
    return "SavingsInvestment";
  }

  return "Expense";
};

export const getTransactionTreatmentLabel = (
  treatment: TransactionTreatment,
) =>
  transactionTreatmentOptions.find((option) => option.value === treatment)
    ?.label ?? treatment;
