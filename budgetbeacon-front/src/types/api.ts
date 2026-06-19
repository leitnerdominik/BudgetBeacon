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

export interface UserPreferences {
  aiLocationContext: string | null;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  category: string;
  notes: string | null;
  aiConfidenceScore: number | null;
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

export interface MonthlySummaryWithPeriod extends MonthlySummary {
  month: number;
  year: number;
}

export interface StatisticsTrendPoint {
  year: number;
  month: number | null;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  transactionCount: number;
}

export interface StatisticsOverview {
  allTime: boolean;
  monthsBack: number | null;
  startDate: string | null;
  endDate: string | null;
  trendGranularity: "month" | "year";
  summary: MonthlySummary;
  previousMonthSummary: MonthlySummary | null;
  trend: StatisticsTrendPoint[];
  categories: CategoryExpenseSummary[];
  topExpenses: TopExpense[];
  recurringExpenses: RecurringExpenseCandidate[];
}

export interface CategoryExpenseSummary {
  category: string;
  totalExpense: number;
  percentage: number;
  transactionCount: number;
}

export interface TopExpense {
  id: string;
  date: string;
  amount: number;
  category: string;
  description: string;
}

export interface RecurringExpenseCandidate {
  description: string;
  category: string;
  averageAmount: number;
  minAmount: number;
  maxAmount: number;
  occurrenceCount: number;
  monthCount: number;
  lastDate: string;
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
