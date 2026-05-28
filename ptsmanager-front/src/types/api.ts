export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface AuthResponse {
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterCredentials {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

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

export type RegionalTipCategory =
  | "Transport"
  | "Energy"
  | "Groceries"
  | "Lifestyle"
  | "Housing"
  | "Utilities"
  | "Entertainment"
  | "Health"
  | "Subscriptions"
  | "Income";

export interface RegionalTip {
  id: string;
  title: string;
  description: string;
  impact: "High" | "Medium" | "Low";
  category: RegionalTipCategory;
}
