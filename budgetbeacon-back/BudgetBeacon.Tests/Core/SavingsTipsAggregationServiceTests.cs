using BudgetBeacon.Core.Models;
using BudgetBeacon.Core.Services;

namespace BudgetBeacon.Tests.Core;

public sealed class SavingsTipsAggregationServiceTests
{
    [Fact]
    public void BuildSummary_PreservesTreatmentFallbackAndCountsExcludedTransactions()
    {
        var summary = SavingsTipsAggregationService.BuildSummary(
        [
            new("Groceries", " expense ", false, 2, -12.34m),
            new("Groceries", "Expense", true, 1, 4m),
            new("Groceries", "Refund", true, 1, 8m),
            new("Income", null, false, 1, -20m),
            new("Other", "invalid", true, 1, 30m),
            new("Transfers & Adjustments", "", false, 1, -40m),
            new("Savings & Investments", null, false, 1, -50m),
            new("Other", "Adjustment", false, 1, -60m),
            new("Fallback", "invalid", false, 1, -8.34m),
            new("Zero", "", false, 1, 0m),
            new("Override", "EXPENSE", true, 1, 2.50m),
            new("Other", "Income", false, 1, -70m)
        ]);

        Assert.Equal(13, summary.TransactionCount);
        Assert.Equal(
            [new("Fallback", 8.34m), new("Groceries", 8.34m), new("Override", 2.50m), new("Zero", 0m)],
            summary.ExpensesByCategory);
    }

    [Fact]
    public void BuildSummary_AppliesAbsoluteValueAfterCombiningSignedExpenseGroups()
    {
        var summary = SavingsTipsAggregationService.BuildSummary(
        [
            new("Mixed", "Expense", false, 1, -10m),
            new("Mixed", "Expense", true, 1, 15m),
            new("Cancelled", "Expense", false, 1, -5m),
            new("Cancelled", "Expense", true, 1, 5m)
        ]);

        Assert.Equal([new("Mixed", 5m), new("Cancelled", 0m)], summary.ExpensesByCategory);
    }

    [Fact]
    public void BuildSummary_HandlesEmptyAndIncomeOnlyData()
    {
        var empty = SavingsTipsAggregationService.BuildSummary([]);
        Assert.Equal(0, empty.TransactionCount);
        Assert.Empty(empty.ExpensesByCategory);

        var incomeOnly = SavingsTipsAggregationService.BuildSummary(
            [new("Income", "Income", true, 10001, 12345.67m)]);
        Assert.Equal(10001, incomeOnly.TransactionCount);
        Assert.Empty(incomeOnly.ExpensesByCategory);
    }
}
