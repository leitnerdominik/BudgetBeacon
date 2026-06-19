namespace BudgetBeacon.Core.Models;

public sealed class SavingsTip
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Impact { get; set; } = "Medium";
    public string Category { get; set; } = "Lifestyle";
}
