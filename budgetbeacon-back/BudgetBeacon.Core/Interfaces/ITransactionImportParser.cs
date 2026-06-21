using BudgetBeacon.Core.Entities;
using System.IO;

namespace BudgetBeacon.Core.Interfaces
{
    public interface ITransactionImportParser
    {
        IEnumerable<Transaction> ParseCsvTransactions(Stream fileStream, string? delimiter = null);

        IEnumerable<Transaction> ParseXlsxTransactions(
            Stream fileStream,
            TransactionImportMapping mapping);
    }

    public sealed record TransactionImportMapping(
        bool HasHeaderRow,
        int? DateColumnIndex,
        int? AmountColumnIndex,
        int? DescriptionColumnIndex);
}
