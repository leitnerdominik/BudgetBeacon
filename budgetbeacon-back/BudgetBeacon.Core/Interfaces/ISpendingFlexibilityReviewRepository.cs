using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Models;

namespace BudgetBeacon.Core.Interfaces;

public interface ISpendingFlexibilityReviewRepository
{
    Task<IReadOnlyList<Guid>> GetReviewCandidateIdsAsync(string userId, CancellationToken cancellationToken);

    Task<IReadOnlyList<Transaction>> GetReviewCandidatesAsync(
        string userId, IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken);

    Task<SpendingFlexibilityReviewBatch> ApplySpendingFlexibilityReviewsAsync(
        string userId, IReadOnlyList<Transaction> originals, IReadOnlyList<SpendingFlexibilityReview> reviews,
        CancellationToken cancellationToken);
}
