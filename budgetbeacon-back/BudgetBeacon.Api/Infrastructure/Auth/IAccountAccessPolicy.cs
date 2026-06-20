namespace BudgetBeacon.Api.Infrastructure.Auth;

public interface IAccountAccessPolicy
{
    string NormalizeEmail(string email);

    bool IsEmailAllowed(string? email);
}
