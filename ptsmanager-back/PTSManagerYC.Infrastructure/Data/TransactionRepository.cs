using Microsoft.EntityFrameworkCore;
using PTSManagerYC.Core.Entities;
using PTSManagerYC.Core.Interfaces;
using PTSManagerYC.Core.Services;
using System.Text.Json;
using Npgsql;
using NpgsqlTypes;

namespace PTSManagerYC.Infrastructure.Data;

public class TransactionRepository : ITransactionRepository
{
    private readonly FinzManagerDbContext _context;

    public TransactionRepository(FinzManagerDbContext context)
    {
        _context = context;
    }

    public async Task AddRangeAsync(IEnumerable<Transaction> transactions)
    {
        await _context.Transactions.AddRangeAsync(transactions);
        await _context.SaveChangesAsync();
    }

    public async Task<int> AddImportedTransactionsAsync(IEnumerable<Transaction> transactions)
    {
        var transactionRows = transactions
            .Select(transaction =>
            {
                transaction.ImportFingerprint = string.IsNullOrWhiteSpace(transaction.ImportFingerprint)
                    ? TransactionImportFingerprint.Create(transaction)
                    : transaction.ImportFingerprint;

                return new ImportedTransactionRow
                {
                    Id = transaction.Id,
                    UserId = transaction.UserId,
                    Date = transaction.Date.ToUniversalTime(),
                    Amount = transaction.Amount,
                    Category = transaction.Category,
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
            INSERT INTO "Transactions" ("Id", "UserId", "Date", "Amount", "Category", "ImportFingerprint", "Metadata")
            SELECT
                input."Id",
                input."UserId",
                input."Date",
                input."Amount",
                input."Category",
                input."ImportFingerprint",
                input."Metadata"
            FROM jsonb_to_recordset(@transactions) AS input(
                "Id" uuid,
                "UserId" text,
                "Date" timestamp with time zone,
                "Amount" numeric,
                "Category" text,
                "ImportFingerprint" character varying(64),
                "Metadata" jsonb
            )
            ON CONFLICT ("UserId", "ImportFingerprint") WHERE "ImportFingerprint" IS NOT NULL DO NOTHING;
            """;

        return await _context.Database.ExecuteSqlRawAsync(sql, parameter);
    }

    public async Task SaveChangesAsync()
    {
        await _context.SaveChangesAsync();
    }

    public async Task<Transaction?> UpdateCategoryAsync(string userId, Guid transactionId, string category)
    {
        var transaction = await _context.Transactions
            .SingleOrDefaultAsync(candidate => candidate.Id == transactionId && candidate.UserId == userId);

        if (transaction is null)
            return null;

        transaction.Category = category;
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

    public async Task<(IEnumerable<Transaction> Items, int TotalCount)> GetTransactionsPagedAsync(string userId, DateTime? startDate, int pageNumber, int pageSize)
    {
        var query = _context.Transactions
            .Where(t => t.UserId == userId)
            .AsQueryable();

        if (startDate.HasValue)
        {
            var startUtc = startDate.Value.ToUniversalTime();
            query = query.Where(t => t.Date >= startUtc);
        }

        int totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(t => t.Date)
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
        public string? ImportFingerprint { get; init; }
        public TransactionMetadata Metadata { get; init; } = new();
    }
}
