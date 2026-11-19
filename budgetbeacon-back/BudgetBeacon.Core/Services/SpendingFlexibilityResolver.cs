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

    public static (string? Value, string? Source, double? Confidence) Resolve(
        Transaction transaction, IReadOnlyList<SpendingFlexibilityRule>? rules = null)
    {
        if (transaction.EffectiveTreatment != TransactionTreatment.Expense)
            return (null, null, null);

        if (transaction.ManualSpendingFlexibility is { } manual)
            return (ToEffectiveValue(manual), "Manual", null);

        if (rules is { Count: > 0 } && FindMatchingRule(transaction, rules) is { } rule)
            return (ToEffectiveValue(rule.SpendingFlexibility), "MerchantRule", null);

        if (transaction.AiSpendingFlexibility is { } ai && transaction.FlexibilityConfidence is { } confidence)
            return (ai.ToString(), "Ai", confidence);

        return CategoryDefaults.TryGetValue(transaction.Category, out var categoryDefault)
            ? (categoryDefault, "CategoryDefault", null)
            : (null, "Unclassified", null);
    }

    private static string? ToEffectiveValue(SpendingFlexibilityOverride value) =>
        value == SpendingFlexibilityOverride.Unclassified ? null : value.ToString();

    private static SpendingFlexibilityRule? FindMatchingRule(
        Transaction transaction, IReadOnlyList<SpendingFlexibilityRule> rules)
    {
        var description = SpendingFlexibilityRule.NormalizeDescription(transaction.Metadata?.RawDescription);
        SpendingFlexibilityRule? longestPrefix = null;
        foreach (var rule in rules)
        {
            if (rule.UserId != transaction.UserId)
                continue;

            if (rule.MatchType == SpendingFlexibilityRuleMatch.Exact && rule.NormalizedPattern == description)
                return rule;

            if (rule.MatchType == SpendingFlexibilityRuleMatch.Prefix &&
                rule.NormalizedPattern.Length > (longestPrefix?.NormalizedPattern.Length ?? 0) &&
                description.StartsWith(rule.NormalizedPattern, StringComparison.Ordinal))
            {
                longestPrefix = rule;
            }
        }

        return longestPrefix;
    }
}
