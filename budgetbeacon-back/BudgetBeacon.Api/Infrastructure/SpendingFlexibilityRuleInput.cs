using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Models;

namespace BudgetBeacon.Api.Infrastructure;

public sealed record SpendingFlexibilityRuleInput(string? MatchType, string? Pattern)
{
    internal (string Field, string Message)? Validate(
        string userId, SpendingFlexibilityOverride? value, out SpendingFlexibilityRule? rule)
    {
        rule = null;
        if (value is null)
            return ("SpendingFlexibilityOverride", "Choose a manual financial flexibility value to save as a rule.");

        if (!Enum.TryParse<SpendingFlexibilityRuleMatch>(MatchType, out var match) ||
            !Enum.IsDefined(match) ||
            match.ToString() != MatchType)
        {
            return (nameof(MatchType), "Match type must be Exact or Prefix.");
        }

        if (string.IsNullOrWhiteSpace(Pattern) ||
            Pattern.Length > SpendingFlexibilityRule.MaxPatternLength ||
            Pattern.Any(character => char.IsControl(character) && !char.IsWhiteSpace(character)))
        {
            return (nameof(Pattern), $"Enter a description of 1 to {SpendingFlexibilityRule.MaxPatternLength} characters.");
        }

        rule = new SpendingFlexibilityRule(userId, match, Pattern, value.Value);
        return null;
    }

    internal static SpendingFlexibilityOverride? ParseClass(string? value) =>
        Enum.TryParse<SpendingFlexibilityOverride>(value, out var parsed) &&
        Enum.IsDefined(parsed) &&
        parsed.ToString() == value
            ? parsed
            : null;
}
