export type { PaginatedTransactions, Transaction, TransactionTreatment } from "../../../types/api";

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
