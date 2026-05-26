using Microsoft.Extensions.Logging;

namespace PTSManagerYC.Core.Diagnostics;

public static class ObservabilityEventIds
{
    public static readonly EventId ApiUnhandledException = new(1000, nameof(ApiUnhandledException));
    public static readonly EventId ApiHandledException = new(1001, nameof(ApiHandledException));
    public static readonly EventId DatabaseMigrationFailed = new(1100, nameof(DatabaseMigrationFailed));
    public static readonly EventId DatabaseHealthCheckFailed = new(1101, nameof(DatabaseHealthCheckFailed));
    public static readonly EventId OpenRouterHealthCheckFailed = new(1200, nameof(OpenRouterHealthCheckFailed));
    public static readonly EventId OpenRouterUpstreamFailure = new(1201, nameof(OpenRouterUpstreamFailure));
    public static readonly EventId OpenRouterInvalidResponse = new(1202, nameof(OpenRouterInvalidResponse));
}
