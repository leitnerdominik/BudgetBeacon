using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using BudgetBeacon.Api.Controllers;
using BudgetBeacon.Core.Interfaces;
using BudgetBeacon.Core.Models;

namespace BudgetBeacon.Tests.Api;

public sealed class UserPreferencesControllerTests
{
    [Fact]
    public async Task Get_ReturnsPreferencesForCurrentUser()
    {
        var repository = new FakeUserPreferencesRepository
        {
            StoredPreferences = new UserPreferences
            {
                AiLocationContext = "Bolzano, South Tyrol, Italy",
                TransactionImportBlacklistRules =
                [
                    new TransactionImportBlacklistRule
                    {
                        Type = TransactionImportBlacklistRule.LiteralType,
                        Value = "private phrase"
                    }
                ]
            }
        };
        var controller = CreateController(repository);

        var result = await controller.Get();

        var ok = Assert.IsType<OkObjectResult>(result);
        var preferences = Assert.IsType<UserPreferences>(ok.Value);
        Assert.Equal("Bolzano, South Tyrol, Italy", preferences.AiLocationContext);
        var rule = Assert.Single(preferences.TransactionImportBlacklistRules);
        Assert.Equal(TransactionImportBlacklistRule.LiteralType, rule.Type);
        Assert.Equal("private phrase", rule.Value);
        Assert.Equal("user-1", repository.LastGetUserId);
    }

    [Fact]
    public async Task Get_ReturnsDefaultPreferencesForCurrentUserWithoutSettingsRow()
    {
        var repository = new FakeUserPreferencesRepository
        {
            StoredPreferences = new UserPreferences()
        };
        var controller = CreateController(repository);

        var result = await controller.Get();

        var ok = Assert.IsType<OkObjectResult>(result);
        var preferences = Assert.IsType<UserPreferences>(ok.Value);
        Assert.Null(preferences.AiLocationContext);
        Assert.Empty(preferences.TransactionImportBlacklistRules);
        Assert.Equal("user-1", repository.LastGetUserId);
    }

    [Fact]
    public async Task Update_SavesPreferencesForCurrentUser()
    {
        var repository = new FakeUserPreferencesRepository();
        var controller = CreateController(repository);

        var result = await controller.Update(
            new UserPreferencesController.UpdateUserPreferencesRequest(
                "Merano, South Tyrol, Italy",
                [
                    new TransactionImportBlacklistRule
                    {
                        Type = " REGEX ",
                        Value = @"\bIBAN\s+[A-Z0-9]+"
                    }
                ]));

        var ok = Assert.IsType<OkObjectResult>(result);
        var preferences = Assert.IsType<UserPreferences>(ok.Value);
        Assert.Equal("Merano, South Tyrol, Italy", preferences.AiLocationContext);
        var rule = Assert.Single(preferences.TransactionImportBlacklistRules);
        Assert.Equal(TransactionImportBlacklistRule.RegexType, rule.Type);
        Assert.Equal(@"\bIBAN\s+[A-Z0-9]+", rule.Value);
        Assert.Equal("user-1", repository.LastUpdateUserId);
        Assert.Equal("Merano, South Tyrol, Italy", repository.LastUpdatedAiLocationContext);
        Assert.Same(repository.LastUpdatedRules, preferences.TransactionImportBlacklistRules);
    }

    [Fact]
    public async Task Update_ReturnsValidationProblemForInvalidRegexRule()
    {
        var repository = new FakeUserPreferencesRepository();
        var controller = CreateController(repository);

        var result = await controller.Update(
            new UserPreferencesController.UpdateUserPreferencesRequest(
                null,
                [
                    new TransactionImportBlacklistRule
                    {
                        Type = TransactionImportBlacklistRule.RegexType,
                        Value = "["
                    }
                ]));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var problem = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.Contains("TransactionImportBlacklistRules[0].Value", problem.Errors.Keys);
        Assert.Null(repository.LastUpdateUserId);
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
        public IReadOnlyList<TransactionImportBlacklistRule>? LastUpdatedRules { get; private set; }

        public Task<UserPreferences?> GetAsync(string userId)
        {
            LastGetUserId = userId;
            return Task.FromResult(StoredPreferences);
        }

        public Task<string?> GetAiLocationContextAsync(string userId)
        {
            return Task.FromResult(StoredPreferences?.AiLocationContext);
        }

        public Task<UserPreferences?> UpdateAsync(
            string userId,
            string? aiLocationContext,
            IReadOnlyList<TransactionImportBlacklistRule>? transactionImportBlacklistRules)
        {
            LastUpdateUserId = userId;
            LastUpdatedAiLocationContext = aiLocationContext;
            LastUpdatedRules = transactionImportBlacklistRules;

            return Task.FromResult<UserPreferences?>(new UserPreferences
            {
                AiLocationContext = aiLocationContext,
                TransactionImportBlacklistRules = transactionImportBlacklistRules ?? []
            });
        }
    }
}
