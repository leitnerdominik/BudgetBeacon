namespace BudgetBeacon.Core.Models;

public static class TransactionImportLimits
{
    public const int MaxRowCount = 10_000;
    public const string RowLimitExceededMessage =
        "The uploaded file contains more than the maximum 10,000 transactions. Split the file and import it in smaller batches.";
}
