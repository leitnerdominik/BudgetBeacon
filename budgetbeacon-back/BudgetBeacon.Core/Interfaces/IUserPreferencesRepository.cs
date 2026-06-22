using BudgetBeacon.Core.Models;

namespace BudgetBeacon.Core.Interfaces;

public interface IUserPreferencesRepository
{
    Task<UserPreferences?> GetAsync(string userId);
    Task<string?> GetAiLocationContextAsync(string userId);
    Task<UserPreferences?> UpdateAsync(
        string userId,
        string? aiLocationContext,
        IReadOnlyList<TransactionImportBlacklistRule>? transactionImportBlacklistRules);
}
