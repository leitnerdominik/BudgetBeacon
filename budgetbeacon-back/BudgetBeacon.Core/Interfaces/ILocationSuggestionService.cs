using BudgetBeacon.Core.Models;

namespace BudgetBeacon.Core.Interfaces;

public interface ILocationSuggestionService
{
    Task<IReadOnlyList<LocationSuggestion>> SearchAsync(
        string query,
        int count,
        CancellationToken cancellationToken = default);
}
