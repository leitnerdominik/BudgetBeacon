using System.Collections.Concurrent;
using BudgetBeacon.Core.Interfaces;
using BudgetBeacon.Core.Models;

namespace BudgetBeacon.Core.Services;

public sealed class SpendingFlexibilityReviewService(
    ISpendingFlexibilityReviewRepository repository, IAiAdvisorService aiAdvisor)
{
    public const int MaxBatchSize = 10;

    // Limit in-flight provider work per user. The database recheck also protects writes across instances.
    private static readonly ConcurrentDictionary<string, byte> ActiveUsers = new();

    public async Task<SpendingFlexibilityReviewBatch?> TryReviewBatchAsync(
        string userId, IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken)
    {
        if (!ActiveUsers.TryAdd(userId, 0))
            return null;

        try
        {
            var candidates = await repository.GetReviewCandidatesAsync(userId, ids, cancellationToken);
            if (candidates.Count == 0)
                return new SpendingFlexibilityReviewBatch(0, 0, 0, ids.Count);

            var reviews = await aiAdvisor.ReviewSpendingFlexibilityAsync(candidates, cancellationToken);
            cancellationToken.ThrowIfCancellationRequested();
            var applied = await repository.ApplySpendingFlexibilityReviewsAsync(
                userId, candidates, reviews, cancellationToken);
            return applied with { SkippedCount = applied.SkippedCount + ids.Count - candidates.Count };
        }
        finally
        {
            ActiveUsers.TryRemove(userId, out _);
        }
    }
}
