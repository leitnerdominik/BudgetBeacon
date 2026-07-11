using BudgetBeacon.Core.Models;

namespace BudgetBeacon.Tests.Core;

public sealed class TransactionCategoriesTests
{
    [Fact]
    public void UserFacing_IncludesOtherAsLastCategory()
    {
        Assert.Equal("Other", TransactionCategories.UserFacing[^1]);
        Assert.Contains("Other", TransactionCategories.Allowed);
    }

    [Theory]
    [InlineData("other")]
    [InlineData("OTHER")]
    [InlineData("  Other  ")]
    public void NormalizeUserFacing_ReturnsCanonicalOther(string category)
    {
        Assert.Equal("Other", TransactionCategories.NormalizeUserFacing(category));
    }

    [Fact]
    public void Normalize_ReturnsCanonicalOther()
    {
        Assert.Equal("Other", TransactionCategories.Normalize(" other "));
    }
}
