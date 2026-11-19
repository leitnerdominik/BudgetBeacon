using BudgetBeacon.Core.Entities;

namespace BudgetBeacon.Core.Interfaces;

public interface ISpendingFlexibilityRuleRepository
{
    Task<IReadOnlyList<SpendingFlexibilityRule>> GetAsync(string userId, CancellationToken cancellationToken);
    Task AddAsync(SpendingFlexibilityRule rule, CancellationToken cancellationToken);
    Task<bool> UpdateAsync(Guid ruleId, SpendingFlexibilityRule rule, CancellationToken cancellationToken);
    Task<bool> DeleteAsync(string userId, Guid ruleId, CancellationToken cancellationToken);
}
