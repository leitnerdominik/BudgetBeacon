using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Models;
using BudgetBeacon.Core.Services;

namespace BudgetBeacon.Tests.Core;

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
            CreateTransaction(new DateTime(2026, 2, 12), -100m, "Food & Groceries", "Market"),
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
        Assert.Equal(3, result.MonthlyTotals.MonthCount);
        Assert.Equal(1000m / 3m, result.MonthlyTotals.AverageIncome);
        Assert.Equal(0m, result.MonthlyTotals.MedianIncome);
        Assert.Equal(50m, result.MonthlyTotals.AverageExpense);
        Assert.Equal(50m, result.MonthlyTotals.MedianExpense);
        Assert.Equal(2, result.Categories.Count);
        Assert.All(result.Categories, category => Assert.Equal(0m, category.MedianMonthlyExpense));
        Assert.Null(result.PreviousMonthSummary);
    }

    [Fact]
    public void BuildFixedPeriod_TakesMedianOfNetCategoryTotalsAcrossCalendarMonths()
    {
        var transactions = new[]
        {
            CreateTransaction(new DateTime(2025, 12, 2), -70m, "Food & Groceries", "Market"),
            CreateTransaction(new DateTime(2025, 12, 9), -55m, "Food & Groceries", "Market"),
            CreateTransaction(new DateTime(2025, 12, 15), 25m, "Food & Groceries", "Refund", treatment: TransactionTreatment.Refund),
            CreateTransaction(new DateTime(2026, 2, 8), -250m, "Food & Groceries", "Market"),
            CreateTransaction(new DateTime(2025, 12, 15), 50m, "Transport", "Refund", treatment: TransactionTreatment.Refund),
            CreateTransaction(new DateTime(2026, 1, 15), 70m, "Transport", "Refund", treatment: TransactionTreatment.Refund),
            CreateTransaction(new DateTime(2026, 2, 10), -200m, "Transport", "Train")
        };

        var result = _sut.BuildFixedPeriod(
            transactions,
            new DateTime(2025, 12, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc).AddTicks(-1),
            monthsBack: 3);

        Assert.Collection(
            result.Categories,
            food =>
            {
                Assert.Equal("Food & Groceries", food.Category);
                Assert.Equal(350m, food.TotalExpense);
                Assert.Equal(100m, food.MedianMonthlyExpense);
            },
            transport =>
            {
                Assert.Equal("Transport", transport.Category);
                Assert.Equal(80m, transport.TotalExpense);
                Assert.Equal(0m, transport.MedianMonthlyExpense);
            });
    }

    [Fact]
    public void BuildFixedPeriod_CalculatesMonthlyTotalsAcrossAnEvenNumberOfMonths()
    {
        var transactions = new[]
        {
            CreateTransaction(new DateTime(2026, 1, 5), 100m, "Income", "Salary"),
            CreateTransaction(new DateTime(2026, 1, 6), -10m, "Food & Groceries", "Market"),
            CreateTransaction(new DateTime(2026, 2, 5), 200m, "Income", "Salary"),
            CreateTransaction(new DateTime(2026, 2, 6), -20m, "Food & Groceries", "Market"),
            CreateTransaction(new DateTime(2026, 5, 5), 300m, "Income", "Bonus"),
            CreateTransaction(new DateTime(2026, 5, 6), -30m, "Transport", "Train"),
            CreateTransaction(new DateTime(2026, 6, 5), 400m, "Income", "Salary"),
            CreateTransaction(new DateTime(2026, 6, 6), -40m, "Transport", "Train")
        };

        var result = _sut.BuildFixedPeriod(
            transactions,
            new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 6, 30, 23, 59, 59, DateTimeKind.Utc),
            monthsBack: 6);

        Assert.Equal(6, result.MonthlyTotals.MonthCount);
        Assert.Equal(1000m / 6m, result.MonthlyTotals.AverageIncome);
        Assert.Equal(150m, result.MonthlyTotals.MedianIncome);
        Assert.Equal(100m / 6m, result.MonthlyTotals.AverageExpense);
        Assert.Equal(15m, result.MonthlyTotals.MedianExpense);
    }

    [Fact]
    public void BuildFixedPeriod_UsesPreviousMonthForSingleMonthComparison()
    {
        var transactions = new[]
        {
            CreateTransaction(new DateTime(2026, 3, 10), -25m, "Food & Groceries", "Market"),
            CreateTransaction(new DateTime(2026, 4, 10), -40m, "Food & Groceries", "Market")
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
        Assert.Equal(new SpendingFlexibilityGroup("Optimizable", 40m, 100m), result.FinancialFlexibility.Groups[1]);

        var march = _sut.BuildFixedPeriod(
            transactions,
            new DateTime(2026, 3, 1),
            new DateTime(2026, 4, 1).AddTicks(-1),
            monthsBack: 1);

        Assert.Equal(new SpendingFlexibilityGroup("Optimizable", 25m, 100m), march.FinancialFlexibility.Groups[1]);
    }

    [Fact]
    public void BuildAllTime_GroupsTrendByYearAndFindsRecurringExpenses()
    {
        var transactions = new[]
        {
            CreateTransaction(new DateTime(2024, 1, 5), -50m, "Subscriptions & Services", "Music Stream"),
            CreateTransaction(new DateTime(2024, 2, 5), -52m, "Subscriptions & Services", "  MUSIC  STREAM "),
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
    public void BuildAllTime_CategoryMedianIncludesTheFullRecordedMonthRange()
    {
        var transactions = new[]
        {
            CreateTransaction(new DateTime(2025, 12, 18), 1000m, "Income", "Salary"),
            CreateTransaction(new DateTime(2026, 1, 8), -100.01m, "Transport", "Train"),
            CreateTransaction(new DateTime(2026, 3, 10), -250m, "Transport", "Train")
        };

        var result = _sut.BuildAllTime(transactions);

        Assert.Equal(4, result.MonthlyTotals.MonthCount);
        var category = Assert.Single(result.Categories);
        Assert.Equal(350.01m, category.TotalExpense);
        Assert.Equal(50.005m, category.MedianMonthlyExpense);
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
        Assert.Equal(0, result.MonthlyTotals.MonthCount);
        Assert.Equal(0m, result.MonthlyTotals.AverageIncome);
        Assert.Equal(0m, result.MonthlyTotals.MedianIncome);
        Assert.Equal(0m, result.MonthlyTotals.AverageExpense);
        Assert.Equal(0m, result.MonthlyTotals.MedianExpense);
        var flexibility = result.FinancialFlexibility;
        Assert.Equal(4, flexibility.Groups.Count);
        Assert.All(flexibility.Groups, group =>
        {
            Assert.Equal(0m, group.Amount);
            Assert.Equal(0m, group.Percentage);
        });
        Assert.Equal(0m, flexibility.GrossExpenses);
        Assert.Equal(0m, flexibility.RefundAdjustment);
        Assert.Equal(0m, flexibility.NetExpenses);
        Assert.Equal(0m, flexibility.EssentialExpenses);
        Assert.Equal(0m, flexibility.AdjustableExpenses);
    }

    [Fact]
    public void BuildAllTime_IncludesEmptyMonthsInMonthlyTotals()
    {
        var transactions = new[]
        {
            CreateTransaction(new DateTime(2026, 1, 5), 600m, "Income", "Salary"),
            CreateTransaction(new DateTime(2026, 1, 6), -90m, "Food & Groceries", "Market"),
            CreateTransaction(new DateTime(2026, 3, 5), 1200m, "Income", "Salary"),
            CreateTransaction(new DateTime(2026, 3, 6), -30m, "Transport", "Train")
        };

        var result = _sut.BuildAllTime(transactions);

        Assert.Equal(3, result.MonthlyTotals.MonthCount);
        Assert.Equal(600m, result.MonthlyTotals.AverageIncome);
        Assert.Equal(600m, result.MonthlyTotals.MedianIncome);
        Assert.Equal(40m, result.MonthlyTotals.AverageExpense);
        Assert.Equal(30m, result.MonthlyTotals.MedianExpense);
    }

    [Fact]
    public void BuildMonthlySummaries_IncludesEmptyMonthsInRequestedRange()
    {
        var transactions = new[]
        {
            CreateTransaction(new DateTime(2026, 1, 5), 1000m, "Income", "Salary"),
            CreateTransaction(new DateTime(2026, 3, 5), -25m, "Food & Groceries", "Market")
        };

        var result = _sut.BuildMonthlySummaries(2026, 1, 2026, 3, transactions);

        Assert.Collection(
            result,
            january =>
            {
                Assert.Equal(1, january.Month);
                Assert.Equal(1000m, january.TotalIncome);
                Assert.Equal(1000m, january.NetBalance);
            },
            february =>
            {
                Assert.Equal(2, february.Month);
                Assert.Equal(0, february.TransactionCount);
            },
            march =>
            {
                Assert.Equal(3, march.Month);
                Assert.Equal(-25m, march.TotalExpense);
                Assert.Equal(-25m, march.NetBalance);
            });
    }

    [Fact]
    public void BuildCategorySummariesAndTopExpenses_ReturnExpenseOnlySnapshots()
    {
        var expensiveId = Guid.NewGuid();
        var transactions = new[]
        {
            CreateTransaction(new DateTime(2026, 4, 1), 1000m, "Income", "Salary"),
            CreateTransaction(new DateTime(2026, 4, 2), -100m, "Food & Groceries", "Market", expensiveId),
            CreateTransaction(new DateTime(2026, 4, 3), -50m, "Transport", "Train")
        };

        var categories = _sut.BuildCategorySummaries(transactions);
        var topExpenses = _sut.BuildTopExpenses(transactions, limit: 1);

        Assert.Collection(
            categories,
            first =>
            {
                Assert.Equal("Food & Groceries", first.Category);
                Assert.Equal(100m, first.TotalExpense);
            },
            second =>
            {
                Assert.Equal("Transport", second.Category);
                Assert.Equal(50m, second.TotalExpense);
            });
        var topExpense = Assert.Single(topExpenses);
        Assert.Equal(expensiveId, topExpense.Id);
        Assert.Equal(100m, topExpense.Amount);
    }

    [Fact]
    public void BuildFixedPeriod_UsesTreatmentForAnalyticsTotals()
    {
        var transactions = new[]
        {
            CreateTransaction(new DateTime(2026, 4, 1), 2500m, "Income", "Salary", treatment: TransactionTreatment.Income),
            CreateTransaction(new DateTime(2026, 4, 2), -100m, "Food & Groceries", "Market", treatment: TransactionTreatment.Expense),
            CreateTransaction(new DateTime(2026, 4, 3), 20m, "Food & Groceries", "Refund", treatment: TransactionTreatment.Refund),
            CreateTransaction(new DateTime(2026, 4, 4), -500m, "Savings & Investments", "ETF", treatment: TransactionTreatment.SavingsInvestment),
            CreateTransaction(new DateTime(2026, 4, 5), -700m, "Transfers & Adjustments", "Own account", treatment: TransactionTreatment.InternalTransfer),
            CreateTransaction(new DateTime(2026, 4, 6), -15m, "Transfers & Adjustments", "Correction", treatment: TransactionTreatment.Adjustment)
        };

        var result = _sut.BuildFixedPeriod(
            transactions,
            new DateTime(2026, 4, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 4, 30, 23, 59, 59, DateTimeKind.Utc),
            monthsBack: 1);

        Assert.Equal(2500m, result.Summary.TotalIncome);
        Assert.Equal(-80m, result.Summary.TotalExpense);
        Assert.Equal(2420m, result.Summary.NetBalance);
        Assert.Equal(500m, result.Summary.TotalSavedOrInvested);
        Assert.Equal(700m, result.Summary.InternalTransferTotal);
        Assert.Equal(15m, result.Summary.AdjustmentTotal);
        Assert.Equal(3, result.Summary.AnalyticsTransactionCount);
        Assert.Equal(1, result.MonthlyTotals.MonthCount);
        Assert.Equal(2500m, result.MonthlyTotals.AverageIncome);
        Assert.Equal(2500m, result.MonthlyTotals.MedianIncome);
        Assert.Equal(80m, result.MonthlyTotals.AverageExpense);
        Assert.Equal(80m, result.MonthlyTotals.MedianExpense);
        var category = Assert.Single(result.Categories);
        Assert.Equal("Food & Groceries", category.Category);
        Assert.Equal(80m, category.TotalExpense);
        Assert.Equal(80m, category.MedianMonthlyExpense);
        Assert.DoesNotContain(result.TopExpenses, expense => expense.Category == "Savings & Investments");
    }

    [Fact]
    public void BuildFixedPeriod_UsesEffectiveFlexibilityAndExcludesOtherTreatments()
    {
        var date = new DateTime(2026, 4, 15);
        var transactions = new[]
        {
            CreateTransaction(date, -50m, "Eating Out", "Manual classification", flexibility: SpendingFlexibilityOverride.Essential),
            CreateTransaction(date, -25m, "Food & Groceries", "Legacy default", treatment: ""),
            CreateTransaction(date, -15m, "Leisure & Hobbies", "Normalized treatment", treatment: " expense "),
            CreateTransaction(date, -6.25m, "Food & Groceries", "Manual unclassified", flexibility: SpendingFlexibilityOverride.Unclassified),
            CreateTransaction(date, -3.75m, "Shopping & Personal", "No default"),
            CreateTransaction(date, 2000m, "Food & Groceries", "Income", treatment: TransactionTreatment.Income),
            CreateTransaction(date, -100m, "Food & Groceries", "Transfer", treatment: TransactionTreatment.InternalTransfer),
            CreateTransaction(date, -200m, "Food & Groceries", "Investments", treatment: TransactionTreatment.SavingsInvestment),
            CreateTransaction(date, -300m, "Food & Groceries", "Adjustment", treatment: TransactionTreatment.Adjustment)
        };

        var result = _sut.BuildFixedPeriod(transactions, new DateTime(2026, 4, 1), new DateTime(2026, 4, 30), 1);
        var flexibility = result.FinancialFlexibility;

        Assert.Equal<SpendingFlexibilityGroup>(
            [new("Essential", 50m, 50m), new("Optimizable", 25m, 25m), new("Optional", 15m, 15m), new("Unclassified", 10m, 10m)],
            flexibility.Groups);
        Assert.Equal(100m, flexibility.GrossExpenses);
        Assert.Equal(100m, flexibility.NetExpenses);
        Assert.Equal(50m, flexibility.EssentialExpenses);
        Assert.Equal(40m, flexibility.AdjustableExpenses);
    }

    [Theory]
    [InlineData(100, 20, 80)]
    [InlineData(100, 120, 0)]
    [InlineData(100, -20, 80)]
    [InlineData(0, 20, 0)]
    public void BuildAllTime_KeepsRefundsSeparateAndUsesClampedNetExpenses(int expense, int refund, int netExpenses)
    {
        var date = new DateTime(2026, 4, 15);
        var transactions = new List<Transaction>
        {
            CreateTransaction(date, refund, "Food & Groceries", "Refund", treatment: TransactionTreatment.Refund)
        };
        if (expense > 0)
        {
            transactions.Add(CreateTransaction(date, -expense, "Eating Out", "Meal"));
        }

        var result = _sut.BuildAllTime(transactions);
        var flexibility = result.FinancialFlexibility;

        Assert.Equal(new SpendingFlexibilityGroup("Optional", expense, expense > 0 ? 100m : 0m), flexibility.Groups[2]);
        Assert.All(flexibility.Groups.Where(group => group.Classification != "Optional"), group =>
        {
            Assert.Equal(0m, group.Amount);
            Assert.Equal(0m, group.Percentage);
        });
        Assert.Equal(expense, flexibility.GrossExpenses);
        Assert.Equal(expense, flexibility.AdjustableExpenses);
        Assert.Equal(0m, flexibility.EssentialExpenses);
        Assert.Equal(-Math.Abs(refund), flexibility.RefundAdjustment);
        Assert.Equal(netExpenses, flexibility.NetExpenses);
        Assert.Equal(-flexibility.NetExpenses, result.Summary.TotalExpense);
    }

    private static Transaction CreateTransaction(
        DateTime date,
        decimal amount,
        string category,
        string description,
        Guid? id = null,
        string? treatment = null,
        SpendingFlexibilityOverride? flexibility = null) =>
        new()
        {
            Id = id ?? Guid.NewGuid(),
            Date = date,
            Amount = amount,
            Category = category,
            Treatment = treatment ?? TransactionTreatment.GetDefault(amount, category),
            ManualSpendingFlexibility = flexibility,
            Metadata = new TransactionMetadata { RawDescription = description }
        };
}
