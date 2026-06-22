using System.Text.RegularExpressions;
using BudgetBeacon.Core.Exceptions;
using BudgetBeacon.Core.Models;

namespace BudgetBeacon.Core.Services;

public sealed partial class TransactionImportDescriptionRedactionService
{
    private static readonly TimeSpan RegexTimeout = TimeSpan.FromMilliseconds(100);

    public TransactionImportDescriptionRedactionResult Redact(
        string? description,
        IReadOnlyList<TransactionImportBlacklistRule> rules)
    {
        var originalDescription = description ?? string.Empty;
        var redactedDescription = originalDescription;

        foreach (var rule in rules)
        {
            if (string.IsNullOrWhiteSpace(rule.Value))
            {
                continue;
            }

            var pattern = rule.IsRegex ? rule.Value : Regex.Escape(rule.Value);
            try
            {
                redactedDescription = Regex.Replace(
                    redactedDescription,
                    pattern,
                    string.Empty,
                    RegexOptions.IgnoreCase | RegexOptions.CultureInvariant,
                    RegexTimeout);
            }
            catch (RegexMatchTimeoutException ex)
            {
                throw new InvalidInputException(
                    "One of your import blacklist regex rules took too long to evaluate. Update the rule and try again.",
                    ex);
            }
        }

        redactedDescription = WhitespaceRegex().Replace(redactedDescription, " ").Trim();

        return new TransactionImportDescriptionRedactionResult(
            redactedDescription,
            !string.Equals(originalDescription, redactedDescription, StringComparison.Ordinal));
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRegex();
}

public sealed record TransactionImportDescriptionRedactionResult(
    string Description,
    bool WasRedacted);
