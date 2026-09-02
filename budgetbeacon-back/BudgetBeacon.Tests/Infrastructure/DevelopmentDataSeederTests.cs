using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Interfaces;
using BudgetBeacon.Core.Models;
using BudgetBeacon.Core.Services;
using BudgetBeacon.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace BudgetBeacon.Tests.Infrastructure;

public sealed class DevelopmentDataSeederTests
{
    private static readonly DateTime SeedDate =
        new(2026, 9, 17, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task SeedAsync_CreatesMissingAccountAndPopulatesStatisticsData()
    {
        using var store = new InMemoryUserStore();
        using var userManager = CreateUserManager(store);
        var repository = new RecordingTransactionRepository();
        var seeder = new DevelopmentDataSeeder(userManager, repository);

        var result = await seeder.SeedAsync(
            new DevelopmentSeedOptions
            {
                Enabled = true,
                Email = "  demo@example.com  ",
                FirstName = "  Demo  ",
                LastName = "  User  ",
                Password = "Development1"
            },
            SeedDate);

        var user = await userManager.FindByEmailAsync("demo@example.com");

        Assert.NotNull(user);
        Assert.Equal("Demo", user.FirstName);
        Assert.Equal("User", user.LastName);
        Assert.True(await userManager.CheckPasswordAsync(user, "Development1"));
        Assert.True(result.AccountCreated);
        Assert.False(result.Skipped);
        Assert.Equal(repository.Transactions.Count, result.TransactionsInserted);
        Assert.NotEmpty(repository.Transactions);
        Assert.All(repository.Transactions, transaction => Assert.Equal(user.Id, transaction.UserId));
    }

    [Fact]
    public async Task SeedAsync_LeavesExistingAccountAndPasswordUnchanged()
    {
        using var store = new InMemoryUserStore();
        using var userManager = CreateUserManager(store);
        var existingUser = new ApplicationUser
        {
            UserName = "demo@example.com",
            Email = "demo@example.com",
            FirstName = "Existing",
            LastName = "Owner"
        };
        var createResult = await userManager.CreateAsync(existingUser, "Existing1");
        Assert.True(createResult.Succeeded);

        var repository = new RecordingTransactionRepository();
        var seeder = new DevelopmentDataSeeder(userManager, repository);

        var result = await seeder.SeedAsync(
            new DevelopmentSeedOptions
            {
                Enabled = true,
                Email = "demo@example.com",
                FirstName = "Replacement",
                LastName = "Name",
                Password = string.Empty
            },
            SeedDate);

        Assert.False(result.AccountCreated);
        Assert.Equal("Existing", existingUser.FirstName);
        Assert.Equal("Owner", existingUser.LastName);
        Assert.True(await userManager.CheckPasswordAsync(existingUser, "Existing1"));
        Assert.NotEmpty(repository.Transactions);
    }

    [Fact]
    public async Task SeedAsync_RequiresAccountConfigurationOnlyWhenAccountIsMissing()
    {
        using var store = new InMemoryUserStore();
        using var userManager = CreateUserManager(store);
        var repository = new RecordingTransactionRepository();
        var seeder = new DevelopmentDataSeeder(userManager, repository);

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            seeder.SeedAsync(
                new DevelopmentSeedOptions
                {
                    Enabled = true,
                    Email = "demo@example.com",
                    FirstName = "Demo",
                    LastName = "User",
                    Password = string.Empty
                },
                SeedDate));

        Assert.Contains("DevelopmentSeed:Password", exception.Message, StringComparison.Ordinal);
        Assert.Empty(repository.Transactions);
        Assert.Null(await userManager.FindByEmailAsync("demo@example.com"));
    }

    [Fact]
    public async Task SeedAsync_IsIdempotentAcrossRepeatedRuns()
    {
        using var store = new InMemoryUserStore();
        using var userManager = CreateUserManager(store);
        var repository = new RecordingTransactionRepository();
        var seeder = new DevelopmentDataSeeder(userManager, repository);
        var options = new DevelopmentSeedOptions
        {
            Enabled = true,
            Email = "demo@example.com",
            FirstName = "Demo",
            LastName = "User",
            Password = "Development1"
        };

        var firstResult = await seeder.SeedAsync(options, SeedDate);
        var firstTransactionCount = repository.Transactions.Count;
        var secondResult = await seeder.SeedAsync(options, SeedDate.AddMonths(1));

        Assert.True(firstResult.AccountCreated);
        Assert.True(firstResult.TransactionsInserted > 0);
        Assert.False(secondResult.AccountCreated);
        Assert.Equal(0, secondResult.TransactionsInserted);
        Assert.Equal(firstTransactionCount, repository.Transactions.Count);
    }

    [Fact]
    public async Task SeedAsync_WhenDisabled_DoesNotCreateAnAccountOrTransactions()
    {
        using var store = new InMemoryUserStore();
        using var userManager = CreateUserManager(store);
        var repository = new RecordingTransactionRepository();
        var seeder = new DevelopmentDataSeeder(userManager, repository);

        var result = await seeder.SeedAsync(
            new DevelopmentSeedOptions { Enabled = false },
            SeedDate);

        Assert.True(result.Skipped);
        Assert.Empty(store.Users);
        Assert.Empty(repository.Transactions);
    }

