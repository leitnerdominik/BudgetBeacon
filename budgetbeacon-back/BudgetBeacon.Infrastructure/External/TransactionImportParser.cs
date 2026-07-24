using System.Globalization;
using System.Text;
using CsvHelper;
using CsvHelper.Configuration;
using CsvHelper.TypeConversion;
using ExcelDataReader;
using ExcelDataReader.Exceptions;
using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Exceptions;
using BudgetBeacon.Core.Interfaces;
using BudgetBeacon.Core.Models;

namespace BudgetBeacon.Infrastructure.External;

public class TransactionImportParser : ITransactionImportParser
{
    static TransactionImportParser()
    {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
    }

    private static readonly IReadOnlyDictionary<string, string> DelimiterAliases =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["semicolon"] = ";",
            [";"] = ";",
            ["comma"] = ",",
            [","] = ",",
            ["tab"] = "\t",
            ["\\t"] = "\t"
        };

    private static readonly CultureInfo ImportCulture = CultureInfo.GetCultureInfo("de-IT");
    private static readonly CultureInfo[] DateCultures =
    [
        ImportCulture,
        CultureInfo.InvariantCulture,
        CultureInfo.GetCultureInfo("en-US")
    ];

    public IEnumerable<Transaction> ParseCsvTransactions(Stream stream, string? delimiter = null)
    {
        using var reader = new StreamReader(stream);
        var csvText = reader.ReadToEnd();
        var resolvedDelimiter = ResolveDelimiter(csvText, delimiter);

        var config = new CsvConfiguration(ImportCulture)
        {
            HasHeaderRecord = true,
            Delimiter = resolvedDelimiter,
            MissingFieldFound = null,
            BadDataFound = null,
            TrimOptions = TrimOptions.Trim
        };

        using var csvReader = new StringReader(csvText);
        using var csv = new CsvReader(csvReader, config);

        csv.Context.RegisterClassMap<TransactionMap>();

        try
        {
            var transactions = new List<Transaction>();

            foreach (var transaction in csv.GetRecords<Transaction>())
            {
                AddTransactionWithinLimit(transactions, transaction);
            }

            return transactions;
        }
        catch (CsvHelperException ex)
        {
            throw new InvalidInputException("The uploaded CSV file could not be parsed. Please verify the delimiter, headers, and date/amount formats.", ex);
        }
        catch (FormatException ex)
        {
            throw new InvalidInputException("The uploaded CSV file contains invalid values.", ex);
        }
    }

    public IEnumerable<Transaction> ParseXlsxTransactions(
        Stream stream,
        TransactionImportMapping mapping)
    {
        ValidateRequiredMapping(mapping);

        try
        {
            using var reader = ExcelReaderFactory.CreateReader(stream);
            ValidateMappingIndexes(mapping, reader.FieldCount);

            var transactions = new List<Transaction>();
            var skippedHeader = !mapping.HasHeaderRow;

            while (reader.Read())
            {
                if (IsCurrentRowEmpty(reader))
                {
                    continue;
                }

                if (!skippedHeader)
                {
                    skippedHeader = true;
                    continue;
                }

                AddTransactionWithinLimit(
                    transactions,
                    CreateTransactionFromRow(reader, mapping));
            }

            return transactions;
        }
        catch (InvalidInputException)
        {
            throw;
        }
        catch (Exception ex) when (ex is HeaderException or InvalidOperationException or IOException or FormatException)
        {
            throw new InvalidInputException("The uploaded XLSX file could not be parsed. Please verify the workbook, selected columns, and date/amount formats.", ex);
        }
    }

    private static void ValidateRequiredMapping(TransactionImportMapping mapping)
    {
        if (mapping.DateColumnIndex is null || mapping.AmountColumnIndex is null)
        {
            throw new InvalidInputException("Date and amount columns must be mapped before importing an XLSX file.");
        }

        var mappedIndexes = new[]
            {
                mapping.DateColumnIndex,
                mapping.AmountColumnIndex,
                mapping.DescriptionColumnIndex
            }
            .Where(index => index is not null)
            .Select(index => index!.Value)
            .ToList();

        if (mappedIndexes.Any(index => index < 0))
        {
            throw new InvalidInputException("Mapped XLSX column indexes must be zero or greater.");
        }

        if (mappedIndexes.Distinct().Count() != mappedIndexes.Count)
        {
            throw new InvalidInputException("Each XLSX target field must use a different source column.");
        }
    }

    private static void AddTransactionWithinLimit(
        List<Transaction> transactions,
        Transaction transaction)
    {
        if (transactions.Count >= TransactionImportLimits.MaxRowCount)
        {
            throw new InvalidInputException(
                TransactionImportLimits.RowLimitExceededMessage);
        }

        transaction.Date = DateTime.SpecifyKind(transaction.Date.Date, DateTimeKind.Utc);
        transactions.Add(transaction);
    }

    private static void ValidateMappingIndexes(
        TransactionImportMapping mapping,
        int fieldCount)
    {
        var maxMappedIndex = new[]
            {
                mapping.DateColumnIndex,
                mapping.AmountColumnIndex,
                mapping.DescriptionColumnIndex
            }
            .Where(index => index is not null)
            .Select(index => index!.Value)
            .DefaultIfEmpty(-1)
            .Max();

        if (fieldCount <= 0 || maxMappedIndex >= fieldCount)
        {
            throw new InvalidInputException("One of the selected XLSX columns is outside the first worksheet's available columns.");
        }
    }

    private static Transaction CreateTransactionFromRow(
        IExcelDataReader reader,
        TransactionImportMapping mapping)
    {
        var rowNumber = reader.Depth + 1;
        var dateValue = GetCellValue(reader, mapping.DateColumnIndex!.Value);
        var amountValue = GetCellValue(reader, mapping.AmountColumnIndex!.Value);
        var descriptionValue = mapping.DescriptionColumnIndex is null
            ? null
            : GetCellValue(reader, mapping.DescriptionColumnIndex.Value);

        if (IsBlank(dateValue) || IsBlank(amountValue))
        {
            throw new InvalidInputException($"Row {rowNumber} is missing a value in the mapped date or amount column.");
        }

        try
        {
            return new Transaction
            {
                Date = ParseDate(dateValue).Date,
                Amount = ParseAmount(amountValue),
                Category = "Uncategorized",
                Metadata = new TransactionMetadata
                {
                    RawDescription = ConvertCellToString(descriptionValue)
                }
            };
        }
        catch (FormatException ex)
        {
            throw new InvalidInputException($"Row {rowNumber} contains invalid date or amount values.", ex);
        }
    }

    private static object? GetCellValue(IExcelDataReader reader, int index)
    {
        return index < reader.FieldCount ? reader.GetValue(index) : null;
    }

    private static bool IsCurrentRowEmpty(IExcelDataReader reader)
    {
        for (var index = 0; index < reader.FieldCount; index++)
        {
            if (!IsBlank(reader.GetValue(index)))
            {
                return false;
            }
        }

        return true;
    }

    private static bool IsBlank(object? value)
    {
        return value is null || string.IsNullOrWhiteSpace(ConvertCellToString(value));
    }

    private static string ConvertCellToString(object? value)
    {
        return value switch
        {
            null => string.Empty,
            DateTime date => date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            IFormattable formattable => formattable.ToString(null, CultureInfo.InvariantCulture)?.Trim() ?? string.Empty,
            _ => value.ToString()?.Trim() ?? string.Empty
        };
    }

    private static DateTime ParseDate(object? value)
    {
        switch (value)
        {
            case DateTime date:
                return DateTime.SpecifyKind(date.Date, DateTimeKind.Utc);
            case double serialDate:
                return DateTime.SpecifyKind(DateTime.FromOADate(serialDate).Date, DateTimeKind.Utc);
            case int serialDate:
                return DateTime.SpecifyKind(DateTime.FromOADate(serialDate).Date, DateTimeKind.Utc);
        }

        var text = ConvertCellToString(value);
        foreach (var culture in DateCultures)
        {
            if (DateTime.TryParse(
                    text,
                    culture,
                    DateTimeStyles.AllowWhiteSpaces,
                    out var parsedDate))
            {
                return DateTime.SpecifyKind(parsedDate.Date, DateTimeKind.Utc);
            }
        }

        throw new FormatException($"Invalid date value '{text}'.");
    }

    private static decimal ParseAmount(object? value)
    {
        return value switch
        {
            decimal amount => amount,
            double amount => Convert.ToDecimal(amount, CultureInfo.InvariantCulture),
            float amount => Convert.ToDecimal(amount, CultureInfo.InvariantCulture),
            int amount => amount,
            long amount => amount,
            _ => FlexibleAmountParser.Parse(ConvertCellToString(value))
        };
    }

    private static string ResolveDelimiter(string csvText, string? delimiter)
    {
        if (!string.IsNullOrWhiteSpace(delimiter) &&
            !string.Equals(delimiter, "auto", StringComparison.OrdinalIgnoreCase))
        {
            if (DelimiterAliases.TryGetValue(delimiter.Trim(), out var resolvedDelimiter))
            {
                return resolvedDelimiter;
            }

            throw new InvalidInputException("The selected CSV delimiter is not supported.");
        }

        return DetectDelimiter(csvText);
    }

    private static string DetectDelimiter(string csvText)
    {
        var firstLine = StripBom(csvText).Split(["\r\n", "\n"], StringSplitOptions.None)[0];
        var candidates = new[] { ";", ",", "\t" };

        return candidates
            .Select(candidate => new
            {
                Delimiter = candidate,
                Count = CountDelimiterOccurrences(firstLine, candidate[0])
            })
            .OrderByDescending(candidate => candidate.Count)
            .FirstOrDefault(candidate => candidate.Count > 0)
            ?.Delimiter ?? ";";
    }

    private static string StripBom(string value)
    {
        return value.Length > 0 && value[0] == '\uFEFF' ? value[1..] : value;
    }

    private static int CountDelimiterOccurrences(string line, char delimiter)
    {
        var count = 0;
        var insideQuotes = false;

        foreach (var character in line)
        {
            if (character == '"')
            {
                insideQuotes = !insideQuotes;
                continue;
            }

            if (character == delimiter && !insideQuotes)
            {
                count++;
            }
        }

        return count;
    }
}

