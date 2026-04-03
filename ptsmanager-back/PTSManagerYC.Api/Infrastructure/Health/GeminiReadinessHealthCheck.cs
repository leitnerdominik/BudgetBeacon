using Microsoft.Extensions.Diagnostics.HealthChecks;
using PTSManagerYC.Core.Diagnostics;

namespace PTSManagerYC.Api.Infrastructure.Health;

public sealed class GeminiReadinessHealthCheck : IHealthCheck
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<GeminiReadinessHealthCheck> _logger;

    public GeminiReadinessHealthCheck(
        IConfiguration configuration,
        ILogger<GeminiReadinessHealthCheck> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var apiKey = _configuration["Gemini:ApiKey"];
        var model = _configuration["Gemini:Model"];

        if (string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(model))
        {
            _logger.LogWarning(
                ObservabilityEventIds.GeminiHealthCheckFailed,
                "Gemini readiness check is degraded. ApiKeyConfigured: {ApiKeyConfigured}, ModelConfigured: {ModelConfigured}",
                !string.IsNullOrWhiteSpace(apiKey),
                !string.IsNullOrWhiteSpace(model));

            return Task.FromResult(HealthCheckResult.Degraded(
                "Gemini configuration is incomplete.",
                data: new Dictionary<string, object>
                {
                    ["apiKeyConfigured"] = !string.IsNullOrWhiteSpace(apiKey),
                    ["modelConfigured"] = !string.IsNullOrWhiteSpace(model)
                }));
        }

        return Task.FromResult(HealthCheckResult.Healthy("Gemini configuration is available."));
    }
}
