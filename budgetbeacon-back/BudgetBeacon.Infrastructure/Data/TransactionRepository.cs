using Microsoft.EntityFrameworkCore;
using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Interfaces;
using BudgetBeacon.Core.Models;
using System.Text.Json;
using Npgsql;
using NpgsqlTypes;

namespace BudgetBeacon.Infrastructure.Data;

public class TransactionRepository : ITransactionRepository
{
    private readonly BudgetBeaconDbContext _context;

    public TransactionRepository(BudgetBeaconDbContext context)
    {
        _context = context;
    }

    public async Task AddRangeAsync(IEnumerable<Transaction> transactions)
    {
        var transactionList = transactions.ToList();
        ApplyDefaultTreatment(transactionList);

        await _context.Transactions.AddRangeAsync(transactionList);
        await _context.SaveChangesAsync();
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

    private static void ApplyDefaultTreatment(IEnumerable<Transaction> transactions)
    {
        foreach (var transaction in transactions)
        {
            if (string.IsNullOrWhiteSpace(transaction.Treatment))
            {
                transaction.Treatment = TransactionTreatment.GetDefault(
                    transaction.Amount,
                    transaction.Category);
            }
        }
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
        return await _context.Transactions
            .SingleOrDefaultAsync(candidate => candidate.Id == transactionId && candidate.UserId == userId);
    }

    public async Task SaveChangesAsync()
    {
        await _context.SaveChangesAsync();
    }

    public async Task<Transaction?> UpdateAsync(string userId, Guid transactionId, TransactionUpdate update)
    {
        var transaction = await _context.Transactions
            .SingleOrDefaultAsync(candidate => candidate.Id == transactionId && candidate.UserId == userId);

        if (transaction is null)
            return null;

        transaction.ApplyUpdate(update);

        await _context.SaveChangesAsync();

        return transaction;
    }

    public async Task<Transaction?> UpdateCategoryAsync(string userId, Guid transactionId, string category)
    {
        var transaction = await _context.Transactions
            .SingleOrDefaultAsync(candidate => candidate.Id == transactionId && candidate.UserId == userId);

        if (transaction is null)
            return null;

        transaction.Category = category;
        transaction.Treatment = TransactionTreatment.GetDefault(transaction.Amount, category);
        transaction.Metadata.AiSuggestedCategory = null;
        transaction.Metadata.AiConfidenceScore = null;

        await _context.SaveChangesAsync();

        return transaction;
    }

    public async Task<IEnumerable<Transaction>> GetAllAsync(string userId)
    {
        return await _context.Transactions
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.Date)
            .ToListAsync();
    }

    public async Task<List<Transaction>> GetUncategorizedAsync(string userId)
    {
        return await _context.Transactions
            .Where(t => t.UserId == userId && t.Category == "Uncategorized")
            .OrderByDescending(t => t.Date)
            .ToListAsync();
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
        int pageSize)
    {
        var query = _context.Transactions
            .Where(t => t.UserId == userId)
            .AsQueryable();

        query = TransactionQuery.ApplyFilters(query, options);

        int totalCount = await query.CountAsync();

        var items = await TransactionQuery.ApplySorting(query, options)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

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
