using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Models;
using BudgetBeacon.Core.Services;

namespace BudgetBeacon.Tests.Core;

public sealed class SpendingFlexibilityRuleTests
{
    [Theory]
    [InlineData("  CaFé\tHOUSE\u00a0\t42  ", "Essential")]
    [InlineData("COFFEE SHOP 42", "Optional")]
    [InlineData("COFFEE 42", "Optimizable")]
    [InlineData("OTHER COFFEE SHOP 42", null)]
    public void Resolve_PrefersExactThenLongestPrefixWithNormalizedDescription(string description, string? expected)
    {
        var transaction = new Transaction
        {
            UserId = "owner",
            Treatment = TransactionTreatment.Expense,
            Metadata = new TransactionMetadata { RawDescription = description }
        };
        SpendingFlexibilityRule[] rules = [
            new("other", SpendingFlexibilityRuleMatch.Exact, description, SpendingFlexibilityOverride.Unclassified),
            new("owner", SpendingFlexibilityRuleMatch.Prefix, "Coffee", SpendingFlexibilityOverride.Optimizable),
            new("owner", SpendingFlexibilityRuleMatch.Prefix, "Coffee Shop", SpendingFlexibilityOverride.Optional),
            new("owner", SpendingFlexibilityRuleMatch.Prefix, "café house 42", SpendingFlexibilityOverride.Optional),
            new("owner", SpendingFlexibilityRuleMatch.Exact, "Café House 42", SpendingFlexibilityOverride.Essential),
        ];

        var resolved = SpendingFlexibilityResolver.Resolve(transaction, rules);
        Assert.Equal((expected, expected is null ? "Unclassified" : "MerchantRule", null), resolved);
        Assert.Equal(resolved, SpendingFlexibilityResolver.Resolve(transaction, rules.Reverse().ToArray()));
    }

    [Theory]
    [InlineData(SpendingFlexibilityOverride.Essential, "Essential")]
    [InlineData(SpendingFlexibilityOverride.Unclassified, null)]
    public void Resolve_ManualValuesOverrideMatchingRuleAndAi(SpendingFlexibilityOverride manual, string? expected)
    {
        var expense = new Transaction
        {
            UserId = "owner",
            Treatment = TransactionTreatment.Expense,
            ManualSpendingFlexibility = manual,
            AiSpendingFlexibility = SpendingFlexibilityOverride.Optimizable,
            FlexibilityConfidence = 0.9,
            Metadata = new TransactionMetadata { RawDescription = "Groceries" }
        };
        SpendingFlexibilityRule[] rules = [
            new("owner", SpendingFlexibilityRuleMatch.Exact, "Groceries", SpendingFlexibilityOverride.Optional)
        ];

        Assert.Equal((expected, "Manual", null), SpendingFlexibilityResolver.Resolve(expense, rules));
    }

    [Theory]
    [InlineData(TransactionTreatment.Income)]
    [InlineData(TransactionTreatment.InternalTransfer)]
    [InlineData(TransactionTreatment.Refund)]
    public void Resolve_RulesApplyOnlyToExpenses(string treatment)
    {
        var transaction = new Transaction
        {
            UserId = "owner",
            Treatment = treatment,
            Metadata = new TransactionMetadata { RawDescription = "Groceries" }
        };
        SpendingFlexibilityRule[] rules = [
            new("owner", SpendingFlexibilityRuleMatch.Exact, "Groceries", SpendingFlexibilityOverride.Optional)
        ];

        Assert.Equal((null, null, null), SpendingFlexibilityResolver.Resolve(transaction, rules));
    }

    [Fact]
    public void Resolve_LegacyNullDescriptionFallsBackToCategoryDefault()
    {
        var expense = new Transaction
        {
            UserId = "owner",
            Category = "Food & Groceries",
            Treatment = TransactionTreatment.Expense,
            Metadata = new TransactionMetadata { RawDescription = null! }
        };
        SpendingFlexibilityRule[] rules = [
            new("owner", SpendingFlexibilityRuleMatch.Prefix, "Groceries", SpendingFlexibilityOverride.Essential)
        ];

        Assert.Equal(("Optimizable", "CategoryDefault", null), SpendingFlexibilityResolver.Resolve(expense, rules));
    }
}
