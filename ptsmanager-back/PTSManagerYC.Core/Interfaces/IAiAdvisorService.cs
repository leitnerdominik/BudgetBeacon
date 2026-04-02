using PTSManagerYC.Core.Entities;
using PTSManagerYC.Core.Models;

namespace PTSManagerYC.Core.Interfaces
{
    public interface IAiAdvisorService
    {
        Task CategorizeTransactionsAsync(List<Transaction> transactions);
        Task<IReadOnlyList<SavingsTip>> GetSavingTipsAsync(IEnumerable<Transaction> transactions);
    }
}
