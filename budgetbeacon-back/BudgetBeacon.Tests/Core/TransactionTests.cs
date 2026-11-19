using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Models;
using BudgetBeacon.Core.Services;

namespace BudgetBeacon.Tests.Core;

public sealed class TransactionTests
{
    [Fact]
    public void ApplyUpdate_ResetsAiMetadataWhenDescriptionOrCategoryChanges()
    {
        var transaction = CreateTransaction();

        transaction.ApplyUpdate(new TransactionUpdate
        {
            Date = transaction.Date,
            Amount = transaction.Amount,
            Description = "Updated market",
            Category = "Shopping & Personal",
            Notes = transaction.Notes
        });

        Assert.Null(transaction.Metadata.AiSuggestedCategory);
        Assert.Null(transaction.Metadata.AiConfidenceScore);
    }

    [Fact]
    public void ApplyUpdate_KeepsAiMetadataAndImportFingerprintForOtherChanges()
    {
        var transaction = CreateTransaction();
        var fingerprint = transaction.ImportFingerprint;

        transaction.ApplyUpdate(new TransactionUpdate
        {
            Date = new DateTime(2026, 6, 4, 0, 0, 0, DateTimeKind.Utc),
            Amount = -20m,
            Description = transaction.Metadata.RawDescription,
            Category = transaction.Category,
            Notes = "Updated note"
        });

        Assert.Equal("Food & Groceries", transaction.Metadata.AiSuggestedCategory);
        Assert.Equal(0.91, transaction.Metadata.AiConfidenceScore);
        Assert.Equal(fingerprint, transaction.ImportFingerprint);
    }

    [Theory]
    [InlineData("A new merchant", "Food & Groceries", TransactionTreatment.Expense, -10, false)]
    [InlineData("Market", "Transport", TransactionTreatment.Expense, -10, false)]
    [InlineData("Market", "Food & Groceries", TransactionTreatment.Refund, -10, false)]
    [InlineData("Market", "Food & Groceries", TransactionTreatment.Expense, -20, false)]
    [InlineData("Market", "Food & Groceries", TransactionTreatment.Expense, -10, true)]
    public void ApplyUpdate_OnlyRetainsAiFlexibilityForUnchangedBasis(
        string description, string category, string treatment, int amount, bool retained)
    {
        var transaction = CreateTransaction();
        transaction.ManualSpendingFlexibility = SpendingFlexibilityOverride.Unclassified;

        transaction.ApplyUpdate(new TransactionUpdate
        {
            Date = transaction.Date.AddDays(1),
            Amount = amount,
            Description = description,
            Category = category,
            Treatment = treatment,
            Notes = "Updated note"
        });

        Assert.Equal(retained ? SpendingFlexibilityOverride.Essential : null, transaction.AiSpendingFlexibility);
        Assert.Equal(retained ? 0.8 : null, transaction.FlexibilityConfidence);
        Assert.Equal(SpendingFlexibilityOverride.Unclassified, transaction.ManualSpendingFlexibility);
    }

    [Fact]
    public void ApplyCategoryUpdate_ClearsAiFlexibilityWithChangedCategory()
    {
        var transaction = CreateTransaction();

        transaction.ApplyCategoryUpdate("Eating Out");

        Assert.Null(transaction.AiSpendingFlexibility);
        Assert.Null(transaction.FlexibilityConfidence);
        Assert.Equal(("Optional", "CategoryDefault", null), SpendingFlexibilityResolver.Resolve(transaction));
    }

