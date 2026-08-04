using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Models;

namespace BudgetBeacon.Core.Interfaces
{
    public interface IAiAdvisorService
    {
        Task<TransactionCategorizationResult> CategorizeTransactionsAsync(
            List<Transaction> transactions,
            string? aiLocationContext = null,
            CancellationToken cancellationToken = default);
        Task<IReadOnlyList<SavingsTip>> GetSavingTipsAsync(IEnumerable<Transaction> transactions, string? aiLocationContext = null);
    }
}
