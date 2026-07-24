using BudgetBeacon.Core.Services;

namespace BudgetBeacon.Tests.Core;

public sealed class FinancialValueValidatorTests
{
    private static readonly DateOnly SupportedDate = new(2026, 7, 24);

    [Theory]
    [InlineData("0.01")]
    [InlineData("-0.01")]
    [InlineData("9999999999999.99")]
    [InlineData("-9999999999999.99")]
    [InlineData("1.230")]
    public void Validate_AcceptsSupportedAmounts(string value)
    {
        var amount = decimal.Parse(
            value,
            System.Globalization.CultureInfo.InvariantCulture);

        var result = FinancialValueValidator.Validate(amount, SupportedDate);

        Assert.True(result.IsValid);
        Assert.Empty(result.AmountErrors);
    }

    [Theory]
    [InlineData("0", "Amount must not be zero.")]
    [InlineData("10000000000000", "Amount must be between")]
    [InlineData("-10000000000000", "Amount must be between")]
    [InlineData("1.234", "Amount must have no more than 2 decimal places.")]
    public void Validate_RejectsUnsupportedAmounts(string value, string expectedError)
    {
        var amount = decimal.Parse(
            value,
            System.Globalization.CultureInfo.InvariantCulture);

        var result = FinancialValueValidator.Validate(amount, SupportedDate);

        Assert.False(result.IsValid);
        Assert.Contains(
            result.AmountErrors,
            error => error.Contains(expectedError, StringComparison.Ordinal));
    }

    [Theory]
    [InlineData(2000, 1, 1)]
    [InlineData(2100, 12, 31)]
    public void Validate_AcceptsSupportedDateBoundaries(int year, int month, int day)
    {
        var result = FinancialValueValidator.Validate(
            1m,
            new DateOnly(year, month, day));

        Assert.True(result.IsValid);
        Assert.Empty(result.DateErrors);
    }

    [Theory]
    [InlineData(1999, 12, 31)]
    [InlineData(2101, 1, 1)]
    public void Validate_RejectsUnsupportedDates(int year, int month, int day)
    {
        var result = FinancialValueValidator.Validate(
            1m,
            new DateOnly(year, month, day));

        Assert.False(result.IsValid);
        Assert.Contains(
            "Date must be between 2000-01-01 and 2100-12-31.",
            result.DateErrors);
    }
}
