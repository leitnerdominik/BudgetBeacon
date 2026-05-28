using Microsoft.AspNetCore.Identity;

namespace PTSManagerYC.Infrastructure.Data;

public class ApplicationUser : IdentityUser
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? AiLocationContext { get; set; }
}
