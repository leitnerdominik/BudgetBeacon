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

export type TransactionImportBlacklistRuleType = "literal" | "regex";

export interface TransactionImportBlacklistRule {
  type: TransactionImportBlacklistRuleType;
  value: string;
}

export interface UserPreferences {
  aiLocationContext: string | null;
  transactionImportBlacklistRules: TransactionImportBlacklistRule[];
}

export interface LocationSuggestion {
  id: string;
  label: string;
  name: string;
  admin1: string | null;
  country: string;
  countryCode: string;
}

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
  totalSavedOrInvested: number;
  internalTransferTotal: number;
  adjustmentTotal: number;
  transactionCount: number;
  analyticsTransactionCount: number;
}

export interface StatisticsOverview {
  allTime: boolean;
  monthsBack: number | null;
  startDate: string | null;
  endDate: string | null;
  trendGranularity: "month" | "year";
  summary: MonthlySummary;
  monthlyTotals: MonthlyTotalsStatistics;
  previousMonthSummary: MonthlySummary | null;
  trend: StatisticsTrendPoint[];
  categories: CategoryExpenseSummary[];
  topExpenses: TopExpense[];
  recurringExpenses: RecurringExpenseCandidate[];
}

export interface MonthlyTotalsStatistics {
  monthCount: number;
  averageIncome: number;
  medianIncome: number;
  averageExpense: number;
  medianExpense: number;
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
  | "Income"
  | "Housing & Utilities"
  | "Food & Groceries"
  | "Eating Out"
  | "Transport"
  | "Health & Insurance"
  | "Shopping & Personal"
  | "Leisure & Hobbies"
  | "Travel"
  | "Subscriptions & Services"
  | "Savings & Investments"
  | "Transfers & Adjustments"
  | "Other";

export interface RegionalTip {
  id: string;
  title: string;
  description: string;
  impact: "High" | "Medium" | "Low";
  category: RegionalTipCategory;
  reasoning: string;
  supportingSignals: string[];
}
