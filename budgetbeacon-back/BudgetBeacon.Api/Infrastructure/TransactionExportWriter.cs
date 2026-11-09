using System.Globalization;
using System.Text;
using System.Text.Json;
using BudgetBeacon.Core.Entities;

namespace BudgetBeacon.Api.Infrastructure;

public static class TransactionExportWriter
{
    public static async Task WriteAsync(Stream output, IAsyncEnumerable<Transaction> transactions,
        string format, CancellationToken cancellationToken)
    {
        if (format == "json")
        {
            await using var writer = new Utf8JsonWriter(output);
            writer.WriteStartArray();
            await foreach (var transaction in transactions.WithCancellation(cancellationToken))
            {
                writer.WriteStartObject();
                writer.WriteString("date", transaction.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
                writer.WriteString("description", transaction.Metadata.RawDescription);
                writer.WriteNumber("amount", transaction.Amount);
                writer.WriteString("category", transaction.Category);
                writer.WriteString("treatment", transaction.Treatment);
                if (transaction.Notes is null) writer.WriteNull("notes");
                else writer.WriteString("notes", transaction.Notes);
                writer.WriteEndObject();
                if (writer.BytesPending >= 16 * 1024) await writer.FlushAsync(cancellationToken);
            }
            writer.WriteEndArray();
            await writer.FlushAsync(cancellationToken);
            return;
        }

        await using var csv = new StreamWriter(output, new UTF8Encoding(true), leaveOpen: true);
        await csv.WriteAsync("date,description,amount,category,treatment,notes\r\n".AsMemory(), cancellationToken);
        await foreach (var transaction in transactions.WithCancellation(cancellationToken))
        {
            var fields = new[]
            {
                transaction.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                transaction.Metadata.RawDescription,
                transaction.Amount.ToString("0.00", CultureInfo.InvariantCulture),
                transaction.Category,
                transaction.Treatment,
                transaction.Notes ?? string.Empty
            };
            await csv.WriteAsync((string.Join(',', fields.Select((value, index) =>
                EscapeCsv(value, index is 1 or 3 or 4 or 5))) + "\r\n").AsMemory(), cancellationToken);
        }
        await csv.FlushAsync(cancellationToken);
    }

    private static string EscapeCsv(string value, bool protectFormula)
    {
        var first = value.TrimStart();
        if (protectFormula && first.Length > 0 && "=+-@".Contains(first[0])) value = "'" + value;
        return value.IndexOfAny([',', '"', '\r', '\n']) >= 0
            ? "\"" + value.Replace("\"", "\"\"") + "\""
            : value;
    }
}
