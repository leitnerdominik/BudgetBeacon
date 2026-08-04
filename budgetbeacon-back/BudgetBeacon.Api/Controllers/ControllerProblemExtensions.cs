using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace BudgetBeacon.Api.Controllers;

public static class ControllerProblemExtensions
{
    public static ObjectResult ApiProblem(
        this ControllerBase controller,
        int statusCode,
        string title,
        string detail,
        string type,
        Action<ProblemDetails>? configure = null)
    {
        var problemDetails = new ProblemDetails
        {
            Status = statusCode,
            Title = title,
            Detail = detail,
            Type = type,
            Instance = controller.HttpContext.Request.Path
        };

        problemDetails.Extensions["traceId"] = controller.HttpContext.TraceIdentifier;
        problemDetails.Extensions["message"] = detail;
        configure?.Invoke(problemDetails);

        return new ObjectResult(problemDetails)
        {
            StatusCode = statusCode,
            ContentTypes = { "application/problem+json" }
        };
    }

    public static BadRequestObjectResult ApiValidationProblem(
        this ControllerBase controller,
        string title,
        string detail,
        Action<ModelStateDictionary> configureErrors)
    {
        var modelState = new ModelStateDictionary();
        configureErrors(modelState);

        var problemDetails = new ValidationProblemDetails(modelState)
        {
            Status = StatusCodes.Status400BadRequest,
            Title = title,
            Detail = detail,
            Type = "urn:budgetbeacon:validation-error",
            Instance = controller.HttpContext.Request.Path
        };

        problemDetails.Extensions["traceId"] = controller.HttpContext.TraceIdentifier;
        problemDetails.Extensions["message"] = detail;

        return new BadRequestObjectResult(problemDetails)
        {
            ContentTypes = { "application/problem+json" }
        };
    }
}
