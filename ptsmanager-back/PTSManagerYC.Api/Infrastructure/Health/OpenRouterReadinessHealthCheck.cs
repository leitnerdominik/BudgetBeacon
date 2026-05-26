using Microsoft.Extensions.Diagnostics.HealthChecks;
using PTSManagerYC.Core.Diagnostics;

namespace PTSManagerYC.Api.Infrastructure.Health;

public sealed class OpenRouterReadinessHealthCheck : IHealthCheck
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<OpenRouterReadinessHealthCheck> _logger;

    public OpenRouterReadinessHealthCheck(
        IConfiguration configuration,
        ILogger<OpenRouterReadinessHealthCheck> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var apiKey = _configuration["OpenRouter:ApiKey"];
        var model = _configuration["OpenRouter:Model"];

        if (string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(model))
        {
            _logger.LogWarning(
                ObservabilityEventIds.OpenRouterHealthCheckFailed,
                "OpenRouter readiness check is degraded. ApiKeyConfigured: {ApiKeyConfigured}, ModelConfigured: {ModelConfigured}",
                !string.IsNullOrWhiteSpace(apiKey),
                !string.IsNullOrWhiteSpace(model));

            return Task.FromResult(HealthCheckResult.Degraded(
                "OpenRouter configuration is incomplete.",
                data: new Dictionary<string, object>
                {
                    ["apiKeyConfigured"] = !string.IsNullOrWhiteSpace(apiKey),
                    ["modelConfigured"] = !string.IsNullOrWhiteSpace(model)
                }));
        }

        return Task.FromResult(HealthCheckResult.Healthy("OpenRouter configuration is available."));
    }
}
