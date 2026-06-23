export interface Transaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  category: string;
  treatment: TransactionTreatment;
  notes: string | null;
  aiConfidenceScore: number | null;
}

export type TransactionTreatment =
  | "Income"
  | "Expense"
  | "InternalTransfer"
  | "SavingsInvestment"
  | "Refund"
  | "Adjustment";

export interface PaginatedTransactions {
  data: Transaction[];
  totalCount: number;
}

export interface MonthlySummary {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  totalSavedOrInvested: number;
  internalTransferTotal: number;
  adjustmentTotal: number;
  averageExpense: number;
  medianExpense: number;
  transactionCount: number;
  analyticsTransactionCount: number;
}
