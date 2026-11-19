using System.Security.Claims;
using BudgetBeacon.Api.Infrastructure;
using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BudgetBeacon.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/user/spending-flexibility-rules")]
public sealed class SpendingFlexibilityRulesController(ISpendingFlexibilityRuleRepository repository)
    : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        if (User.FindFirstValue(ClaimTypes.NameIdentifier) is not { } userId)
            return UnauthorizedProblem();

        var rules = await repository.GetAsync(userId, cancellationToken);
        return Ok(rules.Select(ToResponse));
    }

    [HttpPost]
    public Task<IActionResult> Create(
        [FromBody] WriteRuleRequest request, CancellationToken cancellationToken) =>
        SaveAsync(null, request, cancellationToken);

    [HttpPut("{ruleId:guid}")]
    public Task<IActionResult> Update(
        Guid ruleId, [FromBody] WriteRuleRequest request, CancellationToken cancellationToken) =>
        SaveAsync(ruleId, request, cancellationToken);

    [HttpDelete("{ruleId:guid}")]
    public async Task<IActionResult> Delete(Guid ruleId, CancellationToken cancellationToken)
    {
        if (User.FindFirstValue(ClaimTypes.NameIdentifier) is not { } userId)
            return UnauthorizedProblem();

        return await repository.DeleteAsync(userId, ruleId, cancellationToken)
            ? NoContent()
            : RuleNotFoundProblem();
    }

    private async Task<IActionResult> SaveAsync(
        Guid? ruleId, WriteRuleRequest request, CancellationToken cancellationToken)
    {
        if (User.FindFirstValue(ClaimTypes.NameIdentifier) is not { } userId)
            return UnauthorizedProblem();

        var value = SpendingFlexibilityRuleInput.ParseClass(request.SpendingFlexibility);
        if (value is null)
        {
            return InvalidRule(nameof(request.SpendingFlexibility),
                "Choose Essential, Optimizable, Optional, or Unclassified.");
        }

        var input = new SpendingFlexibilityRuleInput(request.MatchType, request.Pattern);
        var error = input.Validate(userId, value, out var rule);
        if (error is { } invalid)
            return InvalidRule(invalid.Field, invalid.Message);

        if (ruleId is { } id)
        {
            return await repository.UpdateAsync(id, rule!, cancellationToken)
                ? NoContent()
                : RuleNotFoundProblem();
        }

        await repository.AddAsync(rule!, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, ToResponse(rule!));
    }

    private IActionResult UnauthorizedProblem() =>
        this.ApiProblem(
            StatusCodes.Status401Unauthorized,
            "Authentication required",
            "A valid authenticated user is required to manage financial flexibility rules.",
            "urn:budgetbeacon:authentication-required");

    private IActionResult RuleNotFoundProblem() =>
        this.ApiProblem(
            StatusCodes.Status404NotFound,
            "Financial flexibility rule not found",
            "The requested rule could not be found for the current user.",
            "urn:budgetbeacon:spending-flexibility-rule-not-found");

    private IActionResult InvalidRule(string field, string error) =>
        this.ApiValidationProblem(
            "Invalid financial flexibility rule",
            "Check the rule settings and try again.",
            errors => errors.AddModelError(field, error));

    private static RuleResponse ToResponse(SpendingFlexibilityRule rule) =>
        new(rule.Id, rule.MatchType.ToString(), rule.Pattern, rule.SpendingFlexibility.ToString());

    public sealed record WriteRuleRequest(string? MatchType, string? Pattern, string? SpendingFlexibility);
    public sealed record RuleResponse(Guid Id, string MatchType, string Pattern, string SpendingFlexibility);
}
