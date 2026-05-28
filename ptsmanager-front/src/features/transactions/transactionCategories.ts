export const transactionCategories = [
  "Transport",
  "Energy",
  "Groceries",
  "Lifestyle",
  "Housing",
  "Utilities",
  "Entertainment",
  "Health",
  "Subscriptions",
  "Income",
  "Uncategorized",
] as const;

export type TransactionCategory = (typeof transactionCategories)[number];
