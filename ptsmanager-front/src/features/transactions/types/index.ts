export interface Transaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  category: string;
}

export interface PaginatedTransactions {
  data: Transaction[];
  totalCount: number;
}

export interface MonthlySummary {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  averageExpense: number;
  medianExpense: number;
  transactionCount: number;
}
