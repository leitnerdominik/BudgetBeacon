using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using BudgetBeacon.Core.Interfaces;
using BudgetBeacon.Core.Models;

namespace BudgetBeacon.Infrastructure.Data;

public sealed partial class UserPreferencesRepository : IUserPreferencesRepository
{
    private const int MaxAiLocationContextLength = 120;
    private readonly BudgetBeaconDbContext _context;

    public UserPreferencesRepository(BudgetBeaconDbContext context)
    {
        _context = context;
    }

    public async Task<UserPreferences?> GetAsync(string userId)
    {
        return await _context.Users
            .Where(user => user.Id == userId)
            .Select(user => new UserPreferences
            {
                AiLocationContext = user.AiLocationContext
            })
            .SingleOrDefaultAsync();
    }

    public async Task<string?> GetAiLocationContextAsync(string userId)
    {
        return await _context.Users
            .Where(user => user.Id == userId)
            .Select(user => user.AiLocationContext)
            .SingleOrDefaultAsync();
    }

    public async Task<UserPreferences?> UpdateAsync(string userId, string? aiLocationContext)
    {
        var user = await _context.Users.SingleOrDefaultAsync(candidate => candidate.Id == userId);

        if (user is null)
            return null;

        user.AiLocationContext = NormalizeAiLocationContext(aiLocationContext);
        await _context.SaveChangesAsync();

        return new UserPreferences
        {
            AiLocationContext = user.AiLocationContext
        };
    }

    private static string? NormalizeAiLocationContext(string? value)
    {
        var normalized = WhitespaceRegex().Replace(value ?? string.Empty, " ").Trim();

        if (string.IsNullOrWhiteSpace(normalized))
            return null;

        return normalized.Length <= MaxAiLocationContextLength
            ? normalized
            : normalized[..MaxAiLocationContextLength].TrimEnd();
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRegex();
}
