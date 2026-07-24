using Microsoft.EntityFrameworkCore;
using BudgetBeacon.Core.Entities;
using BudgetBeacon.Infrastructure.Data;

namespace BudgetBeacon.Tests.Infrastructure;

public sealed class TransactionRepositoryTests
{
    [Fact]
    public async Task AddImportedTransactionsAsync_RejectsMissingSourceFingerprint()
    {
        var options = new DbContextOptionsBuilder<BudgetBeaconDbContext>()
            .Options;
        await using var context = new BudgetBeaconDbContext(options);
        var repository = new TransactionRepository(context);

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            repository.AddImportedTransactionsAsync(
                [
                    new Transaction
                    {
                        Date = new DateTime(2026, 4, 3),
                        Amount = -12.34m,
                        Metadata = new TransactionMetadata
                        {
                            RawDescription = "Already redacted"
                        }
                    }
                ]));

        Assert.Contains("source fingerprint", exception.Message, StringComparison.Ordinal);
    }
}
