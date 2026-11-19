namespace BudgetBeacon.Core.Models;

public sealed record TransactionCategorizationResult
{
    public TransactionCategorizationResult(
        int processedCount,
        IReadOnlyList<TransactionCategorization> suggestions,
        int remainingCount)
    {
        if (suggestions.Count > processedCount ||
            remainingCount < 0 || remainingCount > processedCount)
        {
            throw new ArgumentOutOfRangeException(
                nameof(processedCount),
                "Categorization result counts are inconsistent.");
        }

        ProcessedCount = processedCount;
        Suggestions = suggestions;
        RemainingCount = remainingCount;
    }

    public int ProcessedCount { get; }
    public IReadOnlyList<TransactionCategorization> Suggestions { get; }
    public int ChangedCount => Suggestions.Count;
    public int FailedCount => ProcessedCount - Suggestions.Count;
    public int RemainingCount { get; }

    public static TransactionCategorizationResult Empty { get; } = new(0, [], 0);
}
