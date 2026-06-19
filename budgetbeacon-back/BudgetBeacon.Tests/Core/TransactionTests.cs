using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Models;

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
            Category = "Lifestyle",
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

        Assert.Equal("Groceries", transaction.Metadata.AiSuggestedCategory);
        Assert.Equal(0.91, transaction.Metadata.AiConfidenceScore);
        Assert.Equal(fingerprint, transaction.ImportFingerprint);
    }

    private static Transaction CreateTransaction() =>
        new()
        {
            Date = new DateTime(2026, 5, 1, 0, 0, 0, DateTimeKind.Utc),
            Amount = -10m,
            Category = "Groceries",
            Notes = "Old note",
            ImportFingerprint = new string('A', 64),
            Metadata = new TransactionMetadata
            {
                RawDescription = "Market",
                AiSuggestedCategory = "Groceries",
                AiConfidenceScore = 0.91
            }
        };
}
