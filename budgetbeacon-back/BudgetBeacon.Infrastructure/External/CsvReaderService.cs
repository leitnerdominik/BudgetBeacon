using System.Globalization;
using CsvHelper;
using CsvHelper.Configuration;
using CsvHelper.TypeConversion;
using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Exceptions;
using BudgetBeacon.Core.Interfaces;

namespace BudgetBeacon.Infrastructure.External;

public class CsvReaderService : ICsvReaderService
{
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

    public IEnumerable<Transaction> ParseTransactions(Stream stream, string? delimiter = null)
    {
        using var reader = new StreamReader(stream);
        var csvText = reader.ReadToEnd();
        var resolvedDelimiter = ResolveDelimiter(csvText, delimiter);

        var config = new CsvConfiguration(CultureInfo.GetCultureInfo("de-IT"))
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
            return csv.GetRecords<Transaction>().ToList();
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
        Map(m => m.ImportFingerprint).Ignore();
        Map(m => m.Metadata.AiConfidenceScore).Ignore();
        Map(m => m.Metadata.AiSuggestedCategory).Ignore();
    }
}

internal sealed class FlexibleAmountConverter : DefaultTypeConverter
{
    public override object ConvertFromString(string? text, IReaderRow row, MemberMapData memberMapData)
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
