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

    public async Task<IReadOnlyList<SpendingFlexibilityRule>> GetAsync(
        string userId, CancellationToken cancellationToken) =>
        await context.SpendingFlexibilityRules.AsNoTracking()
            .Where(rule => rule.UserId == userId)
            .OrderBy(rule => rule.MatchType)
            .ThenBy(rule => rule.NormalizedPattern)
            .ToListAsync(cancellationToken);

    public async Task AddAsync(SpendingFlexibilityRule rule, CancellationToken cancellationToken)
    {
        context.SpendingFlexibilityRules.Add(rule);
        await SaveChangesAsync(context, cancellationToken);
    }

    public async Task<bool> UpdateAsync(
        Guid ruleId, SpendingFlexibilityRule rule, CancellationToken cancellationToken)
    {
        try
        {
            return await context.SpendingFlexibilityRules
                .Where(candidate => candidate.UserId == rule.UserId && candidate.Id == ruleId)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(candidate => candidate.MatchType, rule.MatchType)
                    .SetProperty(candidate => candidate.Pattern, rule.Pattern)
                    .SetProperty(candidate => candidate.NormalizedPattern, rule.NormalizedPattern)
                    .SetProperty(candidate => candidate.SpendingFlexibility, rule.SpendingFlexibility),
                    cancellationToken) > 0;
        }
        catch (PostgresException exception) when (IsDuplicateRule(exception))
        {
            throw new DuplicateSpendingFlexibilityRuleException();
        }
    }

    public async Task<bool> DeleteAsync(string userId, Guid ruleId, CancellationToken cancellationToken) =>
        await context.SpendingFlexibilityRules
            .Where(rule => rule.UserId == userId && rule.Id == ruleId)
            .ExecuteDeleteAsync(cancellationToken) > 0;

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
