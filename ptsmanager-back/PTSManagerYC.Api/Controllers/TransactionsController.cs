using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PTSManagerYC.Core.Entities;
using PTSManagerYC.Core.Interfaces;
using PTSManagerYC.Core.Services;

namespace PTSManagerWeb.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class TransactionsController : ControllerBase
{
    private const long MaxCsvUploadSizeBytes = 5 * 1024 * 1024;
    private static readonly HashSet<string> AllowedCsvExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".csv"
    };
    private static readonly HashSet<string> AllowedCsvContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "text/csv",
        "application/csv",
        "application/vnd.ms-excel"
    };

    private readonly ITransactionRepository _repository;
    private readonly IUserPreferencesRepository _userPreferencesRepository;
    private readonly FinanceAggregationService _aggregationService;
    private readonly IAiAdvisorService _aiService;
    private readonly ICsvReaderService _csvReader;
    private readonly ILogger<TransactionsController> _logger;

    public TransactionsController(
        ITransactionRepository repository,
        IUserPreferencesRepository userPreferencesRepository,
        FinanceAggregationService aggregationService,
        IAiAdvisorService aiService,
        ICsvReaderService csvReader,
        ILogger<TransactionsController> logger)
    {
        _repository = repository;
        _userPreferencesRepository = userPreferencesRepository;
        _aggregationService = aggregationService;
        _aiService = aiService;
        _csvReader = csvReader;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetAllTransactions(
        [FromQuery] DateTime? startDate,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 15)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return UnauthorizedProblem("A valid authenticated user is required to access transactions.");
        }

        if (page < 1 || pageSize < 1 || pageSize > 200)
        {
            return this.ApiValidationProblem(
                "Invalid transaction query",
                "Check the provided pagination values and try again.",
                errors =>
                {
                    if (page < 1)
                    {
                        errors.AddModelError(nameof(page), "Page must be greater than 0.");
                    }

                    if (pageSize < 1 || pageSize > 200)
                    {
                        errors.AddModelError(nameof(pageSize), "Page size must be between 1 and 200.");
                    }
                });
        }

        _logger.LogInformation("API requested paginated transactions. Page: {Page}", page);
        var (items, totalCount) = await _repository.GetTransactionsPagedAsync(userId, startDate, page, pageSize);

        return Ok(new
        {
            TotalCount = totalCount,
            CurrentPage = page,
            PageSize = pageSize,
            Data = items
        });
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetMonthlySummary([FromQuery] int year, [FromQuery] int month)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return UnauthorizedProblem("A valid authenticated user is required to access summaries.");
        }

        if (year < 2000 || year > 2100 || month < 1 || month > 12)
        {
            return this.ApiValidationProblem(
                "Invalid summary query",
                "Year must be between 2000 and 2100, and month must be between 1 and 12.",
                errors =>
                {
                    if (year < 2000 || year > 2100)
                    {
                        errors.AddModelError(nameof(year), "Year must be between 2000 and 2100.");
                    }

                    if (month < 1 || month > 12)
                    {
                        errors.AddModelError(nameof(month), "Month must be between 1 and 12.");
                    }
                });
        }

        _logger.LogInformation("API requested monthly summary for {Month}/{Year}", month, year);
        var transactions = (await _repository.GetByMonthAsync(userId, year, month)).ToList();

        if (!transactions.Any())
        {
            return this.ApiProblem(
                StatusCodes.Status404NotFound,
                "Monthly summary not found",
                $"No transactions were found for {month}/{year}.",
                "urn:ptsmanager:summary-not-found");
        }

        var incomes = transactions.Where(t => t.Amount > 0).ToList();
        var expenses = transactions.Where(t => t.Amount < 0).ToList();

        var summary = new
        {
            TotalIncome = _aggregationService.CalculateTotal(incomes),
            TotalExpense = _aggregationService.CalculateTotal(expenses),
            NetBalance = _aggregationService.CalculateTotal(transactions),
            AverageExpense = _aggregationService.CalculateAverage(expenses),
            MedianExpense = _aggregationService.CalculateMedian(expenses),
            TransactionCount = transactions.Count
        };

        return Ok(summary);
    }

    [HttpPost("import")]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxCsvUploadSizeBytes)]
    [RequestSizeLimit(MaxCsvUploadSizeBytes)]
    public async Task<IActionResult> UploadCsv([FromForm] IFormFile? file)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return UnauthorizedProblem("A valid authenticated user is required to import transactions.");
        }

        if (file == null || file.Length == 0)
        {
            return this.ApiValidationProblem(
                "Invalid CSV upload",
                "A non-empty CSV file is required.",
                errors => errors.AddModelError(nameof(file), "Please upload a CSV file."));
        }

        var fileExtension = Path.GetExtension(file.FileName);

        if (!AllowedCsvExtensions.Contains(fileExtension))
        {
            return this.ApiValidationProblem(
                "Invalid CSV upload",
                "Only .csv files are supported.",
                errors => errors.AddModelError(nameof(file), "The uploaded file must have a .csv extension."));
        }

        if (file.Length > MaxCsvUploadSizeBytes)
        {
            return this.ApiValidationProblem(
                "Invalid CSV upload",
                $"The uploaded file exceeds the {MaxCsvUploadSizeBytes / (1024 * 1024)} MB limit.",
                errors => errors.AddModelError(nameof(file), "The uploaded file is too large."));
        }

        if (!string.IsNullOrWhiteSpace(file.ContentType) && !AllowedCsvContentTypes.Contains(file.ContentType))
        {
            return this.ApiValidationProblem(
                "Invalid CSV upload",
                "The uploaded file does not look like a supported CSV file.",
                errors => errors.AddModelError(nameof(file), "Unsupported file content type."));
        }

        _logger.LogInformation("API processing CSV upload: {FileName}", file.FileName);

        using var stream = file.OpenReadStream();
        var parsedTransactions = _csvReader.ParseTransactions(stream).ToList();
        parsedTransactions.ForEach(transaction =>
        {
            transaction.UserId = userId;
            transaction.ImportFingerprint = TransactionImportFingerprint.Create(transaction);
        });

        if (!parsedTransactions.Any())
        {
            return this.ApiValidationProblem(
                "Invalid CSV upload",
                "No valid transactions were found in the uploaded file.",
                errors => errors.AddModelError(nameof(file), "The uploaded CSV file does not contain any valid transaction rows."));
        }

        var importedCount = await _repository.AddImportedTransactionsAsync(parsedTransactions);

        return Ok(new
        {
            Message = "Import successful",
            TotalParsed = parsedTransactions.Count,
            Imported = importedCount,
            DuplicatesSkipped = parsedTransactions.Count - importedCount
        });
    }

    [HttpPost("ai/categorize")]
    public async Task<IActionResult> TriggerCategorization()
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return UnauthorizedProblem("A valid authenticated user is required to categorize transactions.");
        }

        _logger.LogInformation("API triggered AI categorization.");

        var uncategorized = await _repository.GetUncategorizedAsync(userId);

        if (!uncategorized.Any())
        {
            return Ok(new
            {
                Message = "All transactions are already categorized. Nothing to do.",
                ProcessedCount = 0,
                CategorizedCount = 0
            });
        }

        var aiLocationContext = await _userPreferencesRepository.GetAiLocationContextAsync(userId);
        await _aiService.CategorizeTransactionsAsync(uncategorized, aiLocationContext);

        var categorizedCount = uncategorized.Count(t =>
            !string.Equals(t.Category, "Uncategorized", StringComparison.OrdinalIgnoreCase));

        await _repository.SaveChangesAsync();

        return Ok(new
        {
            Message = "Categorization successful",
            ProcessedCount = uncategorized.Count,
            CategorizedCount = categorizedCount
        });
    }

    [HttpGet("ai/tips")]
    public async Task<IActionResult> GetAiSavingsTips([FromQuery] int monthsBack = 3)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return UnauthorizedProblem("A valid authenticated user is required to generate AI tips.");
        }

        if (monthsBack < 1 || monthsBack > 24)
        {
            return this.ApiValidationProblem(
                "Invalid tips query",
                "Months back must be between 1 and 24.",
                errors => errors.AddModelError(nameof(monthsBack), "Months back must be between 1 and 24."));
        }

        _logger.LogInformation("API requested AI savings tips for the last {Months} months.", monthsBack);

        var startDate = DateTime.Now.AddMonths(-monthsBack);
        var (transactions, _) = await _repository.GetTransactionsPagedAsync(userId, startDate, 1, 10000);

        if (!transactions.Any())
        {
            return this.ApiProblem(
                StatusCodes.Status404NotFound,
                "No transactions available for analysis",
                "No transactions were found in the selected timeframe to generate savings tips.",
                "urn:ptsmanager:tips-source-data-not-found");
        }

        var aiLocationContext = await _userPreferencesRepository.GetAiLocationContextAsync(userId);
        var tips = await _aiService.GetSavingTipsAsync(transactions, aiLocationContext);

        return Ok(new { Timeframe = $"Last {monthsBack} months", Tips = tips });
    }

    private IActionResult UnauthorizedProblem(string detail)
    {
        return this.ApiProblem(
            StatusCodes.Status401Unauthorized,
            "Authentication required",
            detail,
            "urn:ptsmanager:authentication-required");
    }

    private string? GetCurrentUserId()
    {
        return User.FindFirstValue(ClaimTypes.NameIdentifier);
    }
}