public sealed class TransactionMap : ClassMap<Transaction>
{
    public TransactionMap()
    {
        Map(m => m.Id).Convert(args => Guid.NewGuid());

        Map(m => m.Date).Name("Datum", "Buchungstag", "Date");
        Map(m => m.Amount).Name("Betrag", "Umsatz", "Amount").TypeConverter<FlexibleAmountConverter>();

        Map(m => m.Metadata.RawDescription).Name("Verwendungszweck", "Beschreibung", "Description");

        Map(m => m.Category).Constant("Uncategorized");
        Map(m => m.Id).Ignore();
        Map(m => m.Treatment).Ignore();
        Map(m => m.ImportFingerprint).Ignore();
        Map(m => m.Metadata.AiConfidenceScore).Ignore();
        Map(m => m.Metadata.AiSuggestedCategory).Ignore();
    }
}

internal sealed class FlexibleAmountConverter : DefaultTypeConverter
{
    public override object ConvertFromString(string? text, IReaderRow row, MemberMapData memberMapData)
    {
        return FlexibleAmountParser.Parse(text);
    }
}

internal static class FlexibleAmountParser
{
    public static decimal Parse(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            throw new FormatException("Amount is required.");
        }

        var value = text.Trim()
            .Replace("EUR", string.Empty, StringComparison.OrdinalIgnoreCase)
            .Replace("€", string.Empty, StringComparison.Ordinal)
            .Replace("\u00a0", string.Empty, StringComparison.Ordinal)
            .Replace(" ", string.Empty, StringComparison.Ordinal)
            .Replace("'", string.Empty, StringComparison.Ordinal);

