using System.Text.RegularExpressions;
using BudgetBeacon.Core.Models;

namespace BudgetBeacon.Core.Entities;

public enum SpendingFlexibilityRuleMatch
{
    Exact,
    Prefix
}

public sealed partial class SpendingFlexibilityRule
{
    public const int MaxPatternLength = 500;

    public Guid Id { get; init; } = Guid.NewGuid();
    public string UserId { get; private set; }
    public SpendingFlexibilityRuleMatch MatchType { get; private set; }
    public string Pattern { get; private set; }
    public string NormalizedPattern { get; private set; }
    public SpendingFlexibilityOverride SpendingFlexibility { get; private set; }

    public SpendingFlexibilityRule(
        string userId,
        SpendingFlexibilityRuleMatch matchType,
        string pattern,
        SpendingFlexibilityOverride spendingFlexibility)
    {
        UserId = userId;
        MatchType = matchType;
        Pattern = NormalizeWhitespace(pattern);
        NormalizedPattern = Pattern.ToUpperInvariant();
        SpendingFlexibility = spendingFlexibility;
    }

    public static string NormalizeDescription(string? description) =>
        description is null ? string.Empty : NormalizeWhitespace(description).ToUpperInvariant();

    private static string NormalizeWhitespace(string value) => Whitespace().Replace(value, " ").Trim();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();
}
