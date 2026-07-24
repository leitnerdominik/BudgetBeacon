namespace BudgetBeacon.Core.Models;

public sealed record TransactionCategorizationResult
{
    public TransactionCategorizationResult(
        int processedCount,
        int changedCount,
        int failedCount,
        int remainingCount)
    {
        if (processedCount < 0 ||
            changedCount < 0 ||
            failedCount < 0 ||
            remainingCount < 0 ||
            changedCount + failedCount != processedCount ||
            remainingCount > processedCount)
        {
            throw new ArgumentOutOfRangeException(
                nameof(processedCount),
                "Categorization result counts are inconsistent.");
        }

        ProcessedCount = processedCount;
        ChangedCount = changedCount;
        FailedCount = failedCount;
        RemainingCount = remainingCount;
    }

    public int ProcessedCount { get; }
    public int ChangedCount { get; }
    public int FailedCount { get; }
    public int RemainingCount { get; }

    public static TransactionCategorizationResult Empty { get; } = new(0, 0, 0, 0);
}
