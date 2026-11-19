namespace BudgetBeacon.Core.Models;

public sealed record TransactionCategorization(
    Guid TransactionId,
    string Category,
    double Confidence,
    SpendingFlexibilityAssessment? Flexibility = null);

public sealed record SpendingFlexibilityAssessment(SpendingFlexibilityOverride Value, double Confidence);
