using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Models;

namespace BudgetBeacon.Core.Interfaces
{
    public interface IAiAdvisorService
    {
        Task<TransactionCategorizationResult> CategorizeTransactionsAsync(
            List<Transaction> transactions,
            string? aiLocationContext = null);
        Task<IReadOnlyList<SavingsTip>> GetSavingTipsAsync(IEnumerable<Transaction> transactions, string? aiLocationContext = null);
    }
}
