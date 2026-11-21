using Microsoft.EntityFrameworkCore;
using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Models;
using BudgetBeacon.Core.Services;
using BudgetBeacon.Infrastructure.Data;

namespace BudgetBeacon.Tests.Infrastructure;

public sealed class TransactionRepositoryTests
{
    [Fact]
    public async Task UnclassifiedPages_MatchStatisticsAndReflectMerchantRuleChanges()
    {
        var start = new DateTime(2026, 4, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = start.AddMonths(1).AddTicks(-1);
        var manual = Expense("Manual", -12m, "Food & Groceries", end);
        manual.ManualSpendingFlexibility = SpendingFlexibilityOverride.Unclassified;
        var merchant = Expense("Merchant", -23m, "Food & Groceries", start);
        var legacy = Expense("Legacy", -34m, "Uncategorized", start);
        legacy.Treatment = "";
        legacy.ApplySpendingFlexibilityReview(null);
        var classified = Expense("Classified", -45m, "Food & Groceries", start);
        var refund = Expense("Refund", 56m, "Other", end);
        refund.Treatment = TransactionTreatment.Refund;
        var otherPeriod = Expense("Outside the period", -67m, "Other", end.AddTicks(1));
        Transaction[] reportRows = [otherPeriod, manual, refund, classified, merchant, legacy];
        var candidates = TransactionQuery.ApplyFilters(reportRows.AsQueryable(),
            new(StartDate: start, EndDate: end, TransactionType: TransactionTypeFilter.Expense, UnclassifiedOnly: true));
        var statistics = new StatisticsAggregationService(new FinanceAggregationService());

        await AssertPages(SpendingFlexibilityOverride.Unclassified, [manual, merchant, legacy]);
        await AssertPages(SpendingFlexibilityOverride.Essential, [manual, legacy]);

        async Task AssertPages(SpendingFlexibilityOverride ruleValue, Transaction[] expected)
        {
            SpendingFlexibilityRule[] rules = [new("user-1", SpendingFlexibilityRuleMatch.Exact, "Merchant", ruleValue)];
            var first = await TransactionRepository.ReadUnclassifiedPageAsync(ReadCandidates(), rules, 1, 2, default);
            var second = await TransactionRepository.ReadUnclassifiedPageAsync(ReadCandidates(), rules, 2, 2, default);

            Assert.Equal(expected.Length, first.TotalCount);
            Assert.Equal(first.TotalCount, second.TotalCount);
            var matches = first.Items.Concat(second.Items).ToList();
            Assert.Equal(expected.Select(row => row.Id), matches.Select(row => row.Id));
            var report = statistics.BuildFixedPeriod(reportRows, start, end, 1, rules);
            var group = Assert.Single(report.FinancialFlexibility.Groups, group => group.Classification == "Unclassified");
            Assert.Equal(group.Amount, matches.Sum(row => Math.Abs(row.Amount)));
        }

        async IAsyncEnumerable<Transaction> ReadCandidates()
        {
            await Task.Yield();
            foreach (var transaction in candidates)
            {
                yield return transaction;
            }
        }
    }

    private static Transaction Expense(string description, decimal amount, string category, DateTime date) =>
        new()
        {
            Id = Guid.NewGuid(), UserId = "user-1", Amount = amount, Category = category,
            Treatment = TransactionTreatment.Expense, Date = date,
            Metadata = new TransactionMetadata { RawDescription = description }
        };

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
