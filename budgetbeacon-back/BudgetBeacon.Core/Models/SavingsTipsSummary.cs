namespace BudgetBeacon.Core.Models;

public sealed record SavingsTipsSummary(
    long TransactionCount,
    IReadOnlyList<SavingsTipsCategoryTotal> ExpensesByCategory);

public sealed record SavingsTipsCategoryTotal(string Category, decimal TotalSpent);

public sealed record SavingsTipsAggregateGroup(
    string Category,
    string? Treatment,
    bool IsPositive,
    long TransactionCount,
    decimal AmountSum);
