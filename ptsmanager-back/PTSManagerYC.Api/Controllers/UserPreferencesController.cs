using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PTSManagerYC.Core.Interfaces;

namespace PTSManagerWeb.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/user/preferences")]
public sealed class UserPreferencesController : ControllerBase
{
    private readonly IUserPreferencesRepository _repository;

    public UserPreferencesController(IUserPreferencesRepository repository)
    {
        _repository = repository;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return UnauthorizedProblem();
        }

        var preferences = await _repository.GetAsync(userId);
        if (preferences is null)
        {
            return UnauthorizedProblem();
        }

        return Ok(preferences);
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] UpdateUserPreferencesRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return UnauthorizedProblem();
        }

        var preferences = await _repository.UpdateAsync(userId, request.AiLocationContext);
        if (preferences is null)
        {
            return UnauthorizedProblem();
        }

        return Ok(preferences);
    }

    private IActionResult UnauthorizedProblem()
    {
        return this.ApiProblem(
            StatusCodes.Status401Unauthorized,
            "Authentication required",
            "A valid authenticated user is required to manage preferences.",
            "urn:ptsmanager:authentication-required");
    }

    private string? GetCurrentUserId()
    {
        return User.FindFirstValue(ClaimTypes.NameIdentifier);
    }

    public sealed record UpdateUserPreferencesRequest(
        [StringLength(120)] string? AiLocationContext
    );
}
