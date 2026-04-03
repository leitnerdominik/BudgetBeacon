using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using PTSManagerYC.Core.Diagnostics;
using PTSManagerYC.Infrastructure.Data;

namespace PTSManagerYC.Api.Infrastructure.Health;

public sealed class DatabaseReadinessHealthCheck : IHealthCheck
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DatabaseReadinessHealthCheck> _logger;

    public DatabaseReadinessHealthCheck(
        IServiceScopeFactory scopeFactory,
        ILogger<DatabaseReadinessHealthCheck> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<FinzManagerDbContext>();

            var canConnect = await dbContext.Database.CanConnectAsync(cancellationToken);
            if (!canConnect)
            {
                _logger.LogError(
                    ObservabilityEventIds.DatabaseHealthCheckFailed,
                    "Database readiness check failed because the database connection is unavailable.");

                return HealthCheckResult.Unhealthy("Database connection is unavailable.");
            }

            var pendingMigrations = await dbContext.Database.GetPendingMigrationsAsync(cancellationToken);
            var pendingMigrationList = pendingMigrations.ToList();

            if (pendingMigrationList.Count > 0)
            {
                return HealthCheckResult.Degraded(
                    "Database is reachable, but pending migrations exist.",
                    data: new Dictionary<string, object>
                    {
                        ["pendingMigrations"] = pendingMigrationList
                    });
            }

            return HealthCheckResult.Healthy("Database connection is healthy.");
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ObservabilityEventIds.DatabaseHealthCheckFailed,
                ex,
                "Database readiness check failed with an exception.");

            return HealthCheckResult.Unhealthy("Database readiness check failed.", ex);
        }
    }
}
