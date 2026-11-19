using System.Security.Claims;
using BudgetBeacon.Core.Interfaces;
using BudgetBeacon.Core.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BudgetBeacon.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/transactions/ai")]
public sealed class SpendingFlexibilityReviewController(
    ISpendingFlexibilityReviewRepository repository, SpendingFlexibilityReviewService reviewService) : ControllerBase
{
    [HttpGet("flexibility-review-candidates")]
    public async Task<IActionResult> GetCandidates(CancellationToken cancellationToken)
    {
        if (User.FindFirstValue(ClaimTypes.NameIdentifier) is not { } userId)
            return AuthenticationRequired();

        var transactionIds = await repository.GetReviewCandidateIdsAsync(userId, cancellationToken);
        return Ok(new { TransactionIds = transactionIds });
    }

    [HttpPost("review-flexibility")]
    public async Task<IActionResult> ReviewBatch(
        [FromBody] ReviewBatchRequest? request, CancellationToken cancellationToken)
    {
        if (User.FindFirstValue(ClaimTypes.NameIdentifier) is not { } userId)
            return AuthenticationRequired();

        var ids = request?.TransactionIds ?? [];
        if (ids.Count is < 1 or > SpendingFlexibilityReviewService.MaxBatchSize ||
            ids.Contains(Guid.Empty) || ids.Distinct().Count() != ids.Count)
        {
            return this.ApiValidationProblem(
                "Invalid flexibility review batch",
                "Provide between 1 and 10 unique, non-empty transaction IDs.",
                errors => errors.AddModelError(nameof(ReviewBatchRequest.TransactionIds),
                    "Transaction IDs must contain between 1 and 10 unique, non-empty values."));
        }

        var result = await reviewService.TryReviewBatchAsync(userId, ids, cancellationToken);
        if (result is null)
        {
            return this.ApiProblem(StatusCodes.Status409Conflict, "Flexibility review in progress",
                "A spending flexibility batch is already running. Try again shortly.",
                "urn:budgetbeacon:flexibility-review-in-progress");
        }

        return Ok(result);
    }

    private ObjectResult AuthenticationRequired() =>
        this.ApiProblem(StatusCodes.Status401Unauthorized, "Authentication required",
            "A valid authenticated session is required to review spending flexibility.",
            "urn:budgetbeacon:authentication-required");

    public sealed record ReviewBatchRequest(IReadOnlyList<Guid>? TransactionIds);
}
