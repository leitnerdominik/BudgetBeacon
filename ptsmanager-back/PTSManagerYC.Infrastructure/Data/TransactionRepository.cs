using Microsoft.EntityFrameworkCore;
using PTSManagerYC.Core.Entities;
using PTSManagerYC.Core.Interfaces;

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

    public async Task<IEnumerable<Transaction>> GetAllAsync()
    {
        return await _context.Transactions
            .OrderByDescending(t => t.Date)
            .ToListAsync();
    }

    public async Task<IEnumerable<Transaction>> GetByMonthAsync(int year, int month)
    {
        return await _context.Transactions
            .Where(t => t.Date.Year == year && t.Date.Month == month)
            .OrderByDescending(t => t.Date)
            .ToListAsync();
    }

    public async Task<IEnumerable<Transaction>> GetByDateRangeAsync(DateTime startDate, DateTime endDate)
    {
        var startUtc = startDate.ToUniversalTime();
        var endUtc = endDate.ToUniversalTime();

        return await _context.Transactions
            .Where(t => t.Date >= startUtc && t.Date <= endUtc)
            .OrderByDescending(t => t.Date)
            .ToListAsync();
    }

    public async Task<(IEnumerable<Transaction> Items, int TotalCount)> GetTransactionsPagedAsync(DateTime? startDate, int pageNumber, int pageSize)
    {
        var query = _context.Transactions.AsQueryable();

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
}