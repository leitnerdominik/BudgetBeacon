using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using PTSManagerWeb.Api.Controllers;
using PTSManagerYC.Core.Interfaces;
using PTSManagerYC.Core.Models;

namespace PTSManagerYC.Tests.Api;

public sealed class UserPreferencesControllerTests
{
    [Fact]
    public async Task Get_ReturnsPreferencesForCurrentUser()
    {
        var repository = new FakeUserPreferencesRepository
        {
            StoredPreferences = new UserPreferences
            {
                AiLocationContext = "Bolzano, South Tyrol, Italy"
            }
        };
        var controller = CreateController(repository);

        var result = await controller.Get();

        var ok = Assert.IsType<OkObjectResult>(result);
        var preferences = Assert.IsType<UserPreferences>(ok.Value);
        Assert.Equal("Bolzano, South Tyrol, Italy", preferences.AiLocationContext);
        Assert.Equal("user-1", repository.LastGetUserId);
    }

    [Fact]
    public async Task Update_SavesPreferencesForCurrentUser()
    {
        var repository = new FakeUserPreferencesRepository();
        var controller = CreateController(repository);

        var result = await controller.Update(
            new UserPreferencesController.UpdateUserPreferencesRequest("Merano, South Tyrol, Italy"));

        var ok = Assert.IsType<OkObjectResult>(result);
        var preferences = Assert.IsType<UserPreferences>(ok.Value);
        Assert.Equal("Merano, South Tyrol, Italy", preferences.AiLocationContext);
        Assert.Equal("user-1", repository.LastUpdateUserId);
        Assert.Equal("Merano, South Tyrol, Italy", repository.LastUpdatedAiLocationContext);
    }

    [Fact]
    public async Task Get_ReturnsUnauthorizedProblemWithoutAuthenticatedUser()
    {
        var controller = CreateController(new FakeUserPreferencesRepository(), userId: null);

        var result = await controller.Get();

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status401Unauthorized, objectResult.StatusCode);
    }

    private static UserPreferencesController CreateController(
        FakeUserPreferencesRepository repository,
        string? userId = "user-1")
    {
        var controller = new UserPreferencesController(repository);
        var httpContext = new DefaultHttpContext
        {
            TraceIdentifier = "test-trace-id"
        };
        httpContext.Request.Path = "/api/user/preferences";

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

    private sealed class FakeUserPreferencesRepository : IUserPreferencesRepository
    {
        public UserPreferences? StoredPreferences { get; init; } = new();
        public string? LastGetUserId { get; private set; }
        public string? LastUpdateUserId { get; private set; }
        public string? LastUpdatedAiLocationContext { get; private set; }

        public Task<UserPreferences?> GetAsync(string userId)
        {
            LastGetUserId = userId;
            return Task.FromResult(StoredPreferences);
        }

        public Task<string?> GetAiLocationContextAsync(string userId)
        {
            return Task.FromResult(StoredPreferences?.AiLocationContext);
        }

        public Task<UserPreferences?> UpdateAsync(string userId, string? aiLocationContext)
        {
            LastUpdateUserId = userId;
            LastUpdatedAiLocationContext = aiLocationContext;

            return Task.FromResult<UserPreferences?>(new UserPreferences
            {
                AiLocationContext = aiLocationContext
            });
        }
    }
}
