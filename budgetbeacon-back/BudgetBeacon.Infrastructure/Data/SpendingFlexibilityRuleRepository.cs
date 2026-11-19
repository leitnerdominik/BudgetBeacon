using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Exceptions;
using BudgetBeacon.Core.Interfaces;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace BudgetBeacon.Infrastructure.Data;

public sealed class SpendingFlexibilityRuleRepository(BudgetBeaconDbContext context)
    : ISpendingFlexibilityRuleRepository
{
    internal const string UniquePatternIndex = "IX_SpendingFlexibilityRules_UserId_MatchType_NormalizedPattern";

    // Use the same owner lock for rule mutations and the review's final eligibility check.
    internal static Task LockUserRulesAsync(
        BudgetBeaconDbContext context, string userId, CancellationToken cancellationToken) =>
        context.Database.ExecuteSqlAsync($"""
            SELECT pg_advisory_xact_lock(hashtextextended({userId}, 632550489))
            """, cancellationToken);

    public Task<IReadOnlyList<SpendingFlexibilityRule>> GetAsync(
        string userId, CancellationToken cancellationToken) =>
        GetForUserAsync(context, userId, cancellationToken);

    internal static async Task<IReadOnlyList<SpendingFlexibilityRule>> GetForUserAsync(
        BudgetBeaconDbContext context, string userId, CancellationToken cancellationToken) =>
        await context.SpendingFlexibilityRules.AsNoTracking()
            .Where(rule => rule.UserId == userId)
            .OrderBy(rule => rule.MatchType)
            .ThenBy(rule => rule.NormalizedPattern)
            .ToListAsync(cancellationToken);

    public async Task AddAsync(SpendingFlexibilityRule rule, CancellationToken cancellationToken)
    {
        await using var operation = await context.Database.BeginTransactionAsync(cancellationToken);
        await LockUserRulesAsync(context, rule.UserId, cancellationToken);
        context.SpendingFlexibilityRules.Add(rule);
        await SaveChangesAsync(context, cancellationToken);
        await operation.CommitAsync(cancellationToken);
    }

    public async Task<bool> UpdateAsync(
        Guid ruleId, SpendingFlexibilityRule rule, CancellationToken cancellationToken)
    {
        try
        {
            await using var operation = await context.Database.BeginTransactionAsync(cancellationToken);
            await LockUserRulesAsync(context, rule.UserId, cancellationToken);
            var updated = await context.SpendingFlexibilityRules
                .Where(candidate => candidate.UserId == rule.UserId && candidate.Id == ruleId)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(candidate => candidate.MatchType, rule.MatchType)
                    .SetProperty(candidate => candidate.Pattern, rule.Pattern)
                    .SetProperty(candidate => candidate.NormalizedPattern, rule.NormalizedPattern)
                    .SetProperty(candidate => candidate.SpendingFlexibility, rule.SpendingFlexibility),
                    cancellationToken);
            await operation.CommitAsync(cancellationToken);
            return updated > 0;
        }
        catch (PostgresException exception) when (IsDuplicateRule(exception))
        {
            throw new DuplicateSpendingFlexibilityRuleException();
        }
    }

    public async Task<bool> DeleteAsync(string userId, Guid ruleId, CancellationToken cancellationToken)
    {
        await using var operation = await context.Database.BeginTransactionAsync(cancellationToken);
        await LockUserRulesAsync(context, userId, cancellationToken);
        var deleted = await context.SpendingFlexibilityRules
            .Where(rule => rule.UserId == userId && rule.Id == ruleId)
            .ExecuteDeleteAsync(cancellationToken);
        await operation.CommitAsync(cancellationToken);
        return deleted > 0;
    }

    // Also used when a manual transaction and its optional rule are persisted together.
    internal static async Task SaveChangesAsync(
        BudgetBeaconDbContext context, CancellationToken cancellationToken)
    {
        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsDuplicateRule(exception.InnerException))
        {
            throw new DuplicateSpendingFlexibilityRuleException();
        }
    }

    private static bool IsDuplicateRule(Exception? exception) =>
        exception is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation,
            ConstraintName: UniquePatternIndex
        };
}
