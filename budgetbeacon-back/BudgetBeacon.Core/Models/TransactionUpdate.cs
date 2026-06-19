namespace BudgetBeacon.Core.Models;

public sealed class TransactionUpdate
{
    public DateTime Date { get; init; }
    public decimal Amount { get; init; }
    public string Description { get; init; } = string.Empty;
    public string Category { get; init; } = "Uncategorized";
    public string? Notes { get; init; }
}
