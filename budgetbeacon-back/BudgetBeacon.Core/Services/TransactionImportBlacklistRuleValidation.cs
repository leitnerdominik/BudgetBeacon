using System.Text.RegularExpressions;
using BudgetBeacon.Core.Models;

namespace BudgetBeacon.Core.Services;

public static partial class TransactionImportBlacklistRuleValidation
{
    public const int MaxRuleCount = 50;
    public const int MaxRuleValueLength = 200;

    private static readonly TimeSpan RegexTimeout = TimeSpan.FromMilliseconds(100);

    public static TransactionImportBlacklistRuleValidationResult ValidateAndNormalize(
        IEnumerable<TransactionImportBlacklistRule>? rules)
    {
        var normalizedRules = new List<TransactionImportBlacklistRule>();
        var errors = new Dictionary<string, List<string>>();

        foreach (var indexedRule in (rules ?? []).Select((rule, index) => (rule, index)))
        {
            var type = (indexedRule.rule.Type ?? string.Empty).Trim().ToLowerInvariant();
            var value = WhitespaceRegex().Replace(indexedRule.rule.Value ?? string.Empty, " ").Trim();

            if (string.IsNullOrWhiteSpace(value))
            {
                continue;
            }

            if (!TransactionImportBlacklistRule.IsSupportedType(type))
            {
                AddError(
                    errors,
                    $"TransactionImportBlacklistRules[{indexedRule.index}].Type",
                    "Rule type must be literal or regex.");
                continue;
            }

            if (value.Length > MaxRuleValueLength)
            {
                AddError(
                    errors,
                    $"TransactionImportBlacklistRules[{indexedRule.index}].Value",
                    $"Rule value must be {MaxRuleValueLength} characters or fewer.");
                continue;
            }

            if (normalizedRules.Count >= MaxRuleCount)
            {
                AddError(
                    errors,
                    nameof(UserPreferences.TransactionImportBlacklistRules),
                    $"No more than {MaxRuleCount} import blacklist rules are allowed.");
                continue;
            }

            if (string.Equals(type, TransactionImportBlacklistRule.RegexType, StringComparison.Ordinal))
            {
                try
                {
                    _ = new Regex(
                        value,
                        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant,
                        RegexTimeout);
                }
                catch (ArgumentException)
                {
                    AddError(
                        errors,
                        $"TransactionImportBlacklistRules[{indexedRule.index}].Value",
                        "Regex rule is not valid.");
                    continue;
                }
            }

            normalizedRules.Add(new TransactionImportBlacklistRule
            {
                Type = type,
                Value = value
            });
        }

        return new TransactionImportBlacklistRuleValidationResult(
            normalizedRules,
            errors.ToDictionary(
                entry => entry.Key,
                entry => (IReadOnlyList<string>)entry.Value));
    }

    private static void AddError(
        Dictionary<string, List<string>> errors,
        string key,
        string message)
    {
        if (!errors.TryGetValue(key, out var messages))
        {
            messages = [];
            errors[key] = messages;
        }

        messages.Add(message);
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRegex();
}

public sealed record TransactionImportBlacklistRuleValidationResult(
    IReadOnlyList<TransactionImportBlacklistRule> Rules,
    IReadOnlyDictionary<string, IReadOnlyList<string>> Errors)
{
    public bool IsValid => Errors.Count == 0;
}
