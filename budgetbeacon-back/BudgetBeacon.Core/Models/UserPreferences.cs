namespace BudgetBeacon.Core.Models;

public sealed class UserPreferences
{
    public string? AiLocationContext { get; init; }
    public IReadOnlyList<TransactionImportBlacklistRule> TransactionImportBlacklistRules { get; init; } = [];
}
