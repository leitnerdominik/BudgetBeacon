using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using BudgetBeacon.Core.Entities;

namespace BudgetBeacon.Core.Services;

public static partial class TransactionImportFingerprint
{
    public static string Create(Transaction transaction)
    {
        var canonicalValue = string.Join(
            '\n',
            transaction.Date.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            transaction.Amount.ToString("G29", CultureInfo.InvariantCulture),
            NormalizeDescription(transaction.Metadata.RawDescription));

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
