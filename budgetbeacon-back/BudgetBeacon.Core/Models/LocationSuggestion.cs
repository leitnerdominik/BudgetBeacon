namespace BudgetBeacon.Core.Models;

public sealed record LocationSuggestion(
    string Id,
    string Label,
    string Name,
    string? Admin1,
    string Country,
    string CountryCode);
