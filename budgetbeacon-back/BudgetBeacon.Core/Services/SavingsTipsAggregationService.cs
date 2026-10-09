using BudgetBeacon.Core.Models;

namespace BudgetBeacon.Core.Services;

public static class SavingsTipsAggregationService
{
    public static SavingsTipsSummary BuildSummary(IEnumerable<SavingsTipsAggregateGroup> groups)
    {
        var aggregateGroups = groups.ToList();
        var expenses = aggregateGroups
            .Where(group =>
                (TransactionTreatment.Normalize(group.Treatment) ??
                 TransactionTreatment.GetDefault(group.IsPositive ? 1m : 0m, group.Category)) ==
                TransactionTreatment.Expense)
            .GroupBy(group => group.Category)
            .Select(group => new SavingsTipsCategoryTotal(
                group.Key,
                Math.Abs(group.Sum(item => item.AmountSum))))
            .OrderByDescending(category => category.TotalSpent)
            .ThenBy(category => category.Category, StringComparer.Ordinal)
            .ToList();

        return new SavingsTipsSummary(
            aggregateGroups.Sum(group => group.TransactionCount),
            expenses);
    }
}
