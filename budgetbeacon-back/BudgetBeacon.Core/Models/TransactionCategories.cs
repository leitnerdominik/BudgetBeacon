namespace BudgetBeacon.Core.Models;

public static class TransactionCategories
{
    public static readonly IReadOnlyList<string> UserFacing =
    [
        "Income",
        "Housing & Utilities",
        "Food & Groceries",
        "Eating Out",
        "Transport",
        "Health & Insurance",
        "Shopping & Personal",
        "Leisure & Hobbies",
        "Travel",
        "Subscriptions & Services",
        "Savings & Investments",
        "Transfers & Adjustments"
    ];

    public static readonly IReadOnlyList<string> Legacy =
    [
        "Transport",
        "Energy",
        "Groceries",
        "Lifestyle",
        "Housing",
        "Utilities",
        "Entertainment",
        "Health",
        "Subscriptions"
    ];

    public static readonly IReadOnlyList<string> Allowed =
        UserFacing.Concat(Legacy).Concat(["Uncategorized"]).ToArray();

    public static string? NormalizeUserFacing(string? category)
    {
        var normalized = category?.Trim();

        if (string.IsNullOrWhiteSpace(normalized))
            return null;

        return UserFacing.FirstOrDefault(allowed =>
            string.Equals(allowed, normalized, StringComparison.OrdinalIgnoreCase));
    }

    public static string? Normalize(string? category)
    {
        var normalized = category?.Trim();

        if (string.IsNullOrWhiteSpace(normalized))
            return null;

        return Allowed.FirstOrDefault(allowed =>
            string.Equals(allowed, normalized, StringComparison.OrdinalIgnoreCase));
    }
}
