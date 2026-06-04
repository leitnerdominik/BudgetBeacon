using PTSManagerYC.Core.Entities;
using PTSManagerYC.Core.Services;

namespace PTSManagerYC.Tests.Core;

public sealed class StatisticsAggregationServiceTests
{
    private readonly StatisticsAggregationService _sut =
        new(new FinanceAggregationService());

    [Fact]
    public void BuildFixedPeriod_AggregatesSelectedMonthsAndIncludesEmptyTrendMonths()
    {
        var transactions = new[]
        {
            CreateTransaction(new DateTime(2026, 2, 10), 1000m, "Income", "Salary"),
            CreateTransaction(new DateTime(2026, 2, 12), -100m, "Groceries", "Market"),
            CreateTransaction(new DateTime(2026, 4, 5), -50m, "Transport", "Train")
        };

        var result = _sut.BuildFixedPeriod(
            transactions,
            new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 4, 30, 23, 59, 59, DateTimeKind.Utc),
            monthsBack: 3);

        Assert.Equal(1000m, result.Summary.TotalIncome);
        Assert.Equal(-150m, result.Summary.TotalExpense);
        Assert.Equal(850m, result.Summary.NetBalance);
        Assert.Equal(3, result.Summary.TransactionCount);
        Assert.Equal(3, result.Trend.Count);
        Assert.Equal(2, result.Trend[0].Month);
        Assert.Equal(0, result.Trend[1].TransactionCount);
        Assert.Equal(4, result.Trend[2].Month);
        Assert.Equal(2, result.Categories.Count);
        Assert.Null(result.PreviousMonthSummary);
    }

    [Fact]
    public void BuildFixedPeriod_UsesPreviousMonthForSingleMonthComparison()
    {
        var transactions = new[]
        {
            CreateTransaction(new DateTime(2026, 3, 10), -25m, "Groceries", "Market"),
            CreateTransaction(new DateTime(2026, 4, 10), -40m, "Groceries", "Market")
        };

        var result = _sut.BuildFixedPeriod(
            transactions,
            new DateTime(2026, 4, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 4, 30, 23, 59, 59, DateTimeKind.Utc),
            monthsBack: 1);

        Assert.Equal(-40m, result.Summary.TotalExpense);
        Assert.NotNull(result.PreviousMonthSummary);
        Assert.Equal(-25m, result.PreviousMonthSummary.TotalExpense);
        Assert.Empty(result.RecurringExpenses);
    }

    [Fact]
    public void BuildAllTime_GroupsTrendByYearAndFindsRecurringExpenses()
    {
        var transactions = new[]
        {
            CreateTransaction(new DateTime(2024, 1, 5), -50m, "Subscriptions", "Music Stream"),
            CreateTransaction(new DateTime(2024, 2, 5), -52m, "Subscriptions", "  MUSIC  STREAM "),
            CreateTransaction(new DateTime(2026, 3, 1), 2000m, "Income", "Salary")
        };

        var result = _sut.BuildAllTime(transactions);

        Assert.True(result.AllTime);
        Assert.Equal("year", result.TrendGranularity);
        Assert.Equal(3, result.Trend.Count);
        Assert.Equal(2024, result.Trend[0].Year);
        Assert.Equal(0, result.Trend[1].TransactionCount);
        Assert.Equal(2026, result.Trend[2].Year);
        var recurring = Assert.Single(result.RecurringExpenses);
        Assert.Equal("music stream", recurring.Description);
        Assert.Equal(2, recurring.MonthCount);
    }

    [Fact]
    public void BuildAllTime_ReturnsEmptySnapshotWithoutTransactions()
    {
        var result = _sut.BuildAllTime([]);

        Assert.Null(result.StartDate);
        Assert.Null(result.EndDate);
        Assert.Equal(0, result.Summary.TransactionCount);
        Assert.Empty(result.Trend);
        Assert.Empty(result.Categories);
        Assert.Empty(result.TopExpenses);
        Assert.Empty(result.RecurringExpenses);
    }

    private static Transaction CreateTransaction(
        DateTime date,
        decimal amount,
        string category,
        string description) =>
        new()
        {
            Date = date,
            Amount = amount,
            Category = category,
            Metadata = new TransactionMetadata { RawDescription = description }
        };
}
