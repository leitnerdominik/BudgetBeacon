namespace BudgetBeacon.Core.Models;

public sealed record StatisticsOverview(
    bool AllTime,
    int? MonthsBack,
    DateTime? StartDate,
    DateTime? EndDate,
    string TrendGranularity,
    StatisticsSummary Summary,
    StatisticsSummary? PreviousMonthSummary,
    IReadOnlyList<StatisticsTrendPoint> Trend,
    IReadOnlyList<StatisticsCategorySummary> Categories,
    IReadOnlyList<StatisticsTopExpense> TopExpenses,
    IReadOnlyList<StatisticsRecurringExpense> RecurringExpenses);

public sealed record StatisticsSummary(
    decimal TotalIncome,
    decimal TotalExpense,
    decimal NetBalance,
    decimal AverageExpense,
    decimal MedianExpense,
    int TransactionCount);

public sealed record MonthlySummary(
    int Year,
    int Month,
    decimal TotalIncome,
    decimal TotalExpense,
    decimal NetBalance,
    decimal AverageExpense,
    decimal MedianExpense,
    int TransactionCount);

public sealed record StatisticsTrendPoint(
    int Year,
    int? Month,
    decimal TotalIncome,
    decimal TotalExpense,
    decimal NetBalance,
    int TransactionCount);

public sealed record StatisticsCategorySummary(
    string Category,
    decimal TotalExpense,
    decimal Percentage,
    int TransactionCount);

public sealed record StatisticsTopExpense(
    Guid Id,
    DateTime Date,
    decimal Amount,
    string Category,
    string Description);

public sealed record StatisticsRecurringExpense(
    string Description,
    string Category,
    decimal AverageAmount,
    decimal MinAmount,
    decimal MaxAmount,
    int OccurrenceCount,
    int MonthCount,
    DateTime LastDate);
