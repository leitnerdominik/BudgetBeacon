using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.OpenApi.Models;
using Serilog;
using Serilog.Context;
using BudgetBeacon.Api.Infrastructure;
using BudgetBeacon.Api.Infrastructure.Auth;
using BudgetBeacon.Api.Infrastructure.Health;
using BudgetBeacon.Core.Diagnostics;
using BudgetBeacon.Core.Interfaces;
using BudgetBeacon.Core.Services;
using BudgetBeacon.Infrastructure.Data;
using BudgetBeacon.Infrastructure.External;

var builder = WebApplication.CreateBuilder(args);
var secureCookiePolicy = builder.Environment.IsDevelopment()
    ? CookieSecurePolicy.SameAsRequest
    : CookieSecurePolicy.Always;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", Serilog.Events.LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore", Serilog.Events.LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File("logs/api-.log", rollingInterval: RollingInterval.Day)
    .CreateLogger();

builder.Host.UseSerilog();

try
{
    Log.Information("Starting BudgetBeacon Web API...");

    builder.Services.AddProblemDetails(options =>
    {
        options.CustomizeProblemDetails = context =>
        {
            context.ProblemDetails.Instance ??= context.HttpContext.Request.Path;
            context.ProblemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier;

            if (!context.ProblemDetails.Extensions.ContainsKey("message"))
            {
                context.ProblemDetails.Extensions["message"] =
                    context.ProblemDetails.Detail ??
                    context.ProblemDetails.Title ??
                    "Request failed.";
            }
        };
    });
    builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
    builder.Services.AddControllers();
    builder.Services.Configure<ForwardedHeadersOptions>(options =>
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        options.ForwardLimit = 1;
    });
    builder.Services.AddHsts(options =>
    {
        options.IncludeSubDomains = true;
        options.MaxAge = TimeSpan.FromDays(365);
        options.Preload = true;
    });
    builder.Services.AddHealthChecks()
        .AddCheck("self", () => HealthCheckResult.Healthy("API process is running."), tags: ["live"])
        .AddCheck<DatabaseReadinessHealthCheck>("database", failureStatus: HealthStatus.Unhealthy, tags: ["ready", "database"])
        .AddCheck<DeepSeekReadinessHealthCheck>("deepseek", failureStatus: HealthStatus.Degraded, tags: ["ready", "deepseek"]);
    builder.Services.Configure<ApiBehaviorOptions>(options =>
    {
        options.InvalidModelStateResponseFactory = context =>
        {
            var problemDetails = new ValidationProblemDetails(context.ModelState)
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Request validation failed",
                Detail = "One or more validation errors occurred.",
                Type = "urn:budgetbeacon:validation-error",
                Instance = context.HttpContext.Request.Path
            };

            problemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier;
            problemDetails.Extensions["message"] = problemDetails.Detail;

            return new BadRequestObjectResult(problemDetails)
            {
                ContentTypes = { "application/problem+json" }
            };
        };
    });

    builder.Services.AddCors(options =>
    {
        options.AddPolicy("AllowFrontend", policy =>
        {
            policy.WithOrigins(
                    "http://localhost:3000",
                    "http://localhost:5173",
                    "budgetbeacon.ninetoshine.xyz"
                )
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials();
        });
    });
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddAntiforgery(options =>
    {
        options.HeaderName = "X-CSRF-TOKEN";
        options.Cookie.Name = "budgetbeacon.csrf";
        options.Cookie.HttpOnly = true;
        options.Cookie.IsEssential = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = secureCookiePolicy;
    });
    builder.Services.AddSwaggerGen(c =>
    {
        c.SwaggerDoc("v1", new() { Title = "BudgetBeacon API", Version = "v1" });
        c.AddSecurityDefinition("CookieAuth", new OpenApiSecurityScheme
        {
            Description = "Session cookie authentication.",
            Name = "budgetbeacon.session",
            In = ParameterLocation.Cookie,
            Type = SecuritySchemeType.ApiKey
        });
        c.AddSecurityRequirement(new OpenApiSecurityRequirement
        {
            {
                new OpenApiSecurityScheme
                {
                    Reference = new OpenApiReference
                    {
                        Type = ReferenceType.SecurityScheme,
                        Id = "CookieAuth"
                    }
                },
                Array.Empty<string>()
            }
        });
    });
    builder.Services.Configure<AccountAccessOptions>(
        builder.Configuration.GetSection(AccountAccessOptions.SectionName));
    builder.Services.AddSingleton<IAccountAccessPolicy, ConfiguredAccountAccessPolicy>();

    var defaultConnection = builder.Configuration.GetConnectionString("DefaultConnection");

    if (string.IsNullOrWhiteSpace(defaultConnection))
    {
        throw new InvalidOperationException(
            "Connection string 'DefaultConnection' is missing. Configure it via .NET user secrets or environment variables.");
    }

    builder.Services.AddDbContext<BudgetBeaconDbContext>(options =>
        options.UseNpgsql(defaultConnection));
    builder.Services
        .AddIdentity<ApplicationUser, IdentityRole>(options =>
        {
            options.User.RequireUniqueEmail = true;
            options.Password.RequiredLength = 8;
            options.Password.RequireDigit = true;
            options.Password.RequireLowercase = true;
            options.Password.RequireUppercase = true;
            options.Password.RequireNonAlphanumeric = false;
            options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
            options.Lockout.MaxFailedAccessAttempts = 5;
            options.Lockout.AllowedForNewUsers = true;
        })
        .AddEntityFrameworkStores<BudgetBeaconDbContext>()
        .AddDefaultTokenProviders();

    builder.Services.ConfigureApplicationCookie(options =>
    {
        options.Cookie.Name = "budgetbeacon.session";
        options.Cookie.HttpOnly = true;
        options.Cookie.IsEssential = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = secureCookiePolicy;
        options.SlidingExpiration = true;
        options.ExpireTimeSpan = TimeSpan.FromDays(7);
        options.Events = new CookieAuthenticationEvents
        {
            OnValidatePrincipal = async context =>
            {
                var accountAccessPolicy = context.HttpContext.RequestServices.GetRequiredService<IAccountAccessPolicy>();
                var userManager = context.HttpContext.RequestServices.GetRequiredService<UserManager<ApplicationUser>>();
                var logger = context.HttpContext.RequestServices
                    .GetRequiredService<ILoggerFactory>()
                    .CreateLogger("BudgetBeacon.Api.Authentication");

                var user = context.Principal is null
                    ? null
                    : await userManager.GetUserAsync(context.Principal);

                if (user is null)
                {
                    context.RejectPrincipal();
                    await context.HttpContext.SignOutAsync(IdentityConstants.ApplicationScheme);
                    return;
                }

                if (!accountAccessPolicy.IsEmailAllowed(user.Email))
                {
                    logger.LogWarning("Rejected session for disallowed user {UserId}.", user.Id);
                    context.RejectPrincipal();
                    await context.HttpContext.SignOutAsync(IdentityConstants.ApplicationScheme);
                }
            },
            OnRedirectToLogin = context => WriteAuthProblemAsync(
                context.HttpContext,
                StatusCodes.Status401Unauthorized,
                "Authentication required",
                "A valid authenticated session is required to access this resource.",
                "urn:budgetbeacon:authentication-required"),
            OnRedirectToAccessDenied = context => WriteAuthProblemAsync(
                context.HttpContext,
                StatusCodes.Status403Forbidden,
                "Forbidden",
                "You do not have permission to access this resource.",
                "urn:budgetbeacon:forbidden")
        };
    });

    builder.Services.AddAuthorization();

    builder.Services.AddScoped<ITransactionRepository, TransactionRepository>();
    builder.Services.AddScoped<IUserPreferencesRepository, UserPreferencesRepository>();
    builder.Services.AddScoped<FinanceAggregationService>();
    builder.Services.AddScoped<StatisticsAggregationService>();
    builder.Services.AddScoped<TransactionImportDescriptionRedactionService>();
    builder.Services.AddScoped<ITransactionImportParser, TransactionImportParser>();

    builder.Services.AddHttpClient<IAiAdvisorService, DeepSeekAiAdvisorService>((serviceProvider, client) =>
    {
        var configuration = serviceProvider.GetRequiredService<IConfiguration>();

        client.BaseAddress = new Uri(configuration["DeepSeek:BaseUrl"] ?? "https://api.deepseek.com/");
        client.Timeout = TimeSpan.FromMinutes(5);
    });

    var app = builder.Build();

    app.UseForwardedHeaders();

    if (!app.Environment.IsDevelopment())
    {
        app.UseHsts();
    }

    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "BudgetBeacon API v1"));
    }

    app.UseExceptionHandler();
    app.Use(async (context, next) =>
    {
        var correlationId = context.Request.Headers["X-Correlation-ID"].FirstOrDefault();

        if (string.IsNullOrWhiteSpace(correlationId))
        {
            correlationId = Guid.NewGuid().ToString("n");
        }

        context.TraceIdentifier = correlationId;
        context.Response.Headers["X-Correlation-ID"] = correlationId;

        using (LogContext.PushProperty("CorrelationId", correlationId))
        {
            await next();
        }
    });
    app.UseSerilogRequestLogging(options =>
    {
        options.EnrichDiagnosticContext = (diagnosticContext, httpContext) =>
        {
            diagnosticContext.Set("CorrelationId", httpContext.TraceIdentifier);
            diagnosticContext.Set("TraceId", System.Diagnostics.Activity.Current?.TraceId.ToString() ?? httpContext.TraceIdentifier);
            diagnosticContext.Set("RequestHost", httpContext.Request.Host.Value);
            diagnosticContext.Set("RequestScheme", httpContext.Request.Scheme);
            diagnosticContext.Set("UserId", httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "anonymous");
        };
    });
    app.UseHttpsRedirection();

    app.UseCors("AllowFrontend");

    app.MapHealthChecks("/health/live", new HealthCheckOptions
    {
        Predicate = check => check.Tags.Contains("live"),
        ResponseWriter = WriteHealthResponseAsync
    });
    app.MapHealthChecks("/health/ready", new HealthCheckOptions
    {
        Predicate = check => check.Tags.Contains("ready"),
        ResponseWriter = WriteHealthResponseAsync
    });

    app.UseAuthentication();
    app.Use(async (context, next) =>
    {
        if (HttpMethods.IsGet(context.Request.Method) ||
            HttpMethods.IsHead(context.Request.Method) ||
            HttpMethods.IsOptions(context.Request.Method) ||
            HttpMethods.IsTrace(context.Request.Method))
        {
            await next();
            return;
        }

        if (context.Request.Path.StartsWithSegments("/swagger"))
        {
            await next();
            return;
        }

        var antiforgery = context.RequestServices.GetRequiredService<IAntiforgery>();
        await antiforgery.ValidateRequestAsync(context);
        await next();
    });
    app.UseAuthorization();
    app.MapControllers();

    using (var scope = app.Services.CreateScope())
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<BudgetBeaconDbContext>();
        try
        {
            await dbContext.Database.MigrateAsync();
            Log.Information("Database migrations applied and schema is ready.");
        }
        catch (Exception ex)
        {
            Log.ForContext("ConnectionStringPresent", !string.IsNullOrWhiteSpace(defaultConnection))
                .ForContext("EventId", ObservabilityEventIds.DatabaseMigrationFailed.Id)
                .ForContext("EventName", ObservabilityEventIds.DatabaseMigrationFailed.Name)
                .Fatal(ex, "Database migration failed during startup.");
            throw;
        }
    }

    app.Lifetime.ApplicationStarted.Register(() =>
    {
        var addresses = app.Urls;

        if (addresses.Count == 0)
        {
            Log.Warning("Backend started, but no listening addresses were reported.");
            return;
        }

        Log.Information("Backend available at: {BackendAddresses}", string.Join(", ", addresses));
    });

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "API application terminated unexpectedly.");
    throw;
}
finally
{
    Log.CloseAndFlush();
}

static async Task WriteAuthProblemAsync(
    HttpContext httpContext,
    int statusCode,
    string title,
    string detail,
    string type)
{
    if (httpContext.Response.HasStarted)
    {
        return;
    }

    httpContext.Response.StatusCode = statusCode;
    httpContext.Response.ContentType = "application/problem+json";

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

    await httpContext.Response.WriteAsJsonAsync(problemDetails);
}

static async Task WriteHealthResponseAsync(HttpContext context, HealthReport report)
{
    context.Response.ContentType = "application/json";

    var payload = new
    {
        status = report.Status.ToString(),
        correlationId = context.TraceIdentifier,
        totalDurationMs = report.TotalDuration.TotalMilliseconds,
        checks = report.Entries.Select(entry => new
        {
            name = entry.Key,
            status = entry.Value.Status.ToString(),
            description = entry.Value.Description,
            durationMs = entry.Value.Duration.TotalMilliseconds,
            tags = entry.Value.Tags,
            data = entry.Value.Data.ToDictionary(item => item.Key, item => item.Value)
        })
    };

    await context.Response.WriteAsJsonAsync(payload);
}
