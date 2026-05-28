using PTSManagerYC.Core.Models;

namespace PTSManagerYC.Core.Interfaces;

public interface IUserPreferencesRepository
{
    Task<UserPreferences?> GetAsync(string userId);
    Task<string?> GetAiLocationContextAsync(string userId);
    Task<UserPreferences?> UpdateAsync(string userId, string? aiLocationContext);
}