    [Fact]
    public void CreateTransactions_CoversTwelveMonthsAndAllStatisticsTreatments()
    {
        var transactions = DevelopmentSeedTransactionFactory.CreateTransactions(
            "seed-user",
            SeedDate);

        var months = transactions
            .Select(transaction => new { transaction.Date.Year, transaction.Date.Month })
            .Distinct()
            .OrderBy(month => month.Year)
            .ThenBy(month => month.Month)
            .ToList();
        var fingerprints = transactions
            .Select(transaction => transaction.ImportFingerprint)
            .ToList();

        Assert.Equal(12, months.Count);
        Assert.Equal(new { Year = 2025, Month = 10 }, months[0]);
        Assert.Equal(new { Year = 2026, Month = 9 }, months[^1]);
        Assert.All(transactions, transaction =>
        {
            Assert.Equal("seed-user", transaction.UserId);
            Assert.True(transaction.Date <= SeedDate.Date);
            Assert.Contains(transaction.Category, TransactionCategories.UserFacing);
            Assert.Contains(transaction.Treatment, TransactionTreatment.Allowed);
        });
        Assert.DoesNotContain(fingerprints, string.IsNullOrWhiteSpace);
        Assert.Equal(fingerprints.Count, fingerprints.Distinct(StringComparer.Ordinal).Count());
        Assert.All(fingerprints, fingerprint => Assert.True(fingerprint!.Length <= 64));
        Assert.All(
            TransactionTreatment.Allowed,
            treatment => Assert.Contains(transactions, transaction => transaction.Treatment == treatment));

        var statistics = new StatisticsAggregationService(new FinanceAggregationService())
            .BuildFixedPeriod(
                transactions,
                new DateTime(2025, 10, 1, 0, 0, 0, DateTimeKind.Utc),
                new DateTime(2026, 9, 30, 23, 59, 59, DateTimeKind.Utc),
                monthsBack: 12);

        Assert.True(statistics.Summary.TotalIncome > 0);
        Assert.True(statistics.Summary.TotalExpense < 0);
        Assert.True(statistics.Summary.TotalSavedOrInvested > 0);
        Assert.True(statistics.Summary.InternalTransferTotal > 0);
        Assert.True(statistics.Summary.AdjustmentTotal > 0);
        Assert.Equal(12, statistics.Trend.Count);
        Assert.NotEmpty(statistics.Categories);
        Assert.NotEmpty(statistics.TopExpenses);
        Assert.NotEmpty(statistics.RecurringExpenses);
    }

    private static UserManager<ApplicationUser> CreateUserManager(InMemoryUserStore store)
    {
        var identityOptions = new IdentityOptions
        {
            User = { RequireUniqueEmail = true },
            Password =
            {
                RequiredLength = 8,
                RequireDigit = true,
                RequireLowercase = true,
                RequireUppercase = true,
                RequireNonAlphanumeric = false
            }
        };

        return new UserManager<ApplicationUser>(
            store,
            Options.Create(identityOptions),
            new PasswordHasher<ApplicationUser>(),
            [new UserValidator<ApplicationUser>()],
            [new PasswordValidator<ApplicationUser>()],
            new UpperInvariantLookupNormalizer(),
            new IdentityErrorDescriber(),
            new EmptyServiceProvider(),
            NullLogger<UserManager<ApplicationUser>>.Instance);
    }

    private sealed class EmptyServiceProvider : IServiceProvider
    {
        public object? GetService(Type serviceType) => null;
    }

    private sealed class InMemoryUserStore : IUserPasswordStore<ApplicationUser>, IUserEmailStore<ApplicationUser>
    {
        private readonly Dictionary<string, ApplicationUser> _users = new(StringComparer.Ordinal);

        public IReadOnlyCollection<ApplicationUser> Users => _users.Values;

        public Task<IdentityResult> CreateAsync(ApplicationUser user, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            _users[user.Id] = user;
            return Task.FromResult(IdentityResult.Success);
        }

        public Task<IdentityResult> DeleteAsync(ApplicationUser user, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            _users.Remove(user.Id);
            return Task.FromResult(IdentityResult.Success);
        }

        public Task<ApplicationUser?> FindByEmailAsync(string normalizedEmail, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            return Task.FromResult(_users.Values.SingleOrDefault(user => user.NormalizedEmail == normalizedEmail));
        }

        public Task<ApplicationUser?> FindByIdAsync(string userId, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            _users.TryGetValue(userId, out var user);
            return Task.FromResult(user);
        }

        public Task<ApplicationUser?> FindByNameAsync(string normalizedUserName, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            return Task.FromResult(_users.Values.SingleOrDefault(user => user.NormalizedUserName == normalizedUserName));
        }

        public Task<string?> GetEmailAsync(ApplicationUser user, CancellationToken cancellationToken) =>
            Task.FromResult(user.Email);

