using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PTSManagerYC.Core.Entities;
using PTSManagerYC.Core.Interfaces;
using PTSManagerYC.Core.Models;
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

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTransactionRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return UnauthorizedProblem("A valid authenticated user is required to create transactions.");
        }

        var category = TransactionCategories.Normalize(request.Category);
        var description = request.Description?.Trim();
        var notes = string.IsNullOrWhiteSpace(request.Notes)
            ? null
            : request.Notes.Trim();

        if (request.Date.Year < 2000 ||
            request.Date.Year > 2100 ||
            request.Amount == 0 ||
            string.IsNullOrWhiteSpace(description) ||
            description.Length > 200 ||
            notes?.Length > 500 ||
            category is null)
        {
            return this.ApiValidationProblem(
                "Invalid transaction",
                "Check the provided transaction details and try again.",
                errors =>
                {
                    if (request.Date.Year < 2000 || request.Date.Year > 2100)
                    {
                        errors.AddModelError(nameof(request.Date), "Date must be between years 2000 and 2100.");
                    }

                    if (request.Amount == 0)
                    {
                        errors.AddModelError(nameof(request.Amount), "Amount must not be zero.");
                    }

                    if (string.IsNullOrWhiteSpace(description))
                    {
                        errors.AddModelError(nameof(request.Description), "Description is required.");
                    }

                    if (description?.Length > 200)
                    {
                        errors.AddModelError(nameof(request.Description), "Description must be 200 characters or fewer.");
                    }

                    if (notes?.Length > 500)
                    {
                        errors.AddModelError(nameof(request.Notes), "Notes must be 500 characters or fewer.");
                    }

                    if (category is null)
                    {
                        errors.AddModelError(nameof(request.Category), "Unsupported transaction category.");
                    }
                });
        }

        var transaction = new Transaction
        {
            UserId = userId,
            Date = request.Date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
            Amount = request.Amount,
            Category = category,
            Notes = notes,
            Metadata = new TransactionMetadata
            {
                RawDescription = description
            }
        };

        await _repository.AddRangeAsync([transaction]);

        return Created($"/api/transactions/{transaction.Id}", transaction);
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

        return Ok(BuildMonthlySummary(year, month, transactions));
    }

    [HttpGet("summaries")]
    public async Task<IActionResult> GetMonthlySummaries(
        [FromQuery] int startYear,
        [FromQuery] int startMonth,
        [FromQuery] int endYear,
        [FromQuery] int endMonth)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return UnauthorizedProblem("A valid authenticated user is required to access summaries.");
        }

        var validationError = ValidateMonthlySummaryRange(startYear, startMonth, endYear, endMonth);
        if (validationError is not null)
        {
            return validationError;
        }

        _logger.LogInformation(
            "API requested monthly summaries from {StartMonth}/{StartYear} to {EndMonth}/{EndYear}",
            startMonth,
            startYear,
            endMonth,
            endYear);

        var startDate = new DateTime(startYear, startMonth, 1, 0, 0, 0, DateTimeKind.Utc);
        var endExclusive = new DateTime(endYear, endMonth, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(1);
        var transactions = (await _repository.GetByDateRangeAsync(
                userId,
                startDate,
                endExclusive.AddTicks(-1)))
            .ToList();
        var transactionsByMonth = transactions
            .GroupBy(transaction => new { transaction.Date.Year, transaction.Date.Month })
            .ToDictionary(group => (group.Key.Year, group.Key.Month), group => group.ToList());

        var summaries = EnumerateMonths(startYear, startMonth, endYear, endMonth)
            .Select(monthRef =>
            {
                transactionsByMonth.TryGetValue((monthRef.Year, monthRef.Month), out var monthlyTransactions);

                return BuildMonthlySummary(
                    monthRef.Year,
                    monthRef.Month,
                    monthlyTransactions ?? []);
            })
            .ToList();

        return Ok(summaries);
    }

    [HttpGet("category-summary")]
    public async Task<IActionResult> GetMonthlyCategorySummary([FromQuery] int year, [FromQuery] int month)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return UnauthorizedProblem("A valid authenticated user is required to access category summaries.");
        }

        if (year < 2000 || year > 2100 || month < 1 || month > 12)
        {
            return this.ApiValidationProblem(
                "Invalid category summary query",
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

        _logger.LogInformation("API requested category summary for {Month}/{Year}", month, year);
        var transactions = (await _repository.GetByMonthAsync(userId, year, month)).ToList();
        var expenses = transactions.Where(transaction => transaction.Amount < 0).ToList();
        var totalExpense = Math.Abs(_aggregationService.CalculateTotal(expenses));

        var categorySummaries = expenses
            .GroupBy(transaction =>
                string.IsNullOrWhiteSpace(transaction.Category)
                    ? "Uncategorized"
                    : transaction.Category)
            .Select(group =>
            {
                var categoryTotal = Math.Abs(_aggregationService.CalculateTotal(group));

                return new CategorySummaryResponse(
                    group.Key,
                    categoryTotal,
                    totalExpense > 0 ? categoryTotal / totalExpense * 100 : 0,
                    group.Count());
            })
            .OrderByDescending(summary => summary.TotalExpense)
            .ThenBy(summary => summary.Category)
            .ToList();

        return Ok(categorySummaries);
    }

    [HttpGet("top-expenses")]
    public async Task<IActionResult> GetMonthlyTopExpenses(
        [FromQuery] int year,
        [FromQuery] int month,
        [FromQuery] int limit = 5)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return UnauthorizedProblem("A valid authenticated user is required to access top expenses.");
        }

        if (year < 2000 || year > 2100 || month < 1 || month > 12 || limit < 1 || limit > 20)
        {
            return this.ApiValidationProblem(
                "Invalid top expenses query",
                "Year must be between 2000 and 2100, month must be between 1 and 12, and limit must be between 1 and 20.",
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

                    if (limit < 1 || limit > 20)
                    {
                        errors.AddModelError(nameof(limit), "Limit must be between 1 and 20.");
                    }
                });
        }

        _logger.LogInformation("API requested top expenses for {Month}/{Year}", month, year);
        var transactions = await _repository.GetByMonthAsync(userId, year, month);
        var topExpenses = transactions
            .Where(transaction => transaction.Amount < 0)
            .OrderBy(transaction => transaction.Amount)
            .ThenByDescending(transaction => transaction.Date)
            .Take(limit)
            .Select(transaction => new TopExpenseResponse(
                transaction.Id,
                transaction.Date,
                Math.Abs(transaction.Amount),
                transaction.Category,
                transaction.Metadata.RawDescription?.Trim() ?? "No description"))
            .ToList();

        return Ok(topExpenses);
    }

    [HttpGet("recurring-expenses")]
    public async Task<IActionResult> GetRecurringExpenseCandidates(
        [FromQuery] int endYear,
        [FromQuery] int endMonth,
        [FromQuery] int monthsBack = 6,
        [FromQuery] int limit = 10)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return UnauthorizedProblem("A valid authenticated user is required to access recurring expenses.");
        }

        if (endYear < 2000 ||
            endYear > 2100 ||
            endMonth < 1 ||
            endMonth > 12 ||
            monthsBack < 2 ||
            monthsBack > 24 ||
            limit < 1 ||
            limit > 20)
        {
            return this.ApiValidationProblem(
                "Invalid recurring expenses query",
                "End year must be between 2000 and 2100, end month must be between 1 and 12, months back must be between 2 and 24, and limit must be between 1 and 20.",
                errors =>
                {
                    if (endYear < 2000 || endYear > 2100)
                    {
                        errors.AddModelError(nameof(endYear), "End year must be between 2000 and 2100.");
                    }

                    if (endMonth < 1 || endMonth > 12)
                    {
                        errors.AddModelError(nameof(endMonth), "End month must be between 1 and 12.");
                    }

                    if (monthsBack < 2 || monthsBack > 24)
                    {
                        errors.AddModelError(nameof(monthsBack), "Months back must be between 2 and 24.");
                    }

                    if (limit < 1 || limit > 20)
                    {
                        errors.AddModelError(nameof(limit), "Limit must be between 1 and 20.");
                    }
                });
        }

        _logger.LogInformation(
            "API requested recurring expense candidates ending {EndMonth}/{EndYear}",
            endMonth,
            endYear);

        var endExclusive = new DateTime(endYear, endMonth, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(1);
        var startDate = endExclusive.AddMonths(-monthsBack);
        var transactions = await _repository.GetByDateRangeAsync(
            userId,
            startDate,
            endExclusive.AddTicks(-1));

        var recurringExpenses = transactions
            .Where(transaction => transaction.Amount < 0)
            .Select(transaction => new
            {
                Transaction = transaction,
                Description = NormalizeDescription(transaction.Metadata.RawDescription)
            })
            .Where(item => item.Description.Length > 0)
            .GroupBy(item => new
            {
                item.Transaction.Category,
                item.Description
            })
            .Select(group =>
            {
                var expenses = group
                    .Select(item => item.Transaction)
                    .OrderByDescending(transaction => transaction.Date)
                    .ToList();
                var monthCount = expenses
                    .Select(transaction => new { transaction.Date.Year, transaction.Date.Month })
                    .Distinct()
                    .Count();
                var amounts = expenses.Select(transaction => Math.Abs(transaction.Amount)).ToList();

                return new
                {
                    Candidate = new RecurringExpenseCandidateResponse(
                        group.Key.Description,
                        group.Key.Category,
                        amounts.Average(),
                        amounts.Min(),
                        amounts.Max(),
                        expenses.Count,
                        monthCount,
                        expenses[0].Date),
                    MonthCount = monthCount
                };
            })
            .Where(item => item.MonthCount >= 2)
            .OrderByDescending(item => item.Candidate.AverageAmount)
            .ThenBy(item => item.Candidate.Description)
            .Take(limit)
            .Select(item => item.Candidate)
            .ToList();

        return Ok(recurringExpenses);
    }

    private MonthlySummaryResponse BuildMonthlySummary(
        int year,
        int month,
        IReadOnlyCollection<Transaction> transactions)
    {
        var incomes = transactions.Where(t => t.Amount > 0).ToList();
        var expenses = transactions.Where(t => t.Amount < 0).ToList();

        return new MonthlySummaryResponse(
            year,
            month,
            _aggregationService.CalculateTotal(incomes),
            _aggregationService.CalculateTotal(expenses),
            _aggregationService.CalculateTotal(transactions),
            _aggregationService.CalculateAverage(expenses),
            _aggregationService.CalculateMedian(expenses),
            transactions.Count);
    }

    [HttpPost("import")]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxCsvUploadSizeBytes)]
    [RequestSizeLimit(MaxCsvUploadSizeBytes)]
    public async Task<IActionResult> UploadCsv(
        [FromForm] IFormFile? file,
        [FromForm] string? delimiter = null)
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
        var parsedTransactions = _csvReader.ParseTransactions(stream, delimiter).ToList();
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

    [HttpPatch("{transactionId:guid}/category")]
    public async Task<IActionResult> UpdateCategory(
        Guid transactionId,
        [FromBody] UpdateTransactionCategoryRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return UnauthorizedProblem("A valid authenticated user is required to update transactions.");
        }

        var category = TransactionCategories.Normalize(request.Category);
        if (category is null)
        {
            return this.ApiValidationProblem(
                "Invalid transaction category",
                "Choose one of the supported transaction categories.",
                errors => errors.AddModelError(nameof(request.Category), "Unsupported transaction category."));
        }

        var transaction = await _repository.UpdateCategoryAsync(userId, transactionId, category);
        if (transaction is null)
        {
            return this.ApiProblem(
                StatusCodes.Status404NotFound,
                "Transaction not found",
                "The requested transaction could not be found for the current user.",
                "urn:ptsmanager:transaction-not-found");
        }

        return Ok(transaction);
    }

    [HttpDelete("{transactionId:guid}")]
    public async Task<IActionResult> Delete(Guid transactionId)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return UnauthorizedProblem("A valid authenticated user is required to delete transactions.");
        }

        var deleted = await _repository.DeleteAsync(userId, transactionId);
        if (!deleted)
        {
            return this.ApiProblem(
                StatusCodes.Status404NotFound,
                "Transaction not found",
                "The requested transaction could not be found for the current user.",
                "urn:ptsmanager:transaction-not-found");
        }

        return NoContent();
    }

    [HttpPost("{transactionId:guid}/ai/categorize")]
    public async Task<IActionResult> RegenerateCategory(Guid transactionId)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return UnauthorizedProblem("A valid authenticated user is required to categorize transactions.");
        }

        var transaction = await _repository.GetByIdAsync(userId, transactionId);
        if (transaction is null)
        {
            return this.ApiProblem(
                StatusCodes.Status404NotFound,
                "Transaction not found",
                "The requested transaction could not be found for the current user.",
                "urn:ptsmanager:transaction-not-found");
        }

        var aiLocationContext = await _userPreferencesRepository.GetAiLocationContextAsync(userId);
        await _aiService.CategorizeTransactionsAsync([transaction], aiLocationContext);
        await _repository.SaveChangesAsync();

        return Ok(transaction);
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
    public async Task<IActionResult> GetAiSavingsTips(
        [FromQuery] int monthsBack = 3,
        [FromQuery] bool allTime = false)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return UnauthorizedProblem("A valid authenticated user is required to generate AI tips.");
        }

        if (!allTime && (monthsBack < 1 || monthsBack > 24))
        {
            return this.ApiValidationProblem(
                "Invalid tips query",
                "Months back must be between 1 and 24.",
                errors => errors.AddModelError(nameof(monthsBack), "Months back must be between 1 and 24."));
        }

        IEnumerable<Transaction> transactions;
        string timeframe;

        if (allTime)
        {
            _logger.LogInformation("API requested AI savings tips for all available transactions.");
            transactions = await _repository.GetAllAsync(userId);
            timeframe = "All time";
        }
        else
        {
            _logger.LogInformation("API requested AI savings tips for the last {Months} months.", monthsBack);
            var startDate = DateTime.Now.AddMonths(-monthsBack);
            (transactions, _) = await _repository.GetTransactionsPagedAsync(userId, startDate, 1, 10000);
            timeframe = FormatTipsTimeframe(monthsBack);
        }

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

        return Ok(new { Timeframe = timeframe, Tips = tips });
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

    private IActionResult? ValidateMonthlySummaryRange(
        int startYear,
        int startMonth,
        int endYear,
        int endMonth)
    {
        var hasInvalidDatePart = startYear < 2000 ||
            startYear > 2100 ||
            endYear < 2000 ||
            endYear > 2100 ||
            startMonth < 1 ||
            startMonth > 12 ||
            endMonth < 1 ||
            endMonth > 12;

        if (hasInvalidDatePart)
        {
            return this.ApiValidationProblem(
                "Invalid summary range",
                "Years must be between 2000 and 2100, and months must be between 1 and 12.",
                errors =>
                {
                    if (startYear < 2000 || startYear > 2100)
                    {
                        errors.AddModelError(nameof(startYear), "Start year must be between 2000 and 2100.");
                    }

                    if (endYear < 2000 || endYear > 2100)
                    {
                        errors.AddModelError(nameof(endYear), "End year must be between 2000 and 2100.");
                    }

                    if (startMonth < 1 || startMonth > 12)
                    {
                        errors.AddModelError(nameof(startMonth), "Start month must be between 1 and 12.");
                    }

                    if (endMonth < 1 || endMonth > 12)
                    {
                        errors.AddModelError(nameof(endMonth), "End month must be between 1 and 12.");
                    }
                });
        }

        var monthCount = GetInclusiveMonthCount(startYear, startMonth, endYear, endMonth);
        if (monthCount < 1 || monthCount > 24)
        {
            return this.ApiValidationProblem(
                "Invalid summary range",
                "Choose a summary range between 1 and 24 months.",
                errors =>
                {
                    if (monthCount < 1)
                    {
                        errors.AddModelError(nameof(startMonth), "Start month must not be after end month.");
                    }

                    if (monthCount > 24)
                    {
                        errors.AddModelError(nameof(endMonth), "Summary range must not exceed 24 months.");
                    }
                });
        }

        return null;
    }

    private static int GetInclusiveMonthCount(
        int startYear,
        int startMonth,
        int endYear,
        int endMonth) =>
        ((endYear - startYear) * 12) + endMonth - startMonth + 1;

    private static IEnumerable<(int Year, int Month)> EnumerateMonths(
        int startYear,
        int startMonth,
        int endYear,
        int endMonth)
    {
        var monthCount = GetInclusiveMonthCount(startYear, startMonth, endYear, endMonth);
        var current = new DateTime(startYear, startMonth, 1);

        for (var index = 0; index < monthCount; index++)
        {
            yield return (current.Year, current.Month);
            current = current.AddMonths(1);
        }
    }

    private static string FormatTipsTimeframe(int monthsBack) =>
        monthsBack switch
        {
            1 => "Last 1 month",
            12 => "Last 1 year",
            _ => $"Last {monthsBack} months"
        };

    private static string NormalizeDescription(string? description) =>
        string.Join(
            " ",
            (description ?? string.Empty)
                .Trim()
                .ToLowerInvariant()
                .Split(' ', StringSplitOptions.RemoveEmptyEntries));

    public sealed record UpdateTransactionCategoryRequest(string? Category);
    public sealed record CreateTransactionRequest(
        DateOnly Date,
        decimal Amount,
        string? Description,
        string? Category,
        string? Notes);

    private sealed record MonthlySummaryResponse(
        int Year,
        int Month,
        decimal TotalIncome,
        decimal TotalExpense,
        decimal NetBalance,
        decimal AverageExpense,
        decimal MedianExpense,
        int TransactionCount);

    private sealed record CategorySummaryResponse(
        string Category,
        decimal TotalExpense,
        decimal Percentage,
        int TransactionCount);

    private sealed record TopExpenseResponse(
        Guid Id,
        DateTime Date,
        decimal Amount,
        string Category,
        string Description);

    private sealed record RecurringExpenseCandidateResponse(
        string Description,
        string Category,
        decimal AverageAmount,
        decimal MinAmount,
        decimal MaxAmount,
        int OccurrenceCount,
        int MonthCount,
        DateTime LastDate);
}
