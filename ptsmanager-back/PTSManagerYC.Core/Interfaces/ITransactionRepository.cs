using PTSManagerYC.Core.Entities;
using PTSManagerYC.Core.Models;

namespace PTSManagerYC.Core.Interfaces
{
    public interface ITransactionRepository
    {
        Task AddRangeAsync(IEnumerable<Transaction> transactions);
        Task<int> AddImportedTransactionsAsync(IEnumerable<Transaction> transactions);
        Task<bool> DeleteAsync(string userId, Guid transactionId);
        Task<Transaction?> GetByIdAsync(string userId, Guid transactionId);
        Task SaveChangesAsync();
        Task<Transaction?> UpdateAsync(string userId, Guid transactionId, TransactionUpdate update);
        Task<Transaction?> UpdateCategoryAsync(string userId, Guid transactionId, string category);
        Task<IEnumerable<Transaction>> GetAllAsync(string userId);
        Task<List<Transaction>> GetUncategorizedAsync(string userId);
        Task<IEnumerable<Transaction>> GetByMonthAsync(string userId, int year, int month);
        Task<IEnumerable<Transaction>> GetByDateRangeAsync(string userId, DateTime startDate, DateTime endDate);
        Task<(IEnumerable<Transaction> Items, int TotalCount)> GetTransactionsPagedAsync(
            string userId,
            DateTime? startDate,
            int pageNumber,
            int pageSize);
    }
}
