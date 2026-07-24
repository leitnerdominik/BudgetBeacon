namespace BudgetBeacon.Core.Services;

public static class FinancialValueValidator
{
    public const int StoragePrecision = 18;
    public const int StorageScale = 2;
    public const decimal MaximumAbsoluteAmount = 9_999_999_999_999.99m;

    public static readonly DateOnly MinimumSupportedDate = new(2000, 1, 1);
    public static readonly DateOnly MaximumSupportedDate = new(2100, 12, 31);

    public static FinancialValueValidationResult Validate(decimal amount, DateOnly date)
    {
        var amountErrors = new List<string>();
        var dateErrors = new List<string>();

        if (amount == 0)
        {
            amountErrors.Add("Amount must not be zero.");
        }

        if (amount < -MaximumAbsoluteAmount || amount > MaximumAbsoluteAmount)
        {
            amountErrors.Add(
                "Amount must be between -9,999,999,999,999.99 and 9,999,999,999,999.99.");
        }

        if (decimal.Round(amount, StorageScale) != amount)
        {
            amountErrors.Add("Amount must have no more than 2 decimal places.");
        }

        if (date < MinimumSupportedDate || date > MaximumSupportedDate)
        {
            dateErrors.Add("Date must be between 2000-01-01 and 2100-12-31.");
        }

        return new FinancialValueValidationResult(amountErrors, dateErrors);
    }

    public static FinancialValueValidationResult Validate(decimal amount, DateTime date) =>
        Validate(amount, DateOnly.FromDateTime(date));
}

public sealed record FinancialValueValidationResult(
    IReadOnlyList<string> AmountErrors,
    IReadOnlyList<string> DateErrors)
{
    public bool IsValid => AmountErrors.Count == 0 && DateErrors.Count == 0;
}
