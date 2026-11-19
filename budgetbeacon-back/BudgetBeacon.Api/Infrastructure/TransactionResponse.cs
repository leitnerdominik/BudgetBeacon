using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Services;

namespace BudgetBeacon.Api.Infrastructure;

public sealed record TransactionResponse(
    Guid Id,
    string? UserId,
    DateTime Date,
    decimal Amount,
    string Category,
    string Treatment,
    string? Notes,
    string? ImportFingerprint,
    TransactionMetadata Metadata,
    string? SpendingFlexibilityOverride,
    string? SpendingFlexibility,
    string? SpendingFlexibilitySource,
    double? FlexibilityConfidence)
{
    public static TransactionResponse FromTransaction(
        Transaction transaction, IReadOnlyList<SpendingFlexibilityRule>? rules = null)
    {
        var (value, source, confidence) = SpendingFlexibilityResolver.Resolve(transaction, rules);
        return new TransactionResponse(
            transaction.Id,
            transaction.UserId,
            transaction.Date,
            transaction.Amount,
            transaction.Category,
            transaction.Treatment,
            transaction.Notes,
            transaction.ImportFingerprint,
            transaction.Metadata,
            transaction.ManualSpendingFlexibility?.ToString(),
            value,
            source,
            confidence);
    }
}