        var isParenthesizedNegative = value.StartsWith('(') && value.EndsWith(')');
        if (isParenthesizedNegative)
        {
            value = value[1..^1];
            value = value.TrimStart('+', '-');
        }

        if (value.Any(character => !char.IsDigit(character) && character is not ('.' or ',' or '+' or '-')))
        {
            throw new FormatException($"Invalid amount value '{text}'.");
        }

        var decimalSeparatorIndex = FindDecimalSeparatorIndex(value);
        var normalized = new string(value
            .Select((character, index) => (character, index))
            .Where(item =>
                char.IsDigit(item.character) ||
                item.character is '+' or '-' ||
                item.index == decimalSeparatorIndex)
            .Select(item => item.index == decimalSeparatorIndex ? '.' : item.character)
            .ToArray());

        if (isParenthesizedNegative)
        {
            normalized = "-" + normalized;
        }

        if (!decimal.TryParse(
                normalized,
                NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint,
                CultureInfo.InvariantCulture,
                out var amount))
        {
            throw new FormatException($"Invalid amount value '{text}'.");
        }

        return amount;
    }

    private static int FindDecimalSeparatorIndex(string value)
    {
        var lastComma = value.LastIndexOf(',');
        var lastDot = value.LastIndexOf('.');

        if (lastComma >= 0 && lastDot >= 0)
        {
            return Math.Max(lastComma, lastDot);
        }

        var separatorIndex = Math.Max(lastComma, lastDot);
        if (separatorIndex < 0)
        {
            return -1;
        }

        var digitsAfterSeparator = value[(separatorIndex + 1)..].Count(char.IsDigit);
        return digitsAfterSeparator is > 0 and <= 2 ? separatorIndex : -1;
    }
}
