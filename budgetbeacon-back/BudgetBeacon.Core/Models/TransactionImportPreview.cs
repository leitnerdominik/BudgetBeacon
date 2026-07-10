using BudgetBeacon.Core.Entities;

namespace BudgetBeacon.Core.Models;

public enum TransactionImportDuplicateReason
{
    ExistingDuplicate,
    FileDuplicate
}

public sealed record TransactionImportPreviewItem(
    Transaction Transaction,
    bool DescriptionRedacted,
    TransactionImportDuplicateReason? DuplicateReason)
{
    public bool WillImport => DuplicateReason is null;
}

public sealed record TransactionImportPreviewResult(
    int TotalParsed,
    int Importable,
    int ExistingDuplicates,
    int FileDuplicates,
    int RedactedTransactions,
    IReadOnlyList<TransactionImportPreviewItem> Transactions)
{
    public int DuplicatesSkipped => ExistingDuplicates + FileDuplicates;
}

public sealed record TransactionImportResult(
    int TotalParsed,
    int Imported,
    int DuplicatesSkipped,
    int RedactedTransactions);
