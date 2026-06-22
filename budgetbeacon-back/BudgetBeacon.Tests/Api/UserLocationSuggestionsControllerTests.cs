using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using BudgetBeacon.Api.Controllers;
using BudgetBeacon.Core.Interfaces;
using BudgetBeacon.Core.Models;

namespace BudgetBeacon.Tests.Api;

public sealed class UserLocationSuggestionsControllerTests
{
    [Fact]
    public async Task Get_ReturnsUnauthorizedProblemWithoutAuthenticatedUser()
    {
        var service = new FakeLocationSuggestionService();
        var controller = CreateController(service, userId: null);

        var result = await controller.Get("Berlin", CancellationToken.None);

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status401Unauthorized, objectResult.StatusCode);
        Assert.Equal(0, service.SearchCalls);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Bo")]
    [InlineData("  B  ")]
    public async Task Get_ReturnsEmptyListForShortQuery(string? query)
    {
        var service = new FakeLocationSuggestionService();
        var controller = CreateController(service);

        var result = await controller.Get(query, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var suggestions = Assert.IsAssignableFrom<IEnumerable<object>>(ok.Value);
        Assert.Empty(suggestions);
        Assert.Equal(0, service.SearchCalls);
    }

    [Fact]
    public async Task Get_SearchesLocationsForValidQuery()
    {
        var service = new FakeLocationSuggestionService
        {
            Suggestions =
            [
                new LocationSuggestion(
                    "2950159",
                    "Berlin, Berlin, Germany",
                    "Berlin",
                    "Berlin",
                    "Germany",
                    "DE")
            ]
        };
        var controller = CreateController(service);

        var result = await controller.Get("  Berlin   Germany  ", CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var suggestion = Assert.Single(
            Assert.IsAssignableFrom<IReadOnlyList<LocationSuggestion>>(ok.Value));
        Assert.Equal("Berlin, Berlin, Germany", suggestion.Label);
        Assert.Equal("Berlin Germany", service.LastQuery);
        Assert.Equal(8, service.LastCount);
    }

    private static UserLocationSuggestionsController CreateController(
        FakeLocationSuggestionService service,
        string? userId = "user-1")
    {
        var controller = new UserLocationSuggestionsController(service);
        var httpContext = new DefaultHttpContext
        {
            TraceIdentifier = "test-trace-id"
        };
        httpContext.Request.Path = "/api/user/location-suggestions";

        if (userId is not null)
        {
            httpContext.User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, userId)],
                authenticationType: "UnitTest"));
        }

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = httpContext
        };

        return controller;
    }

    private sealed class FakeLocationSuggestionService : ILocationSuggestionService
    {
        public IReadOnlyList<LocationSuggestion> Suggestions { get; init; } = [];
        public int SearchCalls { get; private set; }
        public string? LastQuery { get; private set; }
        public int? LastCount { get; private set; }

        public Task<IReadOnlyList<LocationSuggestion>> SearchAsync(
            string query,
            int count,
            CancellationToken cancellationToken = default)
        {
            SearchCalls++;
            LastQuery = query;
            LastCount = count;
            return Task.FromResult(Suggestions);
        }
    }
}
