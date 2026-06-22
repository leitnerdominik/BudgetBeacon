namespace BudgetBeacon.Core.Models;

public sealed record TransactionImportBlacklistRule
{
    public const string LiteralType = "literal";
    public const string RegexType = "regex";

    public string Type { get; init; } = LiteralType;
    public string Value { get; init; } = string.Empty;

    public bool IsLiteral => string.Equals(Type, LiteralType, StringComparison.OrdinalIgnoreCase);
    public bool IsRegex => string.Equals(Type, RegexType, StringComparison.OrdinalIgnoreCase);

    public static bool IsSupportedType(string? type) =>
        string.Equals(type, LiteralType, StringComparison.OrdinalIgnoreCase) ||
        string.Equals(type, RegexType, StringComparison.OrdinalIgnoreCase);
}
