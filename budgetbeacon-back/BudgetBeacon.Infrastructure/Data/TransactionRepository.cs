using Microsoft.EntityFrameworkCore;
using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Interfaces;
using BudgetBeacon.Core.Models;
using BudgetBeacon.Core.Services;
using System.Runtime.CompilerServices;
using System.Text.Json;
using Npgsql;
using NpgsqlTypes;

namespace BudgetBeacon.Infrastructure.Data;

public class TransactionRepository : ITransactionRepository, ISpendingFlexibilityReviewRepository
{
    private readonly BudgetBeaconDbContext _context;

    public TransactionRepository(BudgetBeaconDbContext context)
    {
        _context = context;
    }

    public async Task AddAsync(
        Transaction transaction, SpendingFlexibilityRule? newRule, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(transaction.Treatment))
            transaction.Treatment = TransactionTreatment.GetDefault(transaction.Amount, transaction.Category);

        await using var operation = newRule is null
            ? null
            : await _context.Database.BeginTransactionAsync(cancellationToken);
        _context.Transactions.Add(transaction);

        await SaveTransactionAsync(transaction.UserId, newRule, cancellationToken);
        if (operation is not null)
            await operation.CommitAsync(cancellationToken);
    }

    public async Task<int> AddImportedTransactionsAsync(IEnumerable<Transaction> transactions)
    {
        var transactionList = transactions.ToList();
        if (transactionList.Any(transaction =>
                string.IsNullOrWhiteSpace(transaction.ImportFingerprint)))
        {
            throw new InvalidOperationException(
                "Imported transactions must have a source fingerprint before persistence.");
        }

        var transactionRows = transactionList
            .Select(transaction =>
            {
                return new ImportedTransactionRow
                {
                    Id = transaction.Id,
                    UserId = transaction.UserId,
                    Date = transaction.Date.ToUniversalTime(),
                    Amount = transaction.Amount,
                    Category = transaction.Category,
                    Treatment = string.IsNullOrWhiteSpace(transaction.Treatment)
                        ? TransactionTreatment.GetDefault(transaction.Amount, transaction.Category)
                        : transaction.Treatment,
                    Notes = transaction.Notes,
                    ImportFingerprint = transaction.ImportFingerprint,
                    Metadata = transaction.Metadata
                };
            })
            .ToList();

        if (transactionRows.Count == 0)
            return 0;

        var payload = JsonSerializer.Serialize(transactionRows);
        var parameter = new NpgsqlParameter("transactions", NpgsqlDbType.Jsonb)
        {
            Value = payload
        };

        // Database defaults start imported transactions without an override, AI suggestion or review.
        const string sql = """
            INSERT INTO "Transactions" ("Id", "UserId", "Date", "Amount", "Category", "Treatment", "Notes", "ImportFingerprint", "Metadata")
            SELECT
                input."Id",
                input."UserId",
                input."Date",
                input."Amount",
                input."Category",
                input."Treatment",
                input."Notes",
                input."ImportFingerprint",
                input."Metadata"
            FROM jsonb_to_recordset(@transactions) AS input(
                "Id" uuid,
                "UserId" text,
                "Date" timestamp with time zone,
                "Amount" numeric,
                "Category" text,
                "Treatment" character varying(32),
                "Notes" character varying(500),
                "ImportFingerprint" character varying(64),
                "Metadata" jsonb
            )
            ON CONFLICT ("UserId", "ImportFingerprint") WHERE "ImportFingerprint" IS NOT NULL DO NOTHING;
            """;

        return await _context.Database.ExecuteSqlRawAsync(sql, parameter);
    }

    public async Task<IReadOnlySet<string>> GetExistingImportFingerprintsAsync(
        string userId,
        IReadOnlyCollection<string> importFingerprints)
    {
        if (importFingerprints.Count == 0)
        {
            return new HashSet<string>(StringComparer.Ordinal);
        }

        var fingerprints = await _context.Transactions
            .Where(transaction =>
                transaction.UserId == userId &&
                transaction.ImportFingerprint != null &&
                importFingerprints.Contains(transaction.ImportFingerprint))
            .Select(transaction => transaction.ImportFingerprint!)
            .ToListAsync();

        return fingerprints.ToHashSet(StringComparer.Ordinal);
    }

    public async Task<bool> DeleteAsync(string userId, Guid transactionId)
    {
        var transaction = await _context.Transactions
            .SingleOrDefaultAsync(candidate => candidate.Id == transactionId && candidate.UserId == userId);

        if (transaction is null)
            return false;

        _context.Transactions.Remove(transaction);
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<Transaction?> GetByIdAsync(string userId, Guid transactionId)
    {
        return await _context.Transactions.AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.Id == transactionId && candidate.UserId == userId);
    }

    public async Task<IReadOnlyList<Transaction>> ApplyCategorizationAsync(
        string userId,
        IReadOnlyList<Transaction> originals,
        IReadOnlyList<TransactionCategorization> suggestions,
        CancellationToken cancellationToken = default)
    {
        if (suggestions.Count == 0)
            return [];

        var originalById = originals.ToDictionary(transaction => transaction.Id);
        var suggestionById = suggestions.ToDictionary(suggestion => suggestion.TransactionId);
        var ids = suggestions.Select(suggestion => suggestion.TransactionId).ToArray();

        // Take locks only after the provider returns, and compare against the rows now held for update.
        await using var operation = await _context.Database.BeginTransactionAsync(cancellationToken);
        var currentRows = await LockTransactionsAsync(userId, ids, cancellationToken);
        var applied = new List<Transaction>();
        foreach (var current in currentRows)
        {
            if (!originalById.TryGetValue(current.Id, out var original) ||
                !current.MatchesCategorizationBasis(original))
            {
                continue;
            }

            current.ApplyCategorization(suggestionById[current.Id]);
            applied.Add(current);
        }

        await _context.SaveChangesAsync(cancellationToken);
        await operation.CommitAsync(cancellationToken);
        return applied;
    }

    public Task<Transaction?> UpdateAsync(
        string userId, Guid transactionId, TransactionUpdate update,
        SpendingFlexibilityRule? newRule, CancellationToken cancellationToken) =>
        UpdateLockedAsync(userId, transactionId, transaction => transaction.ApplyUpdate(update), newRule, cancellationToken);

    public async Task<IReadOnlyList<Guid>> GetReviewCandidateIdsAsync(
        string userId, CancellationToken cancellationToken)
    {
        var ids = new List<Guid>();
        await foreach (var candidate in StreamReviewCandidatesAsync(userId, null, cancellationToken))
            ids.Add(candidate.Id);

        return ids;
    }

    public async Task<IReadOnlyList<Transaction>> GetReviewCandidatesAsync(
        string userId, IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken)
    {
        var candidates = new List<Transaction>();
        await foreach (var candidate in StreamReviewCandidatesAsync(userId, ids, cancellationToken))
            candidates.Add(candidate);

        return candidates;
    }

    private async IAsyncEnumerable<Transaction> StreamReviewCandidatesAsync(
        string userId, IReadOnlyCollection<Guid>? ids, [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var rules = await SpendingFlexibilityRuleRepository.GetForUserAsync(_context, userId, cancellationToken);
        var query = _context.Transactions.AsNoTracking().Where(transaction =>
            transaction.UserId == userId &&
            transaction.Category != "Uncategorized" &&
            transaction.ManualSpendingFlexibility == null &&
            !transaction.AiFlexibilityAbstained);

        if (ids is not null)
            query = query.Where(transaction => ids.Contains(transaction.Id));

        await foreach (var transaction in query.OrderByDescending(candidate => candidate.Date)
            .ThenByDescending(candidate => candidate.Id).AsAsyncEnumerable().WithCancellation(cancellationToken))
        {
            if (SpendingFlexibilityResolver.NeedsReview(transaction, rules))
                yield return transaction;
        }
    }

    public async Task<SpendingFlexibilityReviewBatch> ApplySpendingFlexibilityReviewsAsync(
        string userId, IReadOnlyList<Transaction> originals, IReadOnlyList<SpendingFlexibilityReview> reviews,
        CancellationToken cancellationToken)
    {
        var originalById = originals.ToDictionary(transaction => transaction.Id);
        var reviewById = reviews.ToDictionary(review => review.TransactionId);
        var ids = originalById.Keys.ToArray();
        await using var operation = await _context.Database.BeginTransactionAsync(cancellationToken);
        var currentRows = await LockTransactionsAsync(userId, ids, cancellationToken);
        await SpendingFlexibilityRuleRepository.LockUserRulesAsync(_context, userId, cancellationToken);
        var rules = await SpendingFlexibilityRuleRepository.GetForUserAsync(_context, userId, cancellationToken);
        var classified = 0;
        var unclassified = 0;
        var failed = 0;
        foreach (var current in currentRows)
        {
            if (!current.MatchesCategorizationBasis(originalById[current.Id]) ||
                !SpendingFlexibilityResolver.NeedsReview(current, rules))
            {
                continue;
            }

            if (!reviewById.TryGetValue(current.Id, out var review))
            {
                failed++;
                continue;
            }

            current.ApplySpendingFlexibilityReview(review.Assessment);
            if (review.Assessment is null)
                unclassified++;
            else
                classified++;
        }

        await _context.SaveChangesAsync(cancellationToken);
        await operation.CommitAsync(cancellationToken);
        return new SpendingFlexibilityReviewBatch(
            classified, unclassified, failed, originals.Count - classified - unclassified - failed);
    }

    public Task<Transaction?> UpdateCategoryAsync(string userId, Guid transactionId, string category) =>
        UpdateLockedAsync(userId, transactionId, transaction => transaction.ApplyCategoryUpdate(category));

    public async Task<(Transaction? Transaction, bool Applied)> ClassifySpendingFlexibilityAsync(
        string userId, Guid transactionId, SpendingFlexibilityOverride classification,
        CancellationToken cancellationToken)
    {
        var applied = false;
        var transaction = await UpdateLockedAsync(userId, transactionId,
            current => applied = current.TryClassifySpendingFlexibility(classification),
            cancellationToken: cancellationToken);
        return (transaction, applied);
    }

    private async Task<Transaction?> UpdateLockedAsync(
        string userId, Guid transactionId, Action<Transaction> apply,
        SpendingFlexibilityRule? newRule = null, CancellationToken cancellationToken = default)
    {
        await using var operation = await _context.Database.BeginTransactionAsync(cancellationToken);
        var rows = await LockTransactionsAsync(userId, [transactionId], cancellationToken);
        var transaction = rows.SingleOrDefault();
        if (transaction is null)
            return null;

        apply(transaction);
        await SaveTransactionAsync(userId, newRule, cancellationToken);
        await operation.CommitAsync(cancellationToken);
        return transaction;
    }

    private async Task SaveTransactionAsync(
        string? userId, SpendingFlexibilityRule? newRule, CancellationToken cancellationToken)
    {
        if (newRule is null)
        {
            await _context.SaveChangesAsync(cancellationToken);
            return;
        }

        if (newRule.UserId != userId)
            throw new InvalidOperationException("The rule and transaction must belong to the same user.");

        await SpendingFlexibilityRuleRepository.LockUserRulesAsync(_context, newRule.UserId, cancellationToken);
        _context.SpendingFlexibilityRules.Add(newRule);
        await SpendingFlexibilityRuleRepository.SaveChangesAsync(_context, cancellationToken);
    }

    private Task<List<Transaction>> LockTransactionsAsync(
        string userId, Guid[] ids, CancellationToken cancellationToken = default) =>
        _context.Transactions.FromSql($"""
            SELECT * FROM "Transactions"
            WHERE "UserId" = {userId} AND "Id" = ANY({ids})
            ORDER BY "Id"
            FOR UPDATE
            """).ToListAsync(cancellationToken);

    public async Task<IEnumerable<Transaction>> GetAllAsync(
        string userId,
        DateTime? endDate = null)
    {
        var query = _context.Transactions
            .Where(t => t.UserId == userId);

        if (endDate.HasValue)
        {
            var endUtc = endDate.Value.ToUniversalTime();
            query = query.Where(t => t.Date <= endUtc);
        }

        return await query
            .OrderByDescending(t => t.Date)
            .ToListAsync();
    }

    public IAsyncEnumerable<Transaction> StreamForExportAsync(
        string userId, DateTime? startDate, DateTime? endDate,
        CancellationToken cancellationToken = default)
    {
        return BuildExportQuery(_context.Transactions.AsNoTracking(), userId, startDate, endDate)
            .AsAsyncEnumerable();
    }

    internal static IQueryable<Transaction> BuildExportQuery(
        IQueryable<Transaction> transactions, string userId, DateTime? startDate, DateTime? endDate)
    {
        var query = transactions.Where(transaction => transaction.UserId == userId);
        if (startDate.HasValue)
            query = query.Where(transaction => transaction.Date >= startDate.Value);
        if (endDate.HasValue)
            query = query.Where(transaction => transaction.Date <= endDate.Value);

        return query.OrderByDescending(transaction => transaction.Date)
            .ThenByDescending(transaction => transaction.Id);
    }

    public async Task<SavingsTipsSummary> GetSavingsTipsSummaryAsync(
        string userId,
        DateTime? startDate,
        DateTime endDate,
        CancellationToken cancellationToken = default)
    {
        var groups = await BuildSavingsTipsAggregateQuery(
                _context.Transactions.AsNoTracking(), userId, startDate, endDate)
            .ToListAsync(cancellationToken);

        return SavingsTipsAggregationService.BuildSummary(groups);
    }

    internal static IQueryable<SavingsTipsAggregateGroup> BuildSavingsTipsAggregateQuery(
        IQueryable<Transaction> transactions,
        string userId,
        DateTime? startDate,
        DateTime endDate)
    {
        var endUtc = endDate.ToUniversalTime();
        var query = transactions.Where(transaction =>
            transaction.UserId == userId && transaction.Date <= endUtc);

        if (startDate.HasValue)
        {
            var startUtc = startDate.Value.ToUniversalTime();
            query = query.Where(transaction => transaction.Date >= startUtc);
        }

        return query
            .GroupBy(transaction => new
            {
                transaction.Category,
                transaction.Treatment,
                IsPositive = transaction.Amount > 0
            })
            .Select(group => new SavingsTipsAggregateGroup(
                group.Key.Category,
                group.Key.Treatment,
                group.Key.IsPositive,
                group.LongCount(),
                group.Sum(transaction => transaction.Amount)));
    }

    public async Task<List<Guid>> GetUncategorizedIdsAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        return await _context.Transactions
            .Where(t => t.UserId == userId && t.Category == "Uncategorized")
            .OrderByDescending(t => t.Date)
            .ThenByDescending(t => t.Id)
            .Select(t => t.Id)
            .ToListAsync(cancellationToken);
    }

    public async Task<List<Transaction>> GetUncategorizedByIdsAsync(
        string userId,
        IReadOnlyCollection<Guid> transactionIds,
        CancellationToken cancellationToken = default)
    {
        if (transactionIds.Count == 0)
        {
            return [];
        }

        return await _context.Transactions.AsNoTracking()
            .Where(transaction =>
                transaction.UserId == userId &&
                transaction.Category == "Uncategorized" &&
                transactionIds.Contains(transaction.Id))
            .OrderByDescending(transaction => transaction.Date)
            .ThenByDescending(transaction => transaction.Id)
            .ToListAsync(cancellationToken);
    }

    public Task<int> CountUncategorizedAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        return _context.Transactions.CountAsync(
            transaction =>
                transaction.UserId == userId &&
                transaction.Category == "Uncategorized",
            cancellationToken);
    }

    public async Task<IEnumerable<Transaction>> GetByMonthAsync(string userId, int year, int month)
    {
        return await _context.Transactions
            .Where(t => t.UserId == userId && t.Date.Year == year && t.Date.Month == month)
            .OrderByDescending(t => t.Date)
            .ToListAsync();
    }

    public async Task<IEnumerable<Transaction>> GetByDateRangeAsync(string userId, DateTime startDate, DateTime endDate)
    {
        var startUtc = startDate.ToUniversalTime();
        var endUtc = endDate.ToUniversalTime();

        return await _context.Transactions
            .Where(t => t.UserId == userId && t.Date >= startUtc && t.Date <= endUtc)
            .OrderByDescending(t => t.Date)
            .ToListAsync();
    }

    public async Task<(IEnumerable<Transaction> Items, int TotalCount)> GetTransactionsPagedAsync(
        string userId,
        TransactionQueryOptions options,
        int pageNumber,
        int pageSize,
        IReadOnlyList<SpendingFlexibilityRule>? rules = null,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Transactions
            .Where(t => t.UserId == userId)
            .AsQueryable();

        query = TransactionQuery.ApplyFilters(query, options);

        var sortedQuery = TransactionQuery.ApplySorting(query, options);
        if (options.UnclassifiedOnly)
        {
            var candidates = sortedQuery.ThenBy(transaction => transaction.Id)
                .AsNoTracking()
                .AsAsyncEnumerable();
            return await ReadUnclassifiedPageAsync(candidates, rules, pageNumber, pageSize, cancellationToken);
        }

        int totalCount = await query.CountAsync(cancellationToken);

        var items = await sortedQuery
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    internal static async Task<(IEnumerable<Transaction> Items, int TotalCount)> ReadUnclassifiedPageAsync(
        IAsyncEnumerable<Transaction> candidates,
        IReadOnlyList<SpendingFlexibilityRule>? rules,
        int pageNumber,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var offset = (pageNumber - 1L) * pageSize;
        var items = new List<Transaction>(pageSize);
        var totalCount = 0;

        await foreach (var transaction in candidates.WithCancellation(cancellationToken))
        {
            if (transaction.EffectiveTreatment != TransactionTreatment.Expense ||
                SpendingFlexibilityResolver.Resolve(transaction, rules).Value is not null)
            {
                continue;
            }

            if (totalCount >= offset && items.Count < pageSize)
            {
                items.Add(transaction);
            }

            totalCount++;
        }

        return (items, totalCount);
    }

    private sealed class ImportedTransactionRow
    {
        public Guid Id { get; init; }
        public string? UserId { get; init; }
        public DateTime Date { get; init; }
        public decimal Amount { get; init; }
        public string Category { get; init; } = string.Empty;
        public string Treatment { get; init; } = string.Empty;
        public string? Notes { get; init; }
        public string? ImportFingerprint { get; init; }
        public TransactionMetadata Metadata { get; init; } = new();
    }
}
