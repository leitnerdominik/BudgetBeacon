using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Models;

namespace BudgetBeacon.Core.Interfaces
{
    public interface ITransactionRepository
    {
        Task AddRangeAsync(IEnumerable<Transaction> transactions);
        Task<int> AddImportedTransactionsAsync(IEnumerable<Transaction> transactions);
        Task<IReadOnlySet<string>> GetExistingImportFingerprintsAsync(
            string userId,
            IReadOnlyCollection<string> importFingerprints);
        Task<bool> DeleteAsync(string userId, Guid transactionId);
        Task<Transaction?> GetByIdAsync(string userId, Guid transactionId);
        Task SaveChangesAsync(CancellationToken cancellationToken = default);
        Task<Transaction?> UpdateAsync(string userId, Guid transactionId, TransactionUpdate update);
        Task<Transaction?> UpdateCategoryAsync(string userId, Guid transactionId, string category);
        Task<IEnumerable<Transaction>> GetAllAsync(string userId, DateTime? endDate = null);
        Task<List<Guid>> GetUncategorizedIdsAsync(
            string userId,
            CancellationToken cancellationToken = default);
        Task<List<Transaction>> GetUncategorizedByIdsAsync(
            string userId,
            IReadOnlyCollection<Guid> transactionIds,
            CancellationToken cancellationToken = default);
        Task<int> CountUncategorizedAsync(
            string userId,
            CancellationToken cancellationToken = default);
        Task<IEnumerable<Transaction>> GetByMonthAsync(string userId, int year, int month);
        Task<IEnumerable<Transaction>> GetByDateRangeAsync(string userId, DateTime startDate, DateTime endDate);
        Task<(IEnumerable<Transaction> Items, int TotalCount)> GetTransactionsPagedAsync(
            string userId,
            TransactionQueryOptions options,
            int pageNumber,
            int pageSize);
    }
}
