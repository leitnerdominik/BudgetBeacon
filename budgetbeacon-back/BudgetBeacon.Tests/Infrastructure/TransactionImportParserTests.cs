using System.Text;
using System.IO.Compression;
using System.Security;
using BudgetBeacon.Core.Exceptions;
using BudgetBeacon.Core.Interfaces;
using BudgetBeacon.Core.Models;
using BudgetBeacon.Infrastructure.External;

namespace BudgetBeacon.Tests.Infrastructure;

public sealed class TransactionImportParserTests
{
    private readonly TransactionImportParser _sut = new();

    [Fact]
    public void ParseCsvTransactions_ParsesGermanHeadersSemicolonDelimiterAndCommaDecimals()
    {
        const string csv = """
            Datum;Betrag;Verwendungszweck
            2026-04-03;-12,34;  Supermarkt Brixen  
            """;

        var transaction = Assert.Single(_sut.ParseCsvTransactions(CreateStream(csv)));

        Assert.NotEqual(Guid.Empty, transaction.Id);
        Assert.Equal(new DateTime(2026, 4, 3), transaction.Date.Date);
        Assert.Equal(-12.34m, transaction.Amount);
        Assert.Equal("Supermarkt Brixen", transaction.Metadata.RawDescription);
        Assert.Equal("Uncategorized", transaction.Category);
        Assert.Null(transaction.Metadata.AiConfidenceScore);
        Assert.Null(transaction.Metadata.AiSuggestedCategory);
    }

    [Fact]
    public void ParseCsvTransactions_ParsesAlternativeEnglishHeaderNames()
    {
        const string csv = """
            Date;Amount;Description
            2026-05-01;100,00;Salary
            """;

        var transaction = Assert.Single(_sut.ParseCsvTransactions(CreateStream(csv)));

        Assert.Equal(new DateTime(2026, 5, 1), transaction.Date.Date);
        Assert.Equal(100m, transaction.Amount);
        Assert.Equal("Salary", transaction.Metadata.RawDescription);
    }

    [Fact]
    public void ParseCsvTransactions_AutoDetectsCommaDelimiter()
    {
        const string csv = """
            Date,Amount,Description
            2026-05-01,13.56,Coffee
            """;

        var transaction = Assert.Single(_sut.ParseCsvTransactions(CreateStream(csv), "auto"));

        Assert.Equal(new DateTime(2026, 5, 1), transaction.Date.Date);
        Assert.Equal(13.56m, transaction.Amount);
        Assert.Equal("Coffee", transaction.Metadata.RawDescription);
    }

    [Fact]
    public void ParseCsvTransactions_PreservesDemoSalaryDateAsUtc()
    {
        const string csv = """
            Date,Amount,Description
            2026-06-01,3200.00,Salary
            """;

        var transaction = Assert.Single(_sut.ParseCsvTransactions(CreateStream(csv), "auto"));
        var expectedDate = new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc);

