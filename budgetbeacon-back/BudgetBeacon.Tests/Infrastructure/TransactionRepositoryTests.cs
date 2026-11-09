using Microsoft.EntityFrameworkCore;
using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Services;
using BudgetBeacon.Infrastructure.Data;

namespace BudgetBeacon.Tests.Infrastructure;

public sealed class TransactionRepositoryTests
{
    [Fact]
    public void ExportQuery_ContainsEveryMatchingRowInStableOrder()
    {
        var date = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = date.AddDays(1);
        var first = new Transaction { Id = Guid.Parse("00000000-0000-0000-0000-000000000001"), UserId = "user-1", Date = date };
        var second = new Transaction { Id = Guid.Parse("00000000-0000-0000-0000-000000000002"), UserId = "user-1", Date = date };
        var last = new Transaction { UserId = "user-1", Date = end };
        var rows = new[] { first, second,
            new Transaction { UserId = "user-2", Date = date },
            new Transaction { UserId = "user-1", Date = date.AddTicks(-1) },
            last, new Transaction { UserId = "user-1", Date = end.AddTicks(1) } };
        var result = TransactionRepository.BuildExportQuery(rows.AsQueryable(), "user-1", date, end).ToList();
        Assert.Equal([last.Id, second.Id, first.Id], result.Select(row => row.Id));
    }

    [Theory]
    [InlineData(10000, false)]
    [InlineData(10001, false)]
    [InlineData(10000, true)]
    [InlineData(10001, true)]
    public void SavingsTipsQuery_IncludesOldestTransactionBeyondFormerPageLimit(
        int transactionCount,
        bool allTime)
    {
        var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = new DateOnly(2026, 4, 1).ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);
        var transactions = Enumerable.Range(1, transactionCount - 1)
            .Select(_ => new Transaction
            {
                UserId = "user-1", Date = end, Amount = -1m, Category = "Recent"
            })
            .Append(new Transaction
            {
                UserId = "user-1", Date = start, Amount = -123.45m, Category = "Oldest"
            })
            .Append(new Transaction
            {
                UserId = "user-2", Date = start, Amount = -999m, Category = "Foreign"
            })
            .Append(new Transaction
            {
                UserId = "user-1", Date = end.AddTicks(1), Amount = -999m, Category = "Future"
            })
            .Append(new Transaction
            {
                UserId = "user-1", Date = start.AddTicks(-1), Amount = -7m, Category = "Earlier"
            });

        var groups = TransactionRepository.BuildSavingsTipsAggregateQuery(
            transactions.AsQueryable(), "user-1", allTime ? null : start, end).ToList();
        var summary = SavingsTipsAggregationService.BuildSummary(groups);

        Assert.Equal(transactionCount + (allTime ? 1 : 0), summary.TransactionCount);
        Assert.Equal(transactionCount - 1, summary.ExpensesByCategory.Single(c => c.Category == "Recent").TotalSpent);
        Assert.Equal(123.45m, summary.ExpensesByCategory.Single(c => c.Category == "Oldest").TotalSpent);
        Assert.DoesNotContain(summary.ExpensesByCategory, c => c.Category is "Foreign" or "Future");
        Assert.Equal(allTime, summary.ExpensesByCategory.Any(c => c.Category == "Earlier"));
        Assert.Equal(allTime ? 3 : 2, groups.Count);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void SavingsTipsQuery_TranslatesToPostgresAggregateWithoutEntityPayload(bool allTime)
    {
        var options = new DbContextOptionsBuilder<BudgetBeaconDbContext>()
            .UseNpgsql("Host=localhost;Database=translation_only;Username=test;Password=test")
            .Options;
        using var context = new BudgetBeaconDbContext(options);
        var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = new DateTime(2026, 4, 1, 23, 59, 59, DateTimeKind.Utc);

        var sql = TransactionRepository.BuildSavingsTipsAggregateQuery(
            context.Transactions.AsNoTracking(), "user-1", allTime ? null : start, end)
            .ToQueryString();

        Assert.Contains("GROUP BY", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("count(*)", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("sum(", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("\"UserId\" =", sql);
        Assert.Contains("\"Date\" <=", sql);
        Assert.Equal(!allTime, sql.Contains("\"Date\" >=", StringComparison.Ordinal));
        Assert.Contains("\"Amount\" >", sql);
        Assert.DoesNotContain("LIMIT", sql, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("OFFSET", sql, StringComparison.OrdinalIgnoreCase);
        foreach (var column in new[] { "Id", "Notes", "Metadata", "ImportFingerprint" })
        {
            Assert.DoesNotContain($"\"{column}\"", sql);
        }
        Assert.Empty(context.ChangeTracker.Entries());
    }

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
