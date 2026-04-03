using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;
using PTSManagerYC.Core.Exceptions;

namespace PTSManagerYC.Api.Infrastructure;

public sealed class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger)
    {
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var (statusCode, title, detail, type) = MapException(exception);

        if (statusCode >= StatusCodes.Status500InternalServerError)
        {
            _logger.LogError(exception, "Unhandled exception for request {Method} {Path}", httpContext.Request.Method, httpContext.Request.Path);
        }
        else
        {
            _logger.LogWarning(exception, "Handled exception for request {Method} {Path}", httpContext.Request.Method, httpContext.Request.Path);
        }

        var problemDetails = new ProblemDetails
        {
            Status = statusCode,
            Title = title,
            Detail = detail,
            Type = type,
            Instance = httpContext.Request.Path
        };

        problemDetails.Extensions["traceId"] = httpContext.TraceIdentifier;
        problemDetails.Extensions["message"] = detail;

        httpContext.Response.StatusCode = statusCode;
        httpContext.Response.ContentType = "application/problem+json";

        await httpContext.Response.WriteAsJsonAsync(problemDetails, cancellationToken);
        return true;
    }

    private static (int StatusCode, string Title, string Detail, string Type) MapException(Exception exception) =>
        exception switch
        {
            InvalidInputException invalidInput => (
                StatusCodes.Status400BadRequest,
                "Invalid request data",
                invalidInput.Message,
                "urn:ptsmanager:invalid-input"),
            ExternalServiceException externalService => (
                StatusCodes.Status502BadGateway,
                "Upstream service failure",
                externalService.Message,
                "urn:ptsmanager:external-service"),
            AntiforgeryValidationException => (
                StatusCodes.Status400BadRequest,
                "Invalid CSRF token",
                "The request could not be validated. Refresh the page and try again.",
                "urn:ptsmanager:invalid-csrf-token"),
            BadHttpRequestException => (
                StatusCodes.Status400BadRequest,
                "Invalid HTTP request",
                "The request could not be processed.",
                "urn:ptsmanager:bad-http-request"),
            _ => (
                StatusCodes.Status500InternalServerError,
                "Unexpected server error",
                "An unexpected error occurred. Please try again later.",
                "urn:ptsmanager:server-error")
        };
}
