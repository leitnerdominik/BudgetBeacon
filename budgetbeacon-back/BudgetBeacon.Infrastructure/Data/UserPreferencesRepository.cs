using System.Text.RegularExpressions;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using BudgetBeacon.Core.Interfaces;
using BudgetBeacon.Core.Models;
using BudgetBeacon.Core.Services;

namespace BudgetBeacon.Infrastructure.Data;

public sealed partial class UserPreferencesRepository : IUserPreferencesRepository
{
    private const int MaxAiLocationContextLength = 120;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    private readonly BudgetBeaconDbContext _context;

    public UserPreferencesRepository(BudgetBeaconDbContext context)
    {
        _context = context;
    }

    public async Task<UserPreferences?> GetAsync(string userId)
    {
        var preferences = await _context.Users
            .Where(user => user.Id == userId)
            .Select(user => new
            {
                user.AiLocationContext,
                user.TransactionImportBlacklistRulesJson
            })
            .SingleOrDefaultAsync();

        return preferences is null
            ? null
            : new UserPreferences
            {
                AiLocationContext = preferences.AiLocationContext,
                TransactionImportBlacklistRules = DeserializeRules(
                    preferences.TransactionImportBlacklistRulesJson)
            };
    }

    public async Task<string?> GetAiLocationContextAsync(string userId)
    {
        return await _context.Users
            .Where(user => user.Id == userId)
            .Select(user => user.AiLocationContext)
            .SingleOrDefaultAsync();
    }

    public async Task<UserPreferences?> UpdateAsync(
        string userId,
        string? aiLocationContext,
        IReadOnlyList<TransactionImportBlacklistRule>? transactionImportBlacklistRules)
    {
        var user = await _context.Users.SingleOrDefaultAsync(candidate => candidate.Id == userId);

        if (user is null)
            return null;

        var normalizedRules = TransactionImportBlacklistRuleValidation
            .ValidateAndNormalize(transactionImportBlacklistRules)
            .Rules;

        user.AiLocationContext = NormalizeAiLocationContext(aiLocationContext);
        user.TransactionImportBlacklistRulesJson = JsonSerializer.Serialize(
            normalizedRules,
            JsonOptions);
        await _context.SaveChangesAsync();

        return new UserPreferences
        {
            AiLocationContext = user.AiLocationContext,
            TransactionImportBlacklistRules = normalizedRules
        };
    }

    private static IReadOnlyList<TransactionImportBlacklistRule> DeserializeRules(
        string? rulesJson)
    {
        if (string.IsNullOrWhiteSpace(rulesJson))
            return [];

        try
        {
            var rules = JsonSerializer.Deserialize<List<TransactionImportBlacklistRule>>(
                rulesJson,
                JsonOptions);

            return TransactionImportBlacklistRuleValidation
                .ValidateAndNormalize(rules)
                .Rules;
        }
        catch (JsonException)
        {
            return [];
        }
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
