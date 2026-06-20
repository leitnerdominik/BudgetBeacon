using Microsoft.Extensions.Options;

namespace BudgetBeacon.Api.Infrastructure.Auth;

public sealed class ConfiguredAccountAccessPolicy : IAccountAccessPolicy
{
    private readonly AccountAccessOptions _options;

    public ConfiguredAccountAccessPolicy(IOptions<AccountAccessOptions> options)
    {
        _options = options.Value;
    }

    public string NormalizeEmail(string email)
    {
        return email.Trim().ToLowerInvariant();
    }

    public bool IsEmailAllowed(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return false;
        }

        var normalizedEmail = NormalizeEmail(email);
        var allowedEmails = _options.AllowedEmails ?? Array.Empty<string>();

        return allowedEmails.Any(allowedEmail =>
            !string.IsNullOrWhiteSpace(allowedEmail) &&
            NormalizeEmail(allowedEmail) == normalizedEmail);
    }
}
