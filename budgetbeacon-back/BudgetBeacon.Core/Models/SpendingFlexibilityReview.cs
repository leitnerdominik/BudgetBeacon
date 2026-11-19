namespace BudgetBeacon.Core.Models;

// A result with no assessment is an explicit abstention. A missing result is retryable.
public sealed record SpendingFlexibilityReview(Guid TransactionId, SpendingFlexibilityAssessment? Assessment);

public sealed record SpendingFlexibilityReviewBatch(
    int ClassifiedCount, int UnclassifiedCount, int FailedCount, int SkippedCount);
