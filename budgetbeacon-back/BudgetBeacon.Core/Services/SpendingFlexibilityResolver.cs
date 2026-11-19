using System.Collections.ObjectModel;
using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Models;

namespace BudgetBeacon.Core.Services;

public static class SpendingFlexibilityResolver
{
    public static IReadOnlyDictionary<string, string> CategoryDefaults { get; } =
        new ReadOnlyDictionary<string, string>(new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Food & Groceries"] = nameof(SpendingFlexibilityOverride.Optimizable),
            ["Eating Out"] = nameof(SpendingFlexibilityOverride.Optional),
            ["Leisure & Hobbies"] = nameof(SpendingFlexibilityOverride.Optional)
        });

    public static (string? Value, string? Source, double? Confidence) Resolve(Transaction transaction)
    {
        if (transaction.EffectiveTreatment != TransactionTreatment.Expense)
            return (null, null, null);

        if (transaction.ManualSpendingFlexibility is { } manual)
            return (manual == SpendingFlexibilityOverride.Unclassified ? null : manual.ToString(), "Manual", null);

        if (transaction.AiSpendingFlexibility is { } ai && transaction.FlexibilityConfidence is { } confidence)
            return (ai.ToString(), "Ai", confidence);

        return CategoryDefaults.TryGetValue(transaction.Category, out var categoryDefault)
            ? (categoryDefault, "CategoryDefault", null)
            : (null, "Unclassified", null);
    }
}
