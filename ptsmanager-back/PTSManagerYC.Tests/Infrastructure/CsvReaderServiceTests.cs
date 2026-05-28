using System.Text;
using PTSManagerYC.Core.Exceptions;
using PTSManagerYC.Infrastructure.External;

namespace PTSManagerYC.Tests.Infrastructure;

public sealed class CsvReaderServiceTests
{
    private readonly CsvReaderService _sut = new();

    [Fact]
    public void ParseTransactions_ParsesGermanHeadersSemicolonDelimiterAndCommaDecimals()
    {
        const string csv = """
            Datum;Betrag;Verwendungszweck
            2026-04-03;-12,34;  Supermarkt Brixen  
            """;

        var transaction = Assert.Single(_sut.ParseTransactions(CreateStream(csv)));

        Assert.NotEqual(Guid.Empty, transaction.Id);
        Assert.Equal(new DateTime(2026, 4, 3), transaction.Date.Date);
        Assert.Equal(-12.34m, transaction.Amount);
        Assert.Equal("Supermarkt Brixen", transaction.Metadata.RawDescription);
        Assert.Equal("Uncategorized", transaction.Category);
        Assert.Null(transaction.Metadata.AiConfidenceScore);
        Assert.Null(transaction.Metadata.AiSuggestedCategory);
    }

    [Fact]
    public void ParseTransactions_ParsesAlternativeEnglishHeaderNames()
    {
        const string csv = """
            Date;Amount;Description
            2026-05-01;100,00;Salary
            """;

        var transaction = Assert.Single(_sut.ParseTransactions(CreateStream(csv)));

        Assert.Equal(new DateTime(2026, 5, 1), transaction.Date.Date);
        Assert.Equal(100m, transaction.Amount);
        Assert.Equal("Salary", transaction.Metadata.RawDescription);
    }

    [Fact]
    public void ParseTransactions_AutoDetectsCommaDelimiter()
    {
        const string csv = """
            Date,Amount,Description
            2026-05-01,13.56,Coffee
            """;

        var transaction = Assert.Single(_sut.ParseTransactions(CreateStream(csv), "auto"));

        Assert.Equal(new DateTime(2026, 5, 1), transaction.Date.Date);
        Assert.Equal(13.56m, transaction.Amount);
        Assert.Equal("Coffee", transaction.Metadata.RawDescription);
    }

    [Fact]
    public void ParseTransactions_UsesSelectedTabDelimiter()
    {
        const string csv = "Date\tAmount\tDescription\r\n2026-05-01\t13.56\tCoffee";

        var transaction = Assert.Single(_sut.ParseTransactions(CreateStream(csv), "tab"));

        Assert.Equal(new DateTime(2026, 5, 1), transaction.Date.Date);
        Assert.Equal(13.56m, transaction.Amount);
        Assert.Equal("Coffee", transaction.Metadata.RawDescription);
    }

    [Theory]
    [InlineData("13.56", "13.56")]
    [InlineData("13,56", "13.56")]
    [InlineData("1.234,56", "1234.56")]
    [InlineData("1,234.56", "1234.56")]
    [InlineData("€ 13.56", "13.56")]
    [InlineData("13,56 €", "13.56")]
    [InlineData("(13.56)", "-13.56")]
    public void ParseTransactions_ParsesFlexibleAmountFormats(string amount, string expected)
    {
        var csv = $"""
            Date;Amount;Description
            2026-05-01;{amount};Test transaction
            """;

        var transaction = Assert.Single(_sut.ParseTransactions(CreateStream(csv)));

        Assert.Equal(decimal.Parse(expected, System.Globalization.CultureInfo.InvariantCulture), transaction.Amount);
    }

    [Fact]
    public void ParseTransactions_ReturnsEmptyListForHeaderOnlyCsv()
    {
        const string csv = "Datum;Betrag;Beschreibung";

        var transactions = _sut.ParseTransactions(CreateStream(csv));

        Assert.Empty(transactions);
    }

    [Fact]
    public void ParseTransactions_ThrowsInvalidInputExceptionForInvalidAmount()
    {
        const string csv = """
            Datum;Betrag;Beschreibung
            2026-04-03;not-a-number;Broken row
            """;

        var exception = Assert.Throws<InvalidInputException>(() => _sut.ParseTransactions(CreateStream(csv)));

        Assert.Contains("could not be parsed", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ParseTransactions_ThrowsInvalidInputExceptionForUnsupportedDelimiter()
    {
        const string csv = """
            Datum;Betrag;Beschreibung
            2026-04-03;12.34;Broken row
            """;

        var exception = Assert.Throws<InvalidInputException>(() => _sut.ParseTransactions(CreateStream(csv), "|"));

        Assert.Contains("delimiter", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    private static MemoryStream CreateStream(string value)
    {
        return new MemoryStream(Encoding.UTF8.GetBytes(value));
    }
}
