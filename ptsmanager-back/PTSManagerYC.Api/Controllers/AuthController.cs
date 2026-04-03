using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using PTSManagerYC.Infrastructure.Data;

namespace PTSManagerWeb.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        ILogger<AuthController> logger)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _logger = logger;
    }

    [AllowAnonymous]
    [HttpGet("csrf")]
    public IActionResult GetCsrfToken([FromServices] IAntiforgery antiforgery)
    {
        var tokens = antiforgery.GetAndStoreTokens(HttpContext);

        if (string.IsNullOrWhiteSpace(tokens.RequestToken))
        {
            return this.ApiProblem(
                StatusCodes.Status500InternalServerError,
                "CSRF token unavailable",
                "The server could not generate a CSRF token.",
                "urn:ptsmanager:csrf-token-unavailable");
        }

        return Ok(new CsrfTokenResponse(tokens.RequestToken));
    }

    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var existingUser = await _userManager.FindByEmailAsync(normalizedEmail);

        if (existingUser is not null)
        {
            return this.ApiProblem(
                StatusCodes.Status409Conflict,
                "Registration failed",
                "An account with this email already exists.",
                "urn:ptsmanager:email-already-registered");
        }

        var user = new ApplicationUser
        {
            UserName = normalizedEmail,
            Email = normalizedEmail,
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim()
        };

        var result = await _userManager.CreateAsync(user, request.Password);

        if (!result.Succeeded)
        {
            return this.ApiValidationProblem(
                "Registration failed",
                "The provided registration details are invalid.",
                errors =>
                {
                    foreach (var error in result.Errors)
                    {
                        errors.AddModelError(error.Code, error.Description);
                    }
                });
        }

        await _signInManager.SignInAsync(user, isPersistent: false);

        _logger.LogInformation("User {Email} registered successfully.", normalizedEmail);

        return Ok(new SessionResponse(ToAuthenticatedUser(user)));
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await _userManager.FindByEmailAsync(normalizedEmail);

        if (user is null)
        {
            _logger.LogWarning("Failed login attempt for unknown email {Email}.", normalizedEmail);
            return this.ApiProblem(
                StatusCodes.Status401Unauthorized,
                "Login failed",
                "Invalid email or password.",
                "urn:ptsmanager:invalid-credentials");
        }

        var result = await _signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);

        if (result.IsLockedOut)
        {
            _logger.LogWarning("Locked-out user {Email} attempted to log in.", normalizedEmail);
            return this.ApiProblem(
                StatusCodes.Status423Locked,
                "Account locked",
                "Too many failed login attempts. Please try again later.",
                "urn:ptsmanager:account-locked");
        }

        if (!result.Succeeded)
        {
            _logger.LogWarning("Failed login attempt for {Email}.", normalizedEmail);
            return this.ApiProblem(
                StatusCodes.Status401Unauthorized,
                "Login failed",
                "Invalid email or password.",
                "urn:ptsmanager:invalid-credentials");
        }

        await _signInManager.SignInAsync(user, isPersistent: request.RememberMe);

        _logger.LogInformation("User {Email} logged in successfully.", normalizedEmail);

        return Ok(new SessionResponse(ToAuthenticatedUser(user)));
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await _signInManager.SignOutAsync();
        return Ok(new { Message = "Logout successful" });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null)
        {
            return this.ApiProblem(
                StatusCodes.Status401Unauthorized,
                "Authentication required",
                "Your session is no longer valid. Please sign in again.",
                "urn:ptsmanager:authentication-required");
        }

        return Ok(new SessionResponse(ToAuthenticatedUser(user)));
    }

    public sealed record RegisterRequest(
        [Required, StringLength(100, MinimumLength = 2)] string FirstName,
        [Required, StringLength(100, MinimumLength = 2)] string LastName,
        [Required, EmailAddress] string Email,
        [Required, StringLength(200, MinimumLength = 8)] string Password
    );

    public sealed record LoginRequest(
        [Required, EmailAddress] string Email,
        [Required, StringLength(200, MinimumLength = 8)] string Password,
        bool RememberMe = false
    );

    public sealed record CsrfTokenResponse(string Token);
    public sealed record SessionResponse(AuthenticatedUser User);

    public sealed record AuthenticatedUser(
        string Id,
        string Email,
        string FirstName,
        string LastName
    );

    private static AuthenticatedUser ToAuthenticatedUser(ApplicationUser user)
    {
        return new AuthenticatedUser(
            user.Id,
            user.Email ?? string.Empty,
            user.FirstName,
            user.LastName);
    }
}
