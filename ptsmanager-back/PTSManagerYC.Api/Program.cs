using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using Serilog;
using PTSManagerYC.Api.Infrastructure;
using PTSManagerYC.Core.Interfaces;
using PTSManagerYC.Core.Services;
using PTSManagerYC.Infrastructure.Data;
using PTSManagerYC.Infrastructure.External;

var builder = WebApplication.CreateBuilder(args);

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
    Log.Information("Starting PTS Manager Web API...");

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
    builder.Services.Configure<ApiBehaviorOptions>(options =>
    {
        options.InvalidModelStateResponseFactory = context =>
        {
            var problemDetails = new ValidationProblemDetails(context.ModelState)
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Request validation failed",
                Detail = "One or more validation errors occurred.",
                Type = "urn:ptsmanager:validation-error",
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
                    "http://localhost:5173"
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
        options.Cookie.Name = "ptsmanager.csrf";
        options.Cookie.HttpOnly = true;
        options.Cookie.IsEssential = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
    });
    builder.Services.AddSwaggerGen(c =>
    {
        c.SwaggerDoc("v1", new() { Title = "PTS Manager API", Version = "v1" });
        c.AddSecurityDefinition("CookieAuth", new OpenApiSecurityScheme
        {
            Description = "Session cookie authentication.",
            Name = "ptsmanager.session",
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

    var defaultConnection = builder.Configuration.GetConnectionString("DefaultConnection");

    if (string.IsNullOrWhiteSpace(defaultConnection))
    {
        throw new InvalidOperationException(
            "Connection string 'DefaultConnection' is missing. Configure it via .NET user secrets or environment variables.");
    }

    builder.Services.AddDbContext<FinzManagerDbContext>(options =>
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
        .AddEntityFrameworkStores<FinzManagerDbContext>()
        .AddDefaultTokenProviders();

    builder.Services.ConfigureApplicationCookie(options =>
    {
        options.Cookie.Name = "ptsmanager.session";
        options.Cookie.HttpOnly = true;
        options.Cookie.IsEssential = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.SlidingExpiration = true;
        options.ExpireTimeSpan = TimeSpan.FromDays(7);
        options.Events = new CookieAuthenticationEvents
        {
            OnRedirectToLogin = context => WriteAuthProblemAsync(
                context.HttpContext,
                StatusCodes.Status401Unauthorized,
                "Authentication required",
                "A valid authenticated session is required to access this resource.",
                "urn:ptsmanager:authentication-required"),
            OnRedirectToAccessDenied = context => WriteAuthProblemAsync(
                context.HttpContext,
                StatusCodes.Status403Forbidden,
                "Forbidden",
                "You do not have permission to access this resource.",
                "urn:ptsmanager:forbidden")
        };
    });

    builder.Services.AddAuthorization();

    builder.Services.AddScoped<ITransactionRepository, TransactionRepository>();
    builder.Services.AddScoped<FinanceAggregationService>();
    builder.Services.AddScoped<ICsvReaderService, CsvReaderService>();

    builder.Services.AddHttpClient<IAiAdvisorService, GeminiAiAdvisorService>(client =>
    {
        client.BaseAddress = new Uri("https://generativelanguage.googleapis.com/");
        client.Timeout = TimeSpan.FromMinutes(5);
    });

    var app = builder.Build();

    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "PTS Manager API v1"));
    }

    app.UseExceptionHandler();
    app.UseSerilogRequestLogging();
    app.UseHttpsRedirection();

    app.UseCors("AllowFrontend");

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
        var dbContext = scope.ServiceProvider.GetRequiredService<FinzManagerDbContext>();
        await dbContext.Database.MigrateAsync();
        Log.Information("Database migrations applied and schema is ready.");
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