        public Task<bool> GetEmailConfirmedAsync(ApplicationUser user, CancellationToken cancellationToken) =>
            Task.FromResult(user.EmailConfirmed);

        public Task<string?> GetNormalizedEmailAsync(ApplicationUser user, CancellationToken cancellationToken) =>
            Task.FromResult(user.NormalizedEmail);

        public Task<string?> GetNormalizedUserNameAsync(ApplicationUser user, CancellationToken cancellationToken) =>
            Task.FromResult(user.NormalizedUserName);

        public Task<string?> GetPasswordHashAsync(ApplicationUser user, CancellationToken cancellationToken) =>
            Task.FromResult(user.PasswordHash);

        public Task<string> GetUserIdAsync(ApplicationUser user, CancellationToken cancellationToken) =>
            Task.FromResult(user.Id);

        public Task<string?> GetUserNameAsync(ApplicationUser user, CancellationToken cancellationToken) =>
            Task.FromResult(user.UserName);

        public Task<bool> HasPasswordAsync(ApplicationUser user, CancellationToken cancellationToken) =>
            Task.FromResult(user.PasswordHash is not null);

        public Task SetEmailAsync(ApplicationUser user, string? email, CancellationToken cancellationToken)
        {
            user.Email = email;
            return Task.CompletedTask;
        }

        public Task SetEmailConfirmedAsync(ApplicationUser user, bool confirmed, CancellationToken cancellationToken)
        {
            user.EmailConfirmed = confirmed;
            return Task.CompletedTask;
        }

        public Task SetNormalizedEmailAsync(ApplicationUser user, string? normalizedEmail, CancellationToken cancellationToken)
        {
            user.NormalizedEmail = normalizedEmail;
            return Task.CompletedTask;
        }

        public Task SetNormalizedUserNameAsync(ApplicationUser user, string? normalizedName, CancellationToken cancellationToken)
        {
            user.NormalizedUserName = normalizedName;
            return Task.CompletedTask;
        }

        public Task SetPasswordHashAsync(ApplicationUser user, string? passwordHash, CancellationToken cancellationToken)
        {
            user.PasswordHash = passwordHash;
            return Task.CompletedTask;
        }

        public Task SetUserNameAsync(ApplicationUser user, string? userName, CancellationToken cancellationToken)
        {
            user.UserName = userName;
            return Task.CompletedTask;
        }

        public Task<IdentityResult> UpdateAsync(ApplicationUser user, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            _users[user.Id] = user;
            return Task.FromResult(IdentityResult.Success);
        }

        public void Dispose()
        {
        }
    }

    private sealed class RecordingTransactionRepository : ITransactionRepository
    {
        private readonly HashSet<(string? UserId, string Fingerprint)> _keys = [];

        public List<Transaction> Transactions { get; } = [];

        public Task<int> AddImportedTransactionsAsync(IEnumerable<Transaction> transactions)
        {
            var inserted = 0;

            foreach (var transaction in transactions)
            {
                if (transaction.ImportFingerprint is null ||
                    !_keys.Add((transaction.UserId, transaction.ImportFingerprint)))
                {
                    continue;
                }

                Transactions.Add(transaction);
                inserted++;
            }

            return Task.FromResult(inserted);
        }

        public Task AddRangeAsync(IEnumerable<Transaction> transactions) =>
            throw new NotSupportedException();

        public Task<IReadOnlySet<string>> GetExistingImportFingerprintsAsync(
            string userId,
            IReadOnlyCollection<string> importFingerprints) =>
            throw new NotSupportedException();

        public Task<bool> DeleteAsync(string userId, Guid transactionId) =>
            throw new NotSupportedException();

        public Task<Transaction?> GetByIdAsync(string userId, Guid transactionId) =>
            throw new NotSupportedException();

        public Task SaveChangesAsync(CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<Transaction?> UpdateAsync(string userId, Guid transactionId, TransactionUpdate update) =>
            throw new NotSupportedException();

        public Task<Transaction?> UpdateCategoryAsync(string userId, Guid transactionId, string category) =>
            throw new NotSupportedException();

        public Task<IEnumerable<Transaction>> GetAllAsync(string userId, DateTime? endDate = null) =>
            throw new NotSupportedException();

        public Task<List<Guid>> GetUncategorizedIdsAsync(
            string userId,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<List<Transaction>> GetUncategorizedByIdsAsync(
            string userId,
            IReadOnlyCollection<Guid> transactionIds,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<int> CountUncategorizedAsync(
            string userId,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<IEnumerable<Transaction>> GetByMonthAsync(string userId, int year, int month) =>
            throw new NotSupportedException();

        public Task<IEnumerable<Transaction>> GetByDateRangeAsync(
            string userId,
            DateTime startDate,
            DateTime endDate) =>
            throw new NotSupportedException();

        public Task<(IEnumerable<Transaction> Items, int TotalCount)> GetTransactionsPagedAsync(
            string userId,
            TransactionQueryOptions options,
            int pageNumber,
            int pageSize) =>
            throw new NotSupportedException();
    }
}
