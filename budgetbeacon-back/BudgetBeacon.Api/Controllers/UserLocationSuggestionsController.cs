using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BudgetBeacon.Core.Interfaces;
using BudgetBeacon.Core.Models;

namespace BudgetBeacon.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/user/location-suggestions")]
public sealed class UserLocationSuggestionsController : ControllerBase
{
    private const int MinimumQueryLength = 3;
    private const int MaxSuggestionCount = 8;
    private const int MaxQueryLength = 120;
    private readonly ILocationSuggestionService _locationSuggestionService;

    public UserLocationSuggestionsController(
        ILocationSuggestionService locationSuggestionService)
    {
        _locationSuggestionService = locationSuggestionService;
    }

    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] string? query,
        CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null)
        {
            return this.ApiProblem(
                StatusCodes.Status401Unauthorized,
                "Authentication required",
                "A valid authenticated user is required to search location suggestions.",
                "urn:budgetbeacon:authentication-required");
        }

        var normalizedQuery = NormalizeQuery(query);
        if (normalizedQuery.Length < MinimumQueryLength)
        {
            return Ok(Array.Empty<LocationSuggestion>());
        }

        if (normalizedQuery.Length > MaxQueryLength)
        {
            normalizedQuery = normalizedQuery[..MaxQueryLength].TrimEnd();
        }

        var suggestions = await _locationSuggestionService.SearchAsync(
            normalizedQuery,
            MaxSuggestionCount,
            cancellationToken);

        return Ok(suggestions);
    }

    private static string NormalizeQuery(string? value) =>
        string.Join(" ", (value ?? string.Empty)
            .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
}
