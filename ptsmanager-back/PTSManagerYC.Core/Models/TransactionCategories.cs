namespace PTSManagerYC.Core.Models;

public static class TransactionCategories
{
    public static readonly IReadOnlyList<string> Allowed =
    [
        "Transport",
        "Energy",
        "Groceries",
        "Lifestyle",
        "Housing",
        "Utilities",
        "Entertainment",
        "Health",
        "Subscriptions",
        "Income",
        "Uncategorized"
    ];

    public static string? Normalize(string? category)
    {
        var normalized = category?.Trim();

        if (string.IsNullOrWhiteSpace(normalized))
            return null;

        return Allowed.FirstOrDefault(allowed =>
            string.Equals(allowed, normalized, StringComparison.OrdinalIgnoreCase));
    }
}
