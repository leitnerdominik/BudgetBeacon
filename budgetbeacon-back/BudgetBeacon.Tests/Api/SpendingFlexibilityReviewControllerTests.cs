using System.Security.Claims;
using BudgetBeacon.Api.Controllers;
using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Interfaces;
using BudgetBeacon.Core.Models;
using BudgetBeacon.Core.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace BudgetBeacon.Tests.Api;

public sealed class SpendingFlexibilityReviewControllerTests
{
    [Fact]
    public async Task ReviewBatch_ValidatesIdsAndUsesAuthenticatedOwner()
    {
        var store = new ReviewStore();
        var controller = CreateController(store, new WaitingAdvisor(), "owner");
        var id = Guid.NewGuid();
        Assert.IsType<BadRequestObjectResult>(await controller.ReviewBatch(new([id, id]), default));
        Assert.IsType<BadRequestObjectResult>(await controller.ReviewBatch(new([Guid.Empty]), default));
        var oversized = Enumerable.Range(0, 11).Select(_ => Guid.NewGuid()).ToArray();
        Assert.IsType<BadRequestObjectResult>(await controller.ReviewBatch(new(oversized), default));
        Assert.Null(store.LastOwner);

        var response = Assert.IsType<OkObjectResult>(await controller.ReviewBatch(new([id]), default));
        Assert.Equal(new SpendingFlexibilityReviewBatch(0, 0, 0, 1), response.Value);
        Assert.Equal("owner", store.LastOwner);

        var anonymous = CreateController(store, new WaitingAdvisor(), null);
        var unauthorized = Assert.IsType<ObjectResult>(await anonymous.ReviewBatch(new([id]), default));
        Assert.Equal(StatusCodes.Status401Unauthorized, unauthorized.StatusCode);
    }

    [Fact]
    public async Task ReviewBatch_BlocksOverlapPerUserAndReleasesGuardOnCancellation()
    {
        var candidate = new Transaction { Category = "Other" };
        var store = new ReviewStore(candidate);
        var advisor = new WaitingAdvisor();
        var owner = Guid.NewGuid().ToString();
        var controller = CreateController(store, advisor, owner);
        var request = new SpendingFlexibilityReviewController.ReviewBatchRequest([candidate.Id]);
        using var cancellation = new CancellationTokenSource();
        var pending = controller.ReviewBatch(request, cancellation.Token);
        await advisor.Started.Task.WaitAsync(TimeSpan.FromSeconds(5));

        var overlap = CreateController(store, advisor, owner);
        var conflict = Assert.IsType<ObjectResult>(await overlap.ReviewBatch(request, default));
        Assert.Equal(StatusCodes.Status409Conflict, conflict.StatusCode);

        await cancellation.CancelAsync();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => pending);
        Assert.Equal(0, store.SaveCalls);

        advisor.Response.SetResult([new SpendingFlexibilityReview(candidate.Id, null)]);
        var retry = Assert.IsType<OkObjectResult>(await overlap.ReviewBatch(request, default));
        Assert.Equal(new SpendingFlexibilityReviewBatch(0, 1, 0, 0), retry.Value);
        Assert.Equal(1, store.SaveCalls);
    }

    private static SpendingFlexibilityReviewController CreateController(
        ReviewStore store, WaitingAdvisor advisor, string? owner)
    {
        var claims = owner is null ? Array.Empty<Claim>() : [new Claim(ClaimTypes.NameIdentifier, owner)];
        return new SpendingFlexibilityReviewController(store, new SpendingFlexibilityReviewService(store, advisor))
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims)) }
            }
        };
    }

    private sealed class ReviewStore(Transaction? candidate = null) : ISpendingFlexibilityReviewRepository
    {
        public string? LastOwner { get; private set; }
        public int SaveCalls { get; private set; }

        public Task<IReadOnlyList<Guid>> GetReviewCandidateIdsAsync(string userId, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<IReadOnlyList<Transaction>> GetReviewCandidatesAsync(
            string userId, IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken)
        {
            LastOwner = userId;
            return Task.FromResult<IReadOnlyList<Transaction>>(candidate is null ? [] : [candidate]);
        }

        public Task<SpendingFlexibilityReviewBatch> ApplySpendingFlexibilityReviewsAsync(
            string userId, IReadOnlyList<Transaction> originals, IReadOnlyList<SpendingFlexibilityReview> reviews,
            CancellationToken cancellationToken)
        {
            SaveCalls++;
            Assert.Null(Assert.Single(reviews).Assessment);
            return Task.FromResult(new SpendingFlexibilityReviewBatch(0, 1, 0, 0));
        }
    }

    private sealed class WaitingAdvisor : IAiAdvisorService
    {
        public TaskCompletionSource Started { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource<IReadOnlyList<SpendingFlexibilityReview>> Response { get; } =
            new(TaskCreationOptions.RunContinuationsAsynchronously);

        public Task<IReadOnlyList<SpendingFlexibilityReview>> ReviewSpendingFlexibilityAsync(
            IReadOnlyList<Transaction> transactions, CancellationToken cancellationToken = default)
        {
            Started.TrySetResult();
            return Response.Task.WaitAsync(cancellationToken);
        }

        public Task<TransactionCategorizationResult> CategorizeTransactionsAsync(
            List<Transaction> transactions, string? aiLocationContext = null, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<IReadOnlyList<SavingsTip>> GetSavingTipsAsync(
            SavingsTipsSummary summary, string? aiLocationContext = null, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
    }
}
