using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Models;

namespace BudgetBeacon.Tests.Core;

public sealed class TransactionQueryTests
{
    [Fact]
    public void ApplyFilters_FiltersSearchCategoryTypeDateRangeAndExistingUserScope()
    {
        var transactions = new[]
        {
            CreateTransaction("user-1", new DateTime(2026, 1, 5), -25m, "Food & Groceries", "Corner Market", "Weekly food"),
            CreateTransaction("user-1", new DateTime(2026, 1, 8), 1200m, "Income", "Salary", null),
            CreateTransaction("user-1", new DateTime(2026, 2, 1), -30m, "Food & Groceries", "Corner Market", null),
            CreateTransaction("user-2", new DateTime(2026, 1, 6), -25m, "Food & Groceries", "Corner Market", "Weekly food")
        };
        var options = new TransactionQueryOptions(
            StartDate: new DateTime(2026, 1, 1),
            EndDate: new DateTime(2026, 1, 31),
            SearchTerm: "market",
            Category: "Food & Groceries",
            TransactionType: TransactionTypeFilter.Expense);

        var filtered = TransactionQuery.ApplyFilters(
                transactions.AsQueryable().Where(transaction => transaction.UserId == "user-1"),
                options)
            .ToList();

        var transaction = Assert.Single(filtered);
        Assert.Equal("Corner Market", transaction.Metadata.RawDescription);
        Assert.Equal("user-1", transaction.UserId);
    }

    [Theory]
    [InlineData(TransactionSortDirection.Asc, "-100,-25,10,300")]
    [InlineData(TransactionSortDirection.Desc, "300,10,-25,-100")]
    public void ApplySorting_SortsByAmountBeforePagination(
        TransactionSortDirection sortDirection,
        string expectedAmounts)
    {
        var transactions = new[]
        {
            CreateTransaction("user-1", new DateTime(2026, 1, 1), 10m, "Income", "B", null),
            CreateTransaction("user-1", new DateTime(2026, 1, 2), -100m, "Travel", "D", null),
            CreateTransaction("user-1", new DateTime(2026, 1, 3), 300m, "Income", "A", null),
            CreateTransaction("user-1", new DateTime(2026, 1, 4), -25m, "Food & Groceries", "C", null)
        };
        var options = new TransactionQueryOptions(
            SortBy: TransactionSortField.Amount,
            SortDirection: sortDirection);

        var amounts = TransactionQuery.ApplySorting(transactions.AsQueryable(), options)
            .Select(transaction => transaction.Amount.ToString("0"))
            .ToArray();

        Assert.Equal(expectedAmounts, string.Join(",", amounts));
    }

    [Fact]
    public void ApplySorting_DefaultsToNewestFirst()
    {
        var transactions = new[]
        {
            CreateTransaction("user-1", new DateTime(2026, 1, 1), 10m, "Income", "Old", null),
            CreateTransaction("user-1", new DateTime(2026, 1, 3), 20m, "Income", "New", null),
            CreateTransaction("user-1", new DateTime(2026, 1, 2), 30m, "Income", "Middle", null)
        };

        var descriptions = TransactionQuery.ApplySorting(
                transactions.AsQueryable(),
                new TransactionQueryOptions())
            .Select(transaction => transaction.Metadata.RawDescription)
            .ToArray();

        Assert.Equal(["New", "Middle", "Old"], descriptions);
    }

    private static Transaction CreateTransaction(
        string userId,
        DateTime date,
        decimal amount,
        string category,
        string description,
        string? notes) =>
        new()
        {
            UserId = userId,
            Date = date,
            Amount = amount,
            Category = category,
            Treatment = TransactionTreatment.GetDefault(amount, category),
            Notes = notes,
            Metadata = new TransactionMetadata
            {
                RawDescription = description
            }
        };
}
