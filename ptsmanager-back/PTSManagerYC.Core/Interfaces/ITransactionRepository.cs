using PTSManagerYC.Core.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace PTSManagerYC.Core.Interfaces
{
    public interface ITransactionRepository
    {
        Task AddRangeAsync(IEnumerable<Transaction> transactions);
        Task<int> AddImportedTransactionsAsync(IEnumerable<Transaction> transactions);
        Task<bool> DeleteAsync(string userId, Guid transactionId);
        Task<Transaction?> GetByIdAsync(string userId, Guid transactionId);
        Task SaveChangesAsync();
        Task<Transaction?> UpdateCategoryAsync(string userId, Guid transactionId, string category);
        Task<IEnumerable<Transaction>> GetAllAsync(string userId);
        Task<List<Transaction>> GetUncategorizedAsync(string userId);
        Task<IEnumerable<Transaction>> GetByMonthAsync(string userId, int year, int month);
        Task<IEnumerable<Transaction>> GetByDateRangeAsync(string userId, DateTime startDate, DateTime endDate);
        Task<(IEnumerable<Transaction> Items, int TotalCount)> GetTransactionsPagedAsync(string userId, DateTime? startDate, int pageNumber, int pageSize);
    }
}
