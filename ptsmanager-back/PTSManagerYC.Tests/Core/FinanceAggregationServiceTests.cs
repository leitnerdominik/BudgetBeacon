using PTSManagerYC.Core.Entities;
using PTSManagerYC.Core.Services;

namespace PTSManagerYC.Tests.Core;

public sealed class FinanceAggregationServiceTests
{
    private readonly FinanceAggregationService _sut = new();

    [Fact]
    public void CalculateTotal_SumsPositiveNegativeAndZeroAmounts()
    {
        var transactions = CreateTransactions(120.50m, -45.25m, 0m, -10m);

        var total = _sut.CalculateTotal(transactions);

        Assert.Equal(65.25m, total);
    }

    [Fact]
    public void CalculateAverage_ReturnsZeroForEmptyInput()
    {
        var average = _sut.CalculateAverage([]);

        Assert.Equal(0m, average);
    }

    [Fact]
    public void CalculateAverage_ReturnsDecimalAverageForMixedAmounts()
    {
        var transactions = CreateTransactions(-10m, -20m, 15m);

        var average = _sut.CalculateAverage(transactions);

        Assert.Equal(-5m, average);
    }

    [Theory]
    [MemberData(nameof(MedianCases))]
    public void CalculateMedian_ReturnsExpectedMedianForEdgeCases(decimal[] amounts, decimal expected)
    {
        var transactions = CreateTransactions(amounts);

        var median = _sut.CalculateMedian(transactions);

        Assert.Equal(expected, median);
    }

    public static TheoryData<decimal[], decimal> MedianCases => new()
    {
        { [], 0m },
        { [10m], 10m },
        { [10m, -2m, 3m], 3m },
        { [10m, 0m, -2m, 8m], 4m },
        { [-5.50m, -5.50m, -1m, -12m], -5.50m }
    };

    private static List<Transaction> CreateTransactions(params decimal[] amounts)
    {
        return amounts.Select(amount => new Transaction { Amount = amount }).ToList();
    }
}
