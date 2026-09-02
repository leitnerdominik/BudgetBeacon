using BudgetBeacon.Core.Interfaces;
using Microsoft.AspNetCore.Identity;

namespace BudgetBeacon.Infrastructure.Data;

public sealed class DevelopmentDataSeeder
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ITransactionRepository _transactionRepository;

    public DevelopmentDataSeeder(
        UserManager<ApplicationUser> userManager,
        ITransactionRepository transactionRepository)
    {
        _userManager = userManager;
        _transactionRepository = transactionRepository;
    }

    public async Task<DevelopmentSeedResult> SeedAsync(
        DevelopmentSeedOptions options,
        DateTime utcNow)
    {
        ArgumentNullException.ThrowIfNull(options);

        if (!options.Enabled)
        {
            return new DevelopmentSeedResult(
                Skipped: true,
                AccountCreated: false,
                TransactionsInserted: 0);
        }

        var email = RequireValue(options.Email, "DevelopmentSeed:Email")
            .ToLowerInvariant();
        var user = await _userManager.FindByEmailAsync(email);
        var accountCreated = false;

        if (user is null)
        {
            var firstName = RequireValue(options.FirstName, "DevelopmentSeed:FirstName");
            var lastName = RequireValue(options.LastName, "DevelopmentSeed:LastName");
            var password = RequireValue(options.Password, "DevelopmentSeed:Password");

            user = new ApplicationUser
            {
                UserName = email,
                Email = email,
                FirstName = firstName,
                LastName = lastName
            };

            var createResult = await _userManager.CreateAsync(user, password);

            if (!createResult.Succeeded)
            {
                var errors = string.Join(
                    "; ",
                    createResult.Errors.Select(error => $"{error.Code}: {error.Description}"));
                throw new InvalidOperationException(
                    $"The development seed account could not be created. {errors}");
            }

            accountCreated = true;
        }

        var transactions = DevelopmentSeedTransactionFactory.CreateTransactions(user.Id, utcNow);
        var transactionsInserted = await _transactionRepository
            .AddImportedTransactionsAsync(transactions);

        return new DevelopmentSeedResult(
            Skipped: false,
            AccountCreated: accountCreated,
            TransactionsInserted: transactionsInserted);
    }

    private static string RequireValue(string? value, string configurationKey)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException(
                $"{configurationKey} must be configured when development seeding is enabled.");
        }

        return value.Trim();
    }
}

public sealed record DevelopmentSeedResult(
    bool Skipped,
    bool AccountCreated,
    int TransactionsInserted);