    [Fact]
    public void MatchesCategorizationBasis_RejectsAnyChangeAffectingTheSuggestionOrManualDecision()
    {
        var original = CreateTransaction();
        var current = CreateTransaction();
        current.Date = original.Date.AddDays(2);
        current.Notes = "New note";
        current.Treatment = TransactionTreatment.Expense;
        Assert.True(current.MatchesCategorizationBasis(original));

        current.ManualSpendingFlexibility = SpendingFlexibilityOverride.Unclassified;
        Assert.False(current.MatchesCategorizationBasis(original));
        current.ManualSpendingFlexibility = null;
        current.Treatment = TransactionTreatment.InternalTransfer;
        Assert.False(current.MatchesCategorizationBasis(original));
        current.Treatment = TransactionTreatment.Expense;
        current.Amount = -100m;
        Assert.False(current.MatchesCategorizationBasis(original));
        current.Amount = original.Amount;
        current.Category = "Eating Out";
        Assert.False(current.MatchesCategorizationBasis(original));
        current.Category = original.Category;
        current.Metadata.RawDescription = "New purchase";
        Assert.False(current.MatchesCategorizationBasis(original));
    }

    [Theory]
    [InlineData(SpendingFlexibilityOverride.Essential, "Essential")]
    [InlineData(SpendingFlexibilityOverride.Unclassified, null)]
    public void ApplyCategorization_KeepsManualOverrideAndClearsOldSuggestionOnAbstention(
        SpendingFlexibilityOverride manual, string? effectiveClass)
    {
        var transaction = CreateTransaction();
        transaction.ManualSpendingFlexibility = manual;
        transaction.Treatment = TransactionTreatment.Refund;
        var proposal = new TransactionCategorization(
            transaction.Id, "Eating Out", 0.9, new(SpendingFlexibilityOverride.Optional, 0.56));

        transaction.ApplyCategorization(proposal);

        Assert.Equal(TransactionTreatment.Expense, transaction.Treatment);
        Assert.Equal((effectiveClass, "Manual", null), SpendingFlexibilityResolver.Resolve(transaction));
        Assert.Equal(SpendingFlexibilityOverride.Optional, transaction.AiSpendingFlexibility);

        transaction.ApplyCategorization(proposal with { Flexibility = null });
        Assert.Null(transaction.AiSpendingFlexibility);
        Assert.Null(transaction.FlexibilityConfidence);
        Assert.Equal((effectiveClass, "Manual", null), SpendingFlexibilityResolver.Resolve(transaction));

        transaction.ManualSpendingFlexibility = null;
        Assert.Equal(("Optional", "CategoryDefault", null), SpendingFlexibilityResolver.Resolve(transaction));
        transaction.ApplyCategorization(proposal with { Category = "Health & Insurance", Flexibility = null });
        Assert.Equal((null, "Unclassified", null), SpendingFlexibilityResolver.Resolve(transaction));
    }

    [Theory]
    [InlineData("Income", TransactionTreatment.Income)]
    [InlineData("Transfers & Adjustments", TransactionTreatment.InternalTransfer)]
    [InlineData("Savings & Investments", TransactionTreatment.SavingsInvestment)]
    public void ApplyCategorization_IgnoresFlexibilityForNonExpense(string category, string treatment)
    {
        var transaction = CreateTransaction();
        transaction.ApplyCategorization(new TransactionCategorization(
            transaction.Id, category, 0.99, new(SpendingFlexibilityOverride.Essential, 0.95)));

        Assert.Equal(treatment, transaction.Treatment);
        Assert.Equal(category, transaction.Metadata.AiSuggestedCategory);
        Assert.Null(transaction.AiSpendingFlexibility);
        Assert.Null(transaction.FlexibilityConfidence);
        Assert.Equal((null, null, null), SpendingFlexibilityResolver.Resolve(transaction));
    }

    private static Transaction CreateTransaction() =>
        new()
        {
            Date = new DateTime(2026, 5, 1, 0, 0, 0, DateTimeKind.Utc),
            Amount = -10m,
            Category = "Food & Groceries",
            AiSpendingFlexibility = SpendingFlexibilityOverride.Essential,
            FlexibilityConfidence = 0.8,
            Notes = "Old note",
            ImportFingerprint = new string('A', 64),
            Metadata = new TransactionMetadata
            {
                RawDescription = "Market",
                AiSuggestedCategory = "Food & Groceries",
                AiConfidenceScore = 0.91
            }
        };
}
