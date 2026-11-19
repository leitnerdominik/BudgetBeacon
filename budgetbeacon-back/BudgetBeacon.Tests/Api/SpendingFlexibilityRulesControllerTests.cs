using System.Security.Claims;
using BudgetBeacon.Api.Controllers;
using BudgetBeacon.Api.Infrastructure;
using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Exceptions;
using BudgetBeacon.Core.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;

namespace BudgetBeacon.Tests.Api;

public sealed class SpendingFlexibilityRulesControllerTests
{
    [Fact]
    public async Task AuthenticatedUser_CanManageOnlyOwnRules()
    {
        var repository = new FakeSpendingFlexibilityRuleRepository();
        var alice = CreateController(repository, "alice");
        var bob = CreateController(repository, "bob");
        var request = new SpendingFlexibilityRulesController.WriteRuleRequest("Prefix", " café\u00a0  bar ", "Optional");

        var result = Assert.IsType<ObjectResult>(await alice.Create(request, default));
        Assert.Equal(StatusCodes.Status201Created, result.StatusCode);
        var rule = Assert.IsType<SpendingFlexibilityRulesController.RuleResponse>(result.Value);
        Assert.Equal("café bar", rule.Pattern);
        Assert.Equal("alice", Assert.Single(await repository.GetAsync("alice", default)).UserId);
        Assert.Empty(Assert.IsAssignableFrom<IEnumerable<SpendingFlexibilityRulesController.RuleResponse>>(
            Assert.IsType<OkObjectResult>(await bob.Get(default)).Value));
        Assert.Equal(StatusCodes.Status404NotFound, Assert.IsType<ObjectResult>(
            await bob.Update(rule.Id, request, default)).StatusCode);
        Assert.Equal(StatusCodes.Status404NotFound, Assert.IsType<ObjectResult>(
            await bob.Delete(rule.Id, default)).StatusCode);

        Assert.IsType<NoContentResult>(await alice.Update(rule.Id,
            new("Exact", " Café Bar 2 ", "Unclassified"), default));
        var edited = Assert.Single(Assert.IsAssignableFrom<IEnumerable<SpendingFlexibilityRulesController.RuleResponse>>(
            Assert.IsType<OkObjectResult>(await alice.Get(default)).Value));
        Assert.Equal(rule.Id, edited.Id);
        Assert.Equal(("Exact", "Café Bar 2", "Unclassified"), (edited.MatchType, edited.Pattern, edited.SpendingFlexibility));

        Assert.IsType<NoContentResult>(await alice.Delete(rule.Id, default));
        Assert.Empty(await repository.GetAsync("alice", default));
    }

    [Theory]
    [InlineData("99", "Groceries", "Essential", "MatchType")]
    [InlineData("Exact", "Groceries", "99", "SpendingFlexibility")]
    [InlineData("Exact", "Groceries", "UseAutomatic", "SpendingFlexibility")]
    [InlineData("Prefix", " \t ", "Essential", "Pattern")]
    [InlineData("Prefix", "NUL\0Character", "Essential", "Pattern")]
    public async Task Write_RejectsInvalidRules(string type, string pattern, string value, string field)
    {
        var repository = new FakeSpendingFlexibilityRuleRepository();
        var controller = CreateController(repository, "alice");
        var response = Assert.IsType<BadRequestObjectResult>(
            await controller.Create(new(type, pattern, value), default));
        Assert.Contains(field, Assert.IsType<ValidationProblemDetails>(response.Value).Errors.Keys);
        Assert.Empty(await repository.GetAsync("alice", default));
    }

    [Fact]
    public async Task DuplicateRule_ReturnsConflictProblem()
    {
        var context = new DefaultHttpContext();
        await using var response = new MemoryStream();
        context.Response.Body = response;
        var handler = new GlobalExceptionHandler(NullLogger<GlobalExceptionHandler>.Instance);

        Assert.True(await handler.TryHandleAsync(context, new DuplicateSpendingFlexibilityRuleException(), default));
        Assert.Equal(StatusCodes.Status409Conflict, context.Response.StatusCode);
        response.Position = 0;
        using var body = await System.Text.Json.JsonDocument.ParseAsync(response);
        Assert.Equal("urn:budgetbeacon:duplicate-spending-flexibility-rule",
            body.RootElement.GetProperty("type").GetString());
    }

    private static SpendingFlexibilityRulesController CreateController(
        ISpendingFlexibilityRuleRepository repository, string userId) =>
        new(repository)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                        [new Claim(ClaimTypes.NameIdentifier, userId)], "UnitTest"))
                }
            }
        };
}

internal sealed class FakeSpendingFlexibilityRuleRepository : ISpendingFlexibilityRuleRepository
{
    private readonly Dictionary<Guid, SpendingFlexibilityRule> _rules = new();
    public Exception? ReadError { get; init; }

    public Task<IReadOnlyList<SpendingFlexibilityRule>> GetAsync(string userId, CancellationToken cancellationToken) =>
        ReadError is { } error
            ? Task.FromException<IReadOnlyList<SpendingFlexibilityRule>>(error)
            : Task.FromResult<IReadOnlyList<SpendingFlexibilityRule>>(_rules.Values
                .Where(rule => rule.UserId == userId)
                .ToList());

    public Task AddAsync(SpendingFlexibilityRule rule, CancellationToken cancellationToken)
    {
        _rules.Add(rule.Id, rule);
        return Task.CompletedTask;
    }

    public Task<bool> UpdateAsync(Guid ruleId, SpendingFlexibilityRule rule, CancellationToken cancellationToken)
    {
        if (!_rules.TryGetValue(ruleId, out var current) || current.UserId != rule.UserId)
            return Task.FromResult(false);

        _rules[ruleId] = new SpendingFlexibilityRule(rule.UserId, rule.MatchType, rule.Pattern, rule.SpendingFlexibility)
        {
            Id = ruleId
        };
        return Task.FromResult(true);
    }

    public Task<bool> DeleteAsync(string userId, Guid ruleId, CancellationToken cancellationToken) =>
        Task.FromResult(_rules.TryGetValue(ruleId, out var current) &&
            current.UserId == userId && _rules.Remove(ruleId));
}
