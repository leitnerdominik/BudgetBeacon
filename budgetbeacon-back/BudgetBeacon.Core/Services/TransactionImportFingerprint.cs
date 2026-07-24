using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace BudgetBeacon.Core.Services;

public static partial class TransactionImportFingerprint
{
    public static string Create(
        DateTime date,
        decimal amount,
        string? sourceDescription)
    {
        var canonicalValue = string.Join(
            '\n',
            date.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            amount.ToString("G29", CultureInfo.InvariantCulture),
            NormalizeDescription(sourceDescription));

        var hashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(canonicalValue));

        return Convert.ToHexString(hashBytes);
    }

    private static string NormalizeDescription(string? description)
    {
        var trimmed = (description ?? string.Empty).Trim();
        var whitespaceNormalized = WhitespaceRegex().Replace(trimmed, " ");

        return whitespaceNormalized.ToUpperInvariant();
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRegex();
}
