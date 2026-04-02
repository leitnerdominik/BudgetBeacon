using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using PTSManagerYC.Api.Infrastructure;
using PTSManagerYC.Api.Infrastructure.Security;
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
                .AllowAnyMethod();
        });
    });

    var jwtIssuer = builder.Configuration["Jwt:Issuer"];
    var jwtAudience = builder.Configuration["Jwt:Audience"];
    var jwtSigningKey = builder.Configuration["Jwt:SigningKey"];

    if (string.IsNullOrWhiteSpace(jwtIssuer) ||
        string.IsNullOrWhiteSpace(jwtAudience) ||
        string.IsNullOrWhiteSpace(jwtSigningKey))
    {
        throw new InvalidOperationException(
            "JWT authentication is not configured. Provide Jwt:Issuer, Jwt:Audience, and Jwt:SigningKey via configuration.");
    }

    var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSigningKey));

    builder.Services
        .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = jwtIssuer,
                ValidateAudience = true,
                ValidAudience = jwtAudience,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = signingKey,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromMinutes(1)
            };

            options.Events = new JwtBearerEvents
            {
                OnChallenge = async context =>
                {
                    context.HandleResponse();

                    if (context.Response.HasStarted)
                    {
                        return;
                    }

                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    context.Response.ContentType = "application/problem+json";

                    var problemDetails = new ProblemDetails
                    {
                        Status = StatusCodes.Status401Unauthorized,
                        Title = "Authentication required",
                        Detail = "A valid bearer token is required to access this resource.",
                        Type = "urn:ptsmanager:authentication-required",
                        Instance = context.HttpContext.Request.Path
                    };

                    problemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier;
                    problemDetails.Extensions["message"] = problemDetails.Detail;

                    await context.Response.WriteAsJsonAsync(problemDetails);
                },
                OnForbidden = async context =>
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    context.Response.ContentType = "application/problem+json";

                    var problemDetails = new ProblemDetails
                    {
                        Status = StatusCodes.Status403Forbidden,
                        Title = "Forbidden",
                        Detail = "You do not have permission to access this resource.",
                        Type = "urn:ptsmanager:forbidden",
                        Instance = context.HttpContext.Request.Path
                    };

                    problemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier;
                    problemDetails.Extensions["message"] = problemDetails.Detail;

                    await context.Response.WriteAsJsonAsync(problemDetails);
                }
            };
        });

    builder.Services.AddAuthorization();
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(c =>
    {
        c.SwaggerDoc("v1", new() { Title = "PTS Manager API", Version = "v1" });
        c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
        {
            Description = "JWT Authorization header using the Bearer scheme. Example: 'Bearer {token}'",
            Name = "Authorization",
            In = ParameterLocation.Header,
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT"
        });
        c.AddSecurityRequirement(new OpenApiSecurityRequirement
        {
            {
                new OpenApiSecurityScheme
                {
                    Reference = new OpenApiReference
                    {
                        Type = ReferenceType.SecurityScheme,
                        Id = "Bearer"
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

    builder.Services.AddScoped<ITransactionRepository, TransactionRepository>();
    builder.Services.AddScoped<FinanceAggregationService>();
    builder.Services.AddScoped<ICsvReaderService, CsvReaderService>();
    builder.Services.AddScoped<JwtTokenService>();

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
    app.UseAuthorization();
    app.MapControllers();

    using (var scope = app.Services.CreateScope())
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<FinzManagerDbContext>();
        await dbContext.Database.EnsureCreatedAsync();
        Log.Information("Database connection established and schema is ready.");
    }

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
