using BudgetBeacon.Core.Entities;

namespace BudgetBeacon.Core.Models;

public enum TransactionTypeFilter
{
    All,
    Income,
    Expense
}

public enum TransactionSortField
{
    Date,
    Amount,
    Category,
    Description
}

public enum TransactionSortDirection
{
    Asc,
    Desc
}

public sealed record TransactionQueryOptions(
    DateTime? StartDate = null,
    DateTime? EndDate = null,
    string? SearchTerm = null,
    string? Category = null,
    TransactionTypeFilter TransactionType = TransactionTypeFilter.All,
    TransactionSortField SortBy = TransactionSortField.Date,
    TransactionSortDirection SortDirection = TransactionSortDirection.Desc);

public static class TransactionQuery
{
    public static IQueryable<Transaction> ApplyFilters(
        IQueryable<Transaction> query,
        TransactionQueryOptions options)
    {
        if (options.StartDate.HasValue)
        {
            query = query.Where(transaction => transaction.Date >= options.StartDate.Value);
        }

        if (options.EndDate.HasValue)
        {
            query = query.Where(transaction => transaction.Date <= options.EndDate.Value);
        }

        if (!string.IsNullOrWhiteSpace(options.Category))
        {
            query = query.Where(transaction => transaction.Category == options.Category);
        }

        query = options.TransactionType switch
        {
            TransactionTypeFilter.Income => query.Where(transaction => transaction.Amount > 0),
            TransactionTypeFilter.Expense => query.Where(transaction => transaction.Amount < 0),
            _ => query
        };

        var searchTerm = options.SearchTerm?.Trim().ToLowerInvariant();
        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            query = query.Where(transaction =>
                transaction.Metadata.RawDescription.ToLower().Contains(searchTerm) ||
                (transaction.Notes != null && transaction.Notes.ToLower().Contains(searchTerm)));
        }

        return query;
    }

    public static IQueryable<Transaction> ApplySorting(
        IQueryable<Transaction> query,
        TransactionQueryOptions options)
    {
        var descending = options.SortDirection == TransactionSortDirection.Desc;

        return options.SortBy switch
        {
            TransactionSortField.Amount => descending
                ? query.OrderByDescending(transaction => transaction.Amount)
                : query.OrderBy(transaction => transaction.Amount),
            TransactionSortField.Category => descending
                ? query.OrderByDescending(transaction => transaction.Category)
                    .ThenByDescending(transaction => transaction.Date)
                : query.OrderBy(transaction => transaction.Category)
                    .ThenByDescending(transaction => transaction.Date),
            TransactionSortField.Description => descending
                ? query.OrderByDescending(transaction => transaction.Metadata.RawDescription)
                    .ThenByDescending(transaction => transaction.Date)
                : query.OrderBy(transaction => transaction.Metadata.RawDescription)
                    .ThenByDescending(transaction => transaction.Date),
            _ => descending
                ? query.OrderByDescending(transaction => transaction.Date)
                : query.OrderBy(transaction => transaction.Date)
        };
    }
}
