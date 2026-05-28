using PTSManagerYC.Core.Entities;
using PTSManagerYC.Core.Services;

namespace PTSManagerYC.Tests.Core;

public sealed class TransactionImportFingerprintTests
{
    [Fact]
    public void Create_ReturnsStableSha256HexFingerprint()
    {
        var transaction = CreateTransaction(
            new DateTime(2026, 4, 3),
            -12.34m,
            "Supermarkt Brixen");

        var fingerprint = TransactionImportFingerprint.Create(transaction);

        Assert.Equal(64, fingerprint.Length);
        Assert.Matches("^[0-9A-F]{64}$", fingerprint);
        Assert.Equal(fingerprint, TransactionImportFingerprint.Create(transaction));
    }

    [Fact]
    public void Create_NormalizesDescriptionCaseAndWhitespace()
    {
        var first = CreateTransaction(
            new DateTime(2026, 4, 3, 9, 30, 0),
            -12.3400m,
            "  Supermarkt   Brixen ");
        var second = CreateTransaction(
            new DateTime(2026, 4, 3, 23, 59, 0),
            -12.34m,
            "supermarkt\r\nbrixen");

        Assert.Equal(
            TransactionImportFingerprint.Create(first),
            TransactionImportFingerprint.Create(second));
    }

    [Theory]
    [InlineData("2026-04-04", "-12.34", "Supermarkt Brixen")]
    [InlineData("2026-04-03", "-12.35", "Supermarkt Brixen")]
    [InlineData("2026-04-03", "-12.34", "Different merchant")]
    public void Create_ChangesWhenCanonicalTransactionDataChanges(
        string date,
        string amount,
        string description)
    {
        var baseline = CreateTransaction(
            new DateTime(2026, 4, 3),
            -12.34m,
            "Supermarkt Brixen");
        var changed = CreateTransaction(
            DateTime.Parse(date, System.Globalization.CultureInfo.InvariantCulture),
            decimal.Parse(amount, System.Globalization.CultureInfo.InvariantCulture),
            description);

        Assert.NotEqual(
            TransactionImportFingerprint.Create(baseline),
            TransactionImportFingerprint.Create(changed));
    }

    private static Transaction CreateTransaction(DateTime date, decimal amount, string description)
    {
        return new Transaction
        {
            Date = date,
            Amount = amount,
            Metadata = new TransactionMetadata
            {
                RawDescription = description
            }
        };
    }
}
