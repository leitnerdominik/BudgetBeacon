using System.Globalization;
using CsvHelper;
using CsvHelper.Configuration;
using PTSManagerYC.Core.Entities;
using PTSManagerYC.Core.Exceptions;
using PTSManagerYC.Core.Interfaces;

namespace PTSManagerYC.Infrastructure.External;

public class CsvReaderService : ICsvReaderService
{
    public IEnumerable<Transaction> ParseTransactions(Stream stream)
    {
        var config = new CsvConfiguration(CultureInfo.GetCultureInfo("de-IT"))
        {
            HasHeaderRecord = true,
            Delimiter = ";",
            MissingFieldFound = null,
            BadDataFound = null,
            TrimOptions = TrimOptions.Trim
        };

        using var reader = new StreamReader(stream);
        using var csv = new CsvReader(reader, config);

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
}

public sealed class TransactionMap : ClassMap<Transaction>
{
    public TransactionMap()
    {
        Map(m => m.Id).Convert(args => Guid.NewGuid());

        Map(m => m.Date).Name("Datum", "Buchungstag", "Date");
        Map(m => m.Amount).Name("Betrag", "Umsatz", "Amount");

        Map(m => m.Metadata.RawDescription).Name("Verwendungszweck", "Beschreibung", "Description");

        Map(m => m.Category).Constant("Uncategorized");
        Map(m => m.Id).Ignore();
        Map(m => m.ImportFingerprint).Ignore();
        Map(m => m.Metadata.AiConfidenceScore).Ignore();
        Map(m => m.Metadata.AiSuggestedCategory).Ignore();
    }
}
