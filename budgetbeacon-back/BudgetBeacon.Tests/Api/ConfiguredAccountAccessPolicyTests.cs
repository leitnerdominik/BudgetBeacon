using Microsoft.Extensions.Options;
using BudgetBeacon.Api.Infrastructure.Auth;

namespace BudgetBeacon.Tests.Api;

public sealed class ConfiguredAccountAccessPolicyTests
{
    [Fact]
    public void IsEmailAllowed_ReturnsTrueForConfiguredEmailRegardlessOfCaseOrWhitespace()
    {
        var policy = CreatePolicy("Owner@Example.com");

        var isAllowed = policy.IsEmailAllowed("  owner@example.COM  ");

        Assert.True(isAllowed);
    }

    [Fact]
    public void IsEmailAllowed_ReturnsFalseWhenAllowlistIsEmpty()
    {
        var policy = CreatePolicy();

        var isAllowed = policy.IsEmailAllowed("owner@example.com");

        Assert.False(isAllowed);
    }

    [Fact]
    public void IsEmailAllowed_ReturnsFalseForUnknownEmail()
    {
        var policy = CreatePolicy("owner@example.com");

        var isAllowed = policy.IsEmailAllowed("other@example.com");

        Assert.False(isAllowed);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void IsEmailAllowed_ReturnsFalseForBlankEmail(string? email)
    {
        var policy = CreatePolicy("owner@example.com");

        var isAllowed = policy.IsEmailAllowed(email);

        Assert.False(isAllowed);
    }

    [Fact]
    public void NormalizeEmail_TrimsAndLowercasesEmail()
    {
        var policy = CreatePolicy();

        var normalizedEmail = policy.NormalizeEmail("  Owner@Example.COM  ");

        Assert.Equal("owner@example.com", normalizedEmail);
    }

    private static ConfiguredAccountAccessPolicy CreatePolicy(params string[] allowedEmails)
    {
        return new ConfiguredAccountAccessPolicy(Options.Create(new AccountAccessOptions
        {
            AllowedEmails = allowedEmails
        }));
    }
}
