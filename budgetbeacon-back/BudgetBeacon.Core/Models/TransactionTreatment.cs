namespace BudgetBeacon.Core.Models;

public static class TransactionTreatment
{
    public const string Income = "Income";
    public const string Expense = "Expense";
    public const string InternalTransfer = "InternalTransfer";
    public const string SavingsInvestment = "SavingsInvestment";
    public const string Refund = "Refund";
    public const string Adjustment = "Adjustment";

    public static readonly IReadOnlyList<string> Allowed =
    [
        Income,
        Expense,
        InternalTransfer,
        SavingsInvestment,
        Refund,
        Adjustment
    ];

    public static string? Normalize(string? treatment)
    {
        var normalized = treatment?.Trim();

        if (string.IsNullOrWhiteSpace(normalized))
        {
            return null;
        }

        return Allowed.FirstOrDefault(allowed =>
            string.Equals(allowed, normalized, StringComparison.OrdinalIgnoreCase));
    }

    public static string GetDefault(decimal amount, string? category)
    {
        if (string.Equals(category, "Income", StringComparison.OrdinalIgnoreCase) || amount > 0)
        {
            return Income;
        }

        if (string.Equals(category, "Transfers & Adjustments", StringComparison.OrdinalIgnoreCase))
        {
            return InternalTransfer;
        }

        if (string.Equals(category, "Savings & Investments", StringComparison.OrdinalIgnoreCase))
        {
            return SavingsInvestment;
        }

        return Expense;
    }
}
