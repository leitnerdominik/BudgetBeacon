using Microsoft.Extensions.Diagnostics.HealthChecks;
using BudgetBeacon.Core.Diagnostics;

namespace BudgetBeacon.Api.Infrastructure.Health;

public sealed class DeepSeekReadinessHealthCheck : IHealthCheck
{
    private const string DefaultModel = "deepseek-v4-flash";
    private readonly IConfiguration _configuration;
    private readonly ILogger<DeepSeekReadinessHealthCheck> _logger;

    public DeepSeekReadinessHealthCheck(
        IConfiguration configuration,
        ILogger<DeepSeekReadinessHealthCheck> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var apiKey = _configuration["DeepSeek:ApiKey"];
        var model = string.IsNullOrWhiteSpace(_configuration["DeepSeek:Model"])
            ? DefaultModel
            : _configuration["DeepSeek:Model"];

        if (string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(model))
        {
            _logger.LogWarning(
                ObservabilityEventIds.DeepSeekHealthCheckFailed,
                "DeepSeek readiness check is degraded. ApiKeyConfigured: {ApiKeyConfigured}, ModelConfigured: {ModelConfigured}",
                !string.IsNullOrWhiteSpace(apiKey),
                !string.IsNullOrWhiteSpace(model));

            return Task.FromResult(HealthCheckResult.Degraded(
                "DeepSeek configuration is incomplete.",
                data: new Dictionary<string, object>
                {
                    ["apiKeyConfigured"] = !string.IsNullOrWhiteSpace(apiKey),
                    ["modelConfigured"] = !string.IsNullOrWhiteSpace(model)
                }));
        }

        return Task.FromResult(HealthCheckResult.Healthy("DeepSeek configuration is available."));
    }
}
