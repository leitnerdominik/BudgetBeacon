using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PTSManagerYC.Api.Infrastructure.Security;

namespace PTSManagerWeb.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly JwtTokenService _jwtTokenService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        IConfiguration configuration,
        JwtTokenService jwtTokenService,
        ILogger<AuthController> logger)
    {
        _configuration = configuration;
        _jwtTokenService = jwtTokenService;
        _logger = logger;
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public IActionResult Login([FromBody] LoginRequest request)
    {
        var authSettings = _configuration.GetSection("DemoAuth");
        var configuredEmail = authSettings["Email"];
        var configuredPassword = authSettings["Password"];

        if (string.IsNullOrWhiteSpace(configuredEmail) || string.IsNullOrWhiteSpace(configuredPassword))
        {
            _logger.LogError("DemoAuth credentials are not configured.");
            return this.ApiProblem(
                StatusCodes.Status500InternalServerError,
                "Authentication is unavailable",
                "Authentication is not configured on the server.",
                "urn:ptsmanager:auth-not-configured");
        }

        if (!string.Equals(request.Email, configuredEmail, StringComparison.OrdinalIgnoreCase) ||
            request.Password != configuredPassword)
        {
            _logger.LogWarning("Failed login attempt for {Email}.", request.Email);
            return this.ApiProblem(
                StatusCodes.Status401Unauthorized,
                "Login failed",
                "Invalid email or password.",
                "urn:ptsmanager:invalid-credentials");
        }

        var user = new AuthenticatedUser(
            Id: "demo-user",
            Email: configuredEmail,
            FirstName: authSettings["FirstName"] ?? "Demo",
            LastName: authSettings["LastName"] ?? "User"
        );

        _logger.LogInformation("User {Email} logged in successfully.", request.Email);

        return Ok(new LoginResponse(
            Token: _jwtTokenService.CreateToken(
                user.Id,
                user.Email,
                user.FirstName,
                user.LastName),
            User: user
        ));
    }

    public sealed record LoginRequest(
        [property: Required, EmailAddress] string Email,
        [property: Required, StringLength(200, MinimumLength = 6)] string Password
    );

    public sealed record LoginResponse(string Token, AuthenticatedUser User);

    public sealed record AuthenticatedUser(
        string Id,
        string Email,
        string FirstName,
        string LastName
    );
}
