namespace BudgetBeacon.Infrastructure.Data;

public sealed class UserSettings
{
    public string UserId { get; set; } = string.Empty;
    public string? AiLocationContext { get; set; }
    public string TransactionImportBlacklistRulesJson { get; set; } = "[]";
    public ApplicationUser User { get; set; } = null!;
}