        Assert.Equal(expectedDate, transaction.Date);
        Assert.Equal(DateTimeKind.Utc, transaction.Date.Kind);
        Assert.Equal(expectedDate, transaction.Date.ToUniversalTime());
    }

    [Fact]
    public void ParseCsvTransactions_UsesSelectedTabDelimiter()
    {
        const string csv = "Date\tAmount\tDescription\r\n2026-05-01\t13.56\tCoffee";

        var transaction = Assert.Single(_sut.ParseCsvTransactions(CreateStream(csv), "tab"));

        Assert.Equal(new DateTime(2026, 5, 1), transaction.Date.Date);
        Assert.Equal(13.56m, transaction.Amount);
        Assert.Equal("Coffee", transaction.Metadata.RawDescription);
    }

    public static TheoryData<string, decimal> ValidAmountFormats => new()
    {
        { "13.56", 13.56m },
        { "13,56", 13.56m },
        { "1.234,56", 1234.56m },
        { "1,234.56", 1234.56m },
        { "€ 13.56", 13.56m },
        { "13,56 €", 13.56m },
        { "(13.56)", -13.56m },
        { "0", 0m },
        { "1234", 1234m },
        { "+13,5", 13.5m },
        { "-13.56", -13.56m },
        { "0.01", 0.01m },
        { "1.234.567", 1234567m },
        { "1,234,567", 1234567m },
        { "12.345.678,9", 12345678.9m },
        { "123,456,789.01", 123456789.01m },
        { "1 234", 1234m },
        { "1 234 567,89", 1234567.89m },
        { "1\u00a0234\u00a0567.89", 1234567.89m },
        { "1 234\u00a0567,89", 1234567.89m },
        { "1'234", 1234m },
        { "1'234'567.89", 1234567.89m },
        { "  eur 1.234,56  ", 1234.56m },
        { "-1,234.56 EUR", -1234.56m },
        { "€ -1.234,56", -1234.56m },
        { "-€ 1.234,56", -1234.56m },
        { "(1 234,56) EUR", -1234.56m },
        { "€ (1'234.56)", -1234.56m },
        { "(EUR 13,56)", -13.56m },
        { "9.999.999.999.999,99", 9999999999999.99m }
    };

    public static TheoryData<string> InvalidAmountFormats => new()
    {
        "12.3456", "1,2,3.45", "12,3456", "1.2.3,45",
        "1.234", "12,345", "1234.567", "13.560", "13,000",
        "1.234,567", "1,234.560", "1,234,56", "1.234.56",
        "1.23,45", "1234,567.89", "12.34.567", "1,23,456",
        "1..234,56", "1,,234.56", ",13", "13.", ".", ",",
        "1.,23", "1,234.5.6", "1.234,5,6",
        "12 34", "1234 567", "1  234", "1\u00a0\u00a0234", "1'23", "1''234",
        "1 234'567", "1.234 567,89", "1,234'567.89",
        "1.2 3", "1,2'3", "1.23\u00a04",
        "--13.56", "++13.56", "+-13.56", "13-56", "13.56-",
        "(-13.56)", "(+13.56)", "-(13.56)", "((13.56))",
        "13EUR56", "13€56", "EUR 13.56 EUR", "€13.56€", "EUR €13.56",
        "EUR", "€", "+", "()", "", "   ", "not-a-number",
        "1e2", "١٢.٣٤", "79228162514264337593543950336"
    };

    [Theory]
    [MemberData(nameof(ValidAmountFormats))]
    public void ParseCsvTransactions_ParsesFlexibleAmountFormats(string amount, decimal expected)
    {
        var csv = $"""
            Date;Amount;Description
            2026-05-01;{amount};Test transaction
            """;

        var transaction = Assert.Single(_sut.ParseCsvTransactions(CreateStream(csv)));

        Assert.Equal(expected, transaction.Amount);
    }

    [Theory]
    [MemberData(nameof(ValidAmountFormats))]
    public void ParseXlsxTransactions_ParsesFlexibleTextAmountFormats(string amount, decimal expected)
    {
        using var stream = CreateXlsxStream(
            ["Date", "Amount"],
            ["2026-05-01", amount]);

        var transaction = Assert.Single(_sut.ParseXlsxTransactions(
            stream, new TransactionImportMapping(true, 0, 1, null)));

        Assert.Equal(expected, transaction.Amount);
    }

    [Theory]
    [MemberData(nameof(InvalidAmountFormats))]
    public void ParseCsvTransactions_RejectsInvalidAmountFormats(string amount)
    {
        var csv = $"Date;Amount;Description\n2026-05-01;{amount};Invalid amount";

        Assert.Throws<InvalidInputException>(() => _sut.ParseCsvTransactions(CreateStream(csv)));
    }

    [Theory]
    [MemberData(nameof(InvalidAmountFormats))]
    public void ParseXlsxTransactions_RejectsInvalidTextAmountFormats(string amount)
    {
        using var stream = CreateXlsxStream(
            ["Date", "Amount"],
            ["2026-05-01", amount]);

        Assert.Throws<InvalidInputException>(() => _sut.ParseXlsxTransactions(
            stream, new TransactionImportMapping(true, 0, 1, null)));
    }

    [Theory]
    [InlineData("12.3456")]
    [InlineData("1,2,3.45")]
    public void ParseCsvTransactions_RejectsEntireFileWhenLaterAmountIsInvalid(string amount)
    {
        var csv = $"Date;Amount;Description\n2026-05-01;12.34;Valid row\n2026-05-02;{amount};Invalid row";

        Assert.Throws<InvalidInputException>(() => _sut.ParseCsvTransactions(CreateStream(csv)));
    }

    [Theory]
    [InlineData("12.3456")]
    [InlineData("1,2,3.45")]
    public void ParseXlsxTransactions_RejectsEntireFileWhenLaterAmountIsInvalid(string amount)
    {
        using var stream = CreateXlsxStream(
            ["Date", "Amount"],
            ["2026-05-01", "12.34"],
            ["2026-05-02", amount]);

        Assert.Throws<InvalidInputException>(() => _sut.ParseXlsxTransactions(
            stream, new TransactionImportMapping(true, 0, 1, null)));
    }

    [Fact]
    public void ParseXlsxTransactions_PreservesNumericAmountForLaterFinancialValidation()
    {
        using var stream = CreateXlsxStream(
            ["Date", "Amount"],
            ["2026-05-01", 12.3456m]);

        var transaction = Assert.Single(_sut.ParseXlsxTransactions(
            stream, new TransactionImportMapping(true, 0, 1, null)));

        Assert.Equal(12.3456m, transaction.Amount);
    }

    [Fact]
    public void ParseCsvTransactions_ReturnsEmptyListForHeaderOnlyCsv()
    {
        const string csv = "Datum;Betrag;Beschreibung";

        var transactions = _sut.ParseCsvTransactions(CreateStream(csv));

        Assert.Empty(transactions);
    }

    [Fact]
    public void ParseCsvTransactions_AcceptsMaximumTransactionCount()
    {
        var csv = CreateCsv(TransactionImportLimits.MaxRowCount);

        var transactions = _sut.ParseCsvTransactions(CreateStream(csv));

        Assert.Equal(TransactionImportLimits.MaxRowCount, transactions.Count());
    }

    [Fact]
    public void ParseCsvTransactions_RejectsTransactionCountAboveMaximum()
    {
        var csv = CreateCsv(TransactionImportLimits.MaxRowCount + 1);

        var exception = Assert.Throws<InvalidInputException>(() =>
            _sut.ParseCsvTransactions(CreateStream(csv)));

        Assert.Equal(TransactionImportLimits.RowLimitExceededMessage, exception.Message);
    }

    [Fact]
    public void ParseCsvTransactions_ThrowsInvalidInputExceptionForInvalidAmount()
    {
        const string csv = """
            Datum;Betrag;Beschreibung
            2026-04-03;not-a-number;Broken row
            """;

        var exception = Assert.Throws<InvalidInputException>(() => _sut.ParseCsvTransactions(CreateStream(csv)));

        Assert.Contains("could not be parsed", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ParseCsvTransactions_ThrowsInvalidInputExceptionForUnsupportedDelimiter()
    {
        const string csv = """
            Datum;Betrag;Beschreibung
            2026-04-03;12.34;Broken row
            """;

        var exception = Assert.Throws<InvalidInputException>(() => _sut.ParseCsvTransactions(CreateStream(csv), "|"));

        Assert.Contains("delimiter", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ParseXlsxTransactions_ParsesFirstSheetWithHeadersAndMappedColumns()
    {
        using var stream = CreateXlsxStream(
            ["Date", "Ignored", "Amount", "Description"],
            [new DateTime(2026, 6, 1), "skip", -12.34m, "  Supermarkt Brixen  "],
            [new DateTime(2026, 6, 2), "skip", "13,56 EUR", "Refund"]);

        var transactions = _sut.ParseXlsxTransactions(
            stream,
            new TransactionImportMapping(true, 0, 2, 3)).ToList();

        Assert.Equal(2, transactions.Count);
        Assert.Equal(new DateTime(2026, 6, 1), transactions[0].Date.Date);
        Assert.Equal(-12.34m, transactions[0].Amount);
        Assert.Equal("Supermarkt Brixen", transactions[0].Metadata.RawDescription);
        Assert.Equal("Uncategorized", transactions[0].Category);
        Assert.Equal(new DateTime(2026, 6, 2), transactions[1].Date.Date);
        Assert.Equal(13.56m, transactions[1].Amount);
    }

    [Fact]
    public void ParseXlsxTransactions_ParsesWorkbookWithoutHeaderRow()
    {
        using var stream = CreateXlsxStream(
            ["2026-06-01", "-42.10", "Card payment"],
            ["2026-06-02", "100.00", "Salary"]);

        var transactions = _sut.ParseXlsxTransactions(
            stream,
            new TransactionImportMapping(false, 0, 1, 2)).ToList();

        Assert.Equal(2, transactions.Count);
        Assert.Equal(new DateTime(2026, 6, 1), transactions[0].Date.Date);
        Assert.Equal(-42.10m, transactions[0].Amount);
        Assert.Equal("Card payment", transactions[0].Metadata.RawDescription);
    }

    [Fact]
    public void ParseXlsxTransactions_IgnoresBlankRows()
    {
        using var stream = CreateXlsxStream(
            ["Date", "Amount", "Description"],
            [null, null, null],
            ["2026-06-01", "12.34", "Coffee"],
            [null, null, null]);

        var transaction = Assert.Single(_sut.ParseXlsxTransactions(
            stream,
            new TransactionImportMapping(true, 0, 1, 2)));

        Assert.Equal("Coffee", transaction.Metadata.RawDescription);
    }

    [Fact]
    public void ParseXlsxTransactions_ThrowsInvalidInputExceptionForMissingRequiredMapping()
    {
        using var stream = CreateXlsxStream(["Date", "Amount"], ["2026-06-01", "12.34"]);

        var exception = Assert.Throws<InvalidInputException>(() =>
            _sut.ParseXlsxTransactions(
                stream,
                new TransactionImportMapping(true, null, 1, null)).ToList());

        Assert.Contains("Date and amount", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ParseXlsxTransactions_ThrowsInvalidInputExceptionForInvalidMappedIndex()
    {
        using var stream = CreateXlsxStream(["Date", "Amount"], ["2026-06-01", "12.34"]);

        var exception = Assert.Throws<InvalidInputException>(() =>
            _sut.ParseXlsxTransactions(
                stream,
                new TransactionImportMapping(true, 0, 5, null)).ToList());

        Assert.Contains("outside", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ParseXlsxTransactions_ReturnsEmptyListForHeaderOnlyWorksheet()
    {
        using var stream = CreateXlsxStream(["Date", "Amount", "Description"]);

        var transactions = _sut.ParseXlsxTransactions(
            stream,
            new TransactionImportMapping(true, 0, 1, 2));

        Assert.Empty(transactions);
    }

    [Fact]
    public void ParseXlsxTransactions_AcceptsMaximumTransactionCount()
    {
        using var stream = CreateXlsxStream(
            CreateXlsxRows(TransactionImportLimits.MaxRowCount));

        var transactions = _sut.ParseXlsxTransactions(
            stream,
            new TransactionImportMapping(true, 0, 1, 2));

        Assert.Equal(TransactionImportLimits.MaxRowCount, transactions.Count());
    }

    [Fact]
    public void ParseXlsxTransactions_RejectsTransactionCountAboveMaximum()
    {
        using var stream = CreateXlsxStream(
            CreateXlsxRows(TransactionImportLimits.MaxRowCount + 1));

        var exception = Assert.Throws<InvalidInputException>(() =>
            _sut.ParseXlsxTransactions(
                stream,
                new TransactionImportMapping(true, 0, 1, 2)));

        Assert.Equal(TransactionImportLimits.RowLimitExceededMessage, exception.Message);
    }

    [Fact]
    public void ParseXlsxTransactions_ThrowsInvalidInputExceptionForInvalidWorkbookBytes()
    {
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes("not an xlsx file"));

        var exception = Assert.Throws<InvalidInputException>(() =>
            _sut.ParseXlsxTransactions(
                stream,
                new TransactionImportMapping(true, 0, 1, 2)).ToList());

        Assert.Contains("XLSX", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    private static MemoryStream CreateStream(string value)
    {
        return new MemoryStream(Encoding.UTF8.GetBytes(value));
    }

    private static string CreateCsv(int transactionCount)
    {
        var builder = new StringBuilder("Date;Amount;Description\r\n");

        for (var index = 0; index < transactionCount; index++)
        {
            builder.Append("2026-04-03;-1.00;Transaction ")
                .Append(index)
                .Append("\r\n");
        }

        return builder.ToString();
    }

    private static object?[][] CreateXlsxRows(int transactionCount)
    {
        return Enumerable.Range(0, transactionCount)
            .Select(index => new object?[]
            {
                "2026-04-03",
                "-1.00",
                $"Transaction {index}"
            })
            .Prepend(["Date", "Amount", "Description"])
            .ToArray();
    }

    private static MemoryStream CreateXlsxStream(params object?[][] rows)
    {
        var stream = new MemoryStream();

        using (var archive = new ZipArchive(stream, ZipArchiveMode.Create, leaveOpen: true))
        {
            AddEntry(archive, "[Content_Types].xml", """
                <?xml version="1.0" encoding="UTF-8"?>
                <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
                  <Default Extension="xml" ContentType="application/xml"/>
                  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
                  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
                  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
                </Types>
                """);
            AddEntry(archive, "_rels/.rels", """
                <?xml version="1.0" encoding="UTF-8"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
                </Relationships>
                """);
            AddEntry(archive, "xl/workbook.xml", """
                <?xml version="1.0" encoding="UTF-8"?>
                <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                  <sheets>
                    <sheet name="Transactions" sheetId="1" r:id="rId1"/>
                  </sheets>
                </workbook>
                """);
            AddEntry(archive, "xl/_rels/workbook.xml.rels", """
                <?xml version="1.0" encoding="UTF-8"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
                  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
                </Relationships>
                """);
            AddEntry(archive, "xl/styles.xml", """
                <?xml version="1.0" encoding="UTF-8"?>
                <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                  <fonts count="1"><font/></fonts>
                  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
                  <borders count="1"><border/></borders>
                  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
                  <cellXfs count="2">
                    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
                    <xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
                  </cellXfs>
                </styleSheet>
                """);
            AddEntry(archive, "xl/worksheets/sheet1.xml", BuildWorksheetXml(rows));
        }

        stream.Position = 0;
        return stream;
    }

    private static void AddEntry(ZipArchive archive, string name, string content)
    {
        var entry = archive.CreateEntry(name);
        using var writer = new StreamWriter(entry.Open(), Encoding.UTF8);
        writer.Write(content.Trim());
    }

    private static string BuildWorksheetXml(object?[][] rows)
    {
        var builder = new StringBuilder();
        builder.AppendLine("""<?xml version="1.0" encoding="UTF-8"?>""");
        builder.AppendLine("""<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">""");
        builder.AppendLine("<sheetData>");

        for (var rowIndex = 0; rowIndex < rows.Length; rowIndex++)
        {
            builder.Append($"""<row r="{rowIndex + 1}">""");
            for (var columnIndex = 0; columnIndex < rows[rowIndex].Length; columnIndex++)
            {
                builder.Append(BuildCellXml(rowIndex, columnIndex, rows[rowIndex][columnIndex]));
            }

            builder.AppendLine("</row>");
        }

        builder.AppendLine("</sheetData>");
        builder.AppendLine("</worksheet>");
        return builder.ToString();
    }

    private static string BuildCellXml(int rowIndex, int columnIndex, object? value)
    {
        var cellReference = $"{GetColumnName(columnIndex)}{rowIndex + 1}";

        return value switch
        {
            null => $"""<c r="{cellReference}"/>""",
            DateTime date => $"""<c r="{cellReference}" s="1"><v>{date.ToOADate().ToString(System.Globalization.CultureInfo.InvariantCulture)}</v></c>""",
            decimal number => $"""<c r="{cellReference}"><v>{number.ToString(System.Globalization.CultureInfo.InvariantCulture)}</v></c>""",
            double number => $"""<c r="{cellReference}"><v>{number.ToString(System.Globalization.CultureInfo.InvariantCulture)}</v></c>""",
            int number => $"""<c r="{cellReference}"><v>{number}</v></c>""",
            _ => $"""<c r="{cellReference}" t="inlineStr"><is><t>{SecurityElement.Escape(value.ToString())}</t></is></c>"""
        };
    }

    private static string GetColumnName(int columnIndex)
    {
        var result = "";
        var value = columnIndex + 1;

        while (value > 0)
        {
            var remainder = (value - 1) % 26;
            result = (char)('A' + remainder) + result;
            value = (value - 1) / 26;
        }

        return result;
    }
}
