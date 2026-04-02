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
        Task<IEnumerable<Transaction>> GetAllAsync();
        Task<IEnumerable<Transaction>> GetByMonthAsync(int year, int month);
        Task<IEnumerable<Transaction>> GetByDateRangeAsync(DateTime startDate, DateTime endDate);
        Task<(IEnumerable<Transaction> Items, int TotalCount)> GetTransactionsPagedAsync(DateTime? startDate, int pageNumber, int pageSize);
    }
}
