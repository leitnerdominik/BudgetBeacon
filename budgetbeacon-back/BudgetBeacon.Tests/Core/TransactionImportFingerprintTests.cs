using BudgetBeacon.Core.Services;

namespace BudgetBeacon.Tests.Core;

public sealed class TransactionImportFingerprintTests
{
    [Fact]
    public void Create_ReturnsStableSha256HexFingerprint()
    {
        var date = new DateTime(2026, 4, 3);
        const decimal amount = -12.34m;
        const string description = "Supermarkt Brixen";

        var fingerprint = TransactionImportFingerprint.Create(
            date,
            amount,
            description);

        Assert.Equal(64, fingerprint.Length);
        Assert.Matches("^[0-9A-F]{64}$", fingerprint);
        Assert.Equal(
            fingerprint,
            TransactionImportFingerprint.Create(date, amount, description));
    }

    [Fact]
    public void Create_NormalizesDescriptionCaseAndWhitespace()
    {
        Assert.Equal(
            TransactionImportFingerprint.Create(
                new DateTime(2026, 4, 3, 9, 30, 0),
                -12.3400m,
                "  Supermarkt   Brixen "),
            TransactionImportFingerprint.Create(
                new DateTime(2026, 4, 3, 23, 59, 0),
                -12.34m,
                "supermarkt\r\nbrixen"));
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
        var baseline = TransactionImportFingerprint.Create(
            new DateTime(2026, 4, 3),
            -12.34m,
            "Supermarkt Brixen");
        var changed = TransactionImportFingerprint.Create(
            DateTime.Parse(date, System.Globalization.CultureInfo.InvariantCulture),
            decimal.Parse(amount, System.Globalization.CultureInfo.InvariantCulture),
            description);

        Assert.NotEqual(baseline, changed);
    }
}
