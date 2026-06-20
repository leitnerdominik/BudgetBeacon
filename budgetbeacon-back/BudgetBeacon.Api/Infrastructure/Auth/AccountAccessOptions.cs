namespace BudgetBeacon.Api.Infrastructure.Auth;

public sealed class AccountAccessOptions
{
    public const string SectionName = "AccessControl";

    public string[] AllowedEmails { get; set; } = [];
}
