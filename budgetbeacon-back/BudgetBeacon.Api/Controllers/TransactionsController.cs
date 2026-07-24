using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Interfaces;
using BudgetBeacon.Core.Models;
using BudgetBeacon.Core.Services;

namespace BudgetBeacon.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class TransactionsController : ControllerBase
{
    private const long MaxTransactionImportSizeBytes = 5 * 1024 * 1024;
    private static readonly HashSet<string> AllowedTransactionImportExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".csv",
        ".xlsx"
    };
    private static readonly HashSet<string> AllowedCsvContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "text/csv",
        "application/csv",
        "application/vnd.ms-excel"
    };
    private static readonly HashSet<string> AllowedXlsxContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    };

    private readonly ITransactionRepository _repository;
    private readonly IUserPreferencesRepository _userPreferencesRepository;
    private readonly StatisticsAggregationService _statisticsAggregationService;
    private readonly IAiAdvisorService _aiService;
    private readonly ITransactionImportParser _transactionImportParser;
    private readonly TransactionImportService _transactionImportService;
    private readonly ILogger<TransactionsController> _logger;

    public TransactionsController(
        ITransactionRepository repository,
        IUserPreferencesRepository userPreferencesRepository,
        StatisticsAggregationService statisticsAggregationService,
        IAiAdvisorService aiService,
        ITransactionImportParser transactionImportParser,
        TransactionImportService transactionImportService,
        ILogger<TransactionsController> logger)
    {
        _repository = repository;
        _userPreferencesRepository = userPreferencesRepository;
        _statisticsAggregationService = statisticsAggregationService;
        _aiService = aiService;
        _transactionImportParser = transactionImportParser;
        _transactionImportService = transactionImportService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetAllTransactions(
        [FromQuery] DateOnly? startDate = null,
        [FromQuery] DateOnly? endDate = null,
        [FromQuery] string? searchTerm = null,
        [FromQuery] string? category = null,
        [FromQuery] string transactionType = "all",
        [FromQuery] string sortBy = "date",
        [FromQuery] string sortDirection = "desc",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 15)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return UnauthorizedProblem("A valid authenticated user is required to access transactions.");
        }

        var normalizedCategory = string.IsNullOrWhiteSpace(category)
            ? null
            : TransactionCategories.Normalize(category);
        var hasInvalidCategory = !string.IsNullOrWhiteSpace(category) && normalizedCategory is null;
        var hasInvalidTransactionType = !TryParseTransactionTypeFilter(transactionType, out var parsedTransactionType);
        var hasInvalidSortBy = !TryParseTransactionSortField(sortBy, out var parsedSortBy);
        var hasInvalidSortDirection = !TryParseTransactionSortDirection(sortDirection, out var parsedSortDirection);
        var hasInvalidDateRange = startDate.HasValue && endDate.HasValue && startDate.Value > endDate.Value;
        var hasInvalidSearchTerm = searchTerm?.Length > 100;

        if (page < 1 ||
            pageSize < 1 ||
            pageSize > 200 ||
            hasInvalidCategory ||
            hasInvalidTransactionType ||
            hasInvalidSortBy ||
            hasInvalidSortDirection ||
            hasInvalidDateRange ||
            hasInvalidSearchTerm)
        {
            return this.ApiValidationProblem(
                "Invalid transaction query",
                "Check the provided filter, sort, and pagination values and try again.",
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

                    if (hasInvalidCategory)
                    {
                        errors.AddModelError(nameof(category), "Unsupported transaction category.");
                    }

                    if (hasInvalidTransactionType)
                    {
                        errors.AddModelError(nameof(transactionType), "Transaction type must be all, income, or expense.");
                    }

                    if (hasInvalidSortBy)
                    {
                        errors.AddModelError(nameof(sortBy), "Sort field must be date, amount, category, or description.");
                    }

                    if (hasInvalidSortDirection)
                    {
                        errors.AddModelError(nameof(sortDirection), "Sort direction must be asc or desc.");
                    }

                    if (hasInvalidDateRange)
                    {
                        errors.AddModelError(nameof(endDate), "End date must not be before start date.");
                    }

                    if (hasInvalidSearchTerm)
                    {
                        errors.AddModelError(nameof(searchTerm), "Search term must be 100 characters or fewer.");
                    }
                });
        }

        _logger.LogInformation("API requested paginated transactions. Page: {Page}", page);
        var queryOptions = new TransactionQueryOptions(
            StartDate: startDate?.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
            EndDate: endDate?.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc),
            SearchTerm: searchTerm?.Trim(),
            Category: normalizedCategory,
            TransactionType: parsedTransactionType,
            SortBy: parsedSortBy,
            SortDirection: parsedSortDirection);
        var (items, totalCount) = await _repository.GetTransactionsPagedAsync(userId, queryOptions, page, pageSize);

        return Ok(new
        {
            TotalCount = totalCount,
            CurrentPage = page,
            PageSize = pageSize,
            Data = items
        });
    }

    [HttpGet("{transactionId:guid}")]
    public async Task<IActionResult> GetById(Guid transactionId)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return UnauthorizedProblem("A valid authenticated user is required to access transactions.");
        }

        var transaction = await _repository.GetByIdAsync(userId, transactionId);
        if (transaction is null)
        {
            return TransactionNotFoundProblem();
        }

        return Ok(transaction);
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
        var treatment = string.IsNullOrWhiteSpace(request.Treatment)
            ? TransactionTreatment.GetDefault(request.Amount, category)
            : TransactionTreatment.Normalize(request.Treatment);
        var hasInvalidTreatment = treatment is null;
        var financialValueValidation = FinancialValueValidator.Validate(
            request.Amount,
            request.Date);

        if (!financialValueValidation.IsValid ||
            string.IsNullOrWhiteSpace(description) ||
            description.Length > 200 ||
            notes?.Length > 500 ||
            category is null ||
            hasInvalidTreatment)
        {
            return this.ApiValidationProblem(
                "Invalid transaction",
                "Check the provided transaction details and try again.",
                errors =>
                {
                    foreach (var error in financialValueValidation.DateErrors)
                    {
                        errors.AddModelError(nameof(request.Date), error);
                    }

                    foreach (var error in financialValueValidation.AmountErrors)
                    {
                        errors.AddModelError(nameof(request.Amount), error);
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

                    if (hasInvalidTreatment)
                    {
                        errors.AddModelError(nameof(request.Treatment), "Unsupported transaction statistics treatment.");
                    }
                });
        }

        var transaction = new Transaction
        {
            UserId = userId,
            Date = request.Date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
            Amount = request.Amount,
            Category = category,
            Treatment = treatment!,
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

        return Ok(_statisticsAggregationService.BuildMonthlySummary(year, month, transactions));
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
        var summaries = _statisticsAggregationService.BuildMonthlySummaries(
            startYear,
            startMonth,
            endYear,
            endMonth,
            transactions);

        return Ok(summaries);
    }

    [HttpGet("statistics")]
    public async Task<IActionResult> GetStatistics(
        [FromQuery] bool allTime = false,
        [FromQuery] int? endYear = null,
        [FromQuery] int? endMonth = null,
        [FromQuery] int? monthsBack = null)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return UnauthorizedProblem("A valid authenticated user is required to access statistics.");
        }

        if (allTime)
        {
            if (endYear is not null || endMonth is not null || monthsBack is not null)
            {
                return this.ApiValidationProblem(
                    "Invalid statistics query",
                    "All-time statistics cannot be combined with an end month or a fixed month count.",
                    errors => errors.AddModelError(nameof(allTime), "Remove endYear, endMonth, and monthsBack when allTime is true."));
            }

            _logger.LogInformation("API requested all-time statistics.");
            var allTransactions = await _repository.GetAllAsync(userId);

            return Ok(_statisticsAggregationService.BuildAllTime(allTransactions));
        }

        var hasInvalidFixedPeriod =
            endYear is null ||
            endMonth is null ||
            monthsBack is null ||
            endYear < 2000 ||
            endYear > 2100 ||
            endMonth < 1 ||
            endMonth > 12 ||
            monthsBack is not (1 or 3 or 6 or 12);

        if (hasInvalidFixedPeriod)
        {
            return this.ApiValidationProblem(
                "Invalid statistics query",
                "Choose an end month between 2000 and 2100 and a supported period of 1, 3, 6, or 12 months.",
                errors =>
                {
                    if (endYear is null || endYear < 2000 || endYear > 2100)
                    {
                        errors.AddModelError(nameof(endYear), "End year must be between 2000 and 2100.");
                    }

                    if (endMonth is null || endMonth < 1 || endMonth > 12)
                    {
                        errors.AddModelError(nameof(endMonth), "End month must be between 1 and 12.");
                    }

                    if (monthsBack is null || monthsBack is not (1 or 3 or 6 or 12))
                    {
                        errors.AddModelError(nameof(monthsBack), "Months back must be 1, 3, 6, or 12.");
                    }
                });
        }

        var validatedEndYear = endYear.GetValueOrDefault();
        var validatedEndMonth = endMonth.GetValueOrDefault();
        var validatedMonthsBack = monthsBack.GetValueOrDefault();
        var endExclusive = new DateTime(validatedEndYear, validatedEndMonth, 1, 0, 0, 0, DateTimeKind.Utc)
            .AddMonths(1);
        var startDate = endExclusive.AddMonths(-validatedMonthsBack);
        var endDate = endExclusive.AddTicks(-1);
        var queryStartDate = validatedMonthsBack == 1
            ? startDate.AddMonths(-1)
            : startDate;

        _logger.LogInformation(
            "API requested statistics for the last {MonthsBack} months ending {EndMonth}/{EndYear}.",
            monthsBack,
            endMonth,
            endYear);

        var transactions = await _repository.GetByDateRangeAsync(userId, queryStartDate, endDate);

        return Ok(_statisticsAggregationService.BuildFixedPeriod(
            transactions,
            startDate,
            endDate,
            validatedMonthsBack));
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
        var categorySummaries = _statisticsAggregationService.BuildCategorySummaries(transactions);

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
        var transactions = (await _repository.GetByMonthAsync(userId, year, month)).ToList();
        var topExpenses = _statisticsAggregationService.BuildTopExpenses(transactions, limit);

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

        var recurringExpenses = _statisticsAggregationService.BuildRecurringExpenses(
            transactions.ToList(),
            limit);

        return Ok(recurringExpenses);
    }

    [HttpPost("import/preview")]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxTransactionImportSizeBytes)]
    [RequestSizeLimit(MaxTransactionImportSizeBytes)]
    public async Task<IActionResult> PreviewImportTransactions(
        [FromForm] IFormFile? file,
        [FromForm] string? delimiter = null,
        [FromForm] bool hasHeaderRow = true,
        [FromForm] int? dateColumnIndex = null,
        [FromForm] int? amountColumnIndex = null,
        [FromForm] int? descriptionColumnIndex = null)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return UnauthorizedProblem("A valid authenticated user is required to preview transaction imports.");
        }

        var validationResult = ValidateTransactionImportFile(file, out var fileExtension);
        if (validationResult is not null)
        {
            return validationResult;
        }

        var parsedTransactions = ParseImportedTransactions(
            file!,
            fileExtension,
            delimiter,
            hasHeaderRow,
            dateColumnIndex,
            amountColumnIndex,
            descriptionColumnIndex);

        if (parsedTransactions.Count == 0)
        {
            return NoValidImportRowsProblem();
        }

        var preview = await _transactionImportService.PreviewAsync(userId, parsedTransactions);

        return Ok(new
        {
            preview.TotalParsed,
            preview.Importable,
            preview.DuplicatesSkipped,
            preview.ExistingDuplicates,
            preview.FileDuplicates,
            preview.RedactedTransactions,
            Transactions = preview.Transactions.Select(item => new
            {
                Date = item.Transaction.Date.ToString("yyyy-MM-dd"),
                item.Transaction.Amount,
                Description = item.Transaction.Metadata.RawDescription,
                item.DescriptionRedacted,
                Status = item.WillImport ? "willImport" : "skipped",
                DuplicateReason = item.DuplicateReason switch
                {
                    TransactionImportDuplicateReason.ExistingDuplicate => "existingDuplicate",
                    TransactionImportDuplicateReason.FileDuplicate => "fileDuplicate",
                    _ => null
                }
            })
        });
    }

    [HttpPost("import")]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxTransactionImportSizeBytes)]
    [RequestSizeLimit(MaxTransactionImportSizeBytes)]
    public async Task<IActionResult> ImportTransactions(
        [FromForm] IFormFile? file,
        [FromForm] string? delimiter = null,
        [FromForm] bool hasHeaderRow = true,
        [FromForm] int? dateColumnIndex = null,
        [FromForm] int? amountColumnIndex = null,
        [FromForm] int? descriptionColumnIndex = null)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return UnauthorizedProblem("A valid authenticated user is required to import transactions.");
        }

        var validationResult = ValidateTransactionImportFile(file, out var fileExtension);
        if (validationResult is not null)
        {
            return validationResult;
        }

        _logger.LogInformation("API processing transaction import: {FileName}", file!.FileName);

        var parsedTransactions = ParseImportedTransactions(
            file,
            fileExtension,
            delimiter,
            hasHeaderRow,
            dateColumnIndex,
            amountColumnIndex,
            descriptionColumnIndex);

        if (parsedTransactions.Count == 0)
        {
            return NoValidImportRowsProblem();
        }

        var result = await _transactionImportService.ImportAsync(userId, parsedTransactions);

        return Ok(new
        {
            Message = "Import successful",
            result.TotalParsed,
            result.Imported,
            result.DuplicatesSkipped,
            result.RedactedTransactions
        });
    }

    private IActionResult? ValidateTransactionImportFile(
        IFormFile? file,
        out string fileExtension)
    {
        fileExtension = string.Empty;

        if (file == null || file.Length == 0)
        {
            return this.ApiValidationProblem(
                "Invalid transaction import",
                "A non-empty CSV or XLSX file is required.",
                errors => errors.AddModelError(nameof(file), "Please upload a CSV or XLSX file."));
        }

        fileExtension = Path.GetExtension(file.FileName);

        if (!AllowedTransactionImportExtensions.Contains(fileExtension))
        {
            return this.ApiValidationProblem(
                "Invalid transaction import",
                "Only .csv and .xlsx files are supported.",
                errors => errors.AddModelError(nameof(file), "The uploaded file must have a .csv or .xlsx extension."));
        }

        if (file.Length > MaxTransactionImportSizeBytes)
        {
            return this.ApiValidationProblem(
                "Invalid transaction import",
                $"The uploaded file exceeds the {MaxTransactionImportSizeBytes / (1024 * 1024)} MB limit.",
                errors => errors.AddModelError(nameof(file), "The uploaded file is too large."));
        }

        if (!IsSupportedImportContentType(fileExtension, file.ContentType))
        {
            return this.ApiValidationProblem(
                "Invalid transaction import",
                "The uploaded file does not look like a supported transaction import file.",
                errors => errors.AddModelError(nameof(file), "Unsupported file content type."));
        }

        return null;
    }

    private List<Transaction> ParseImportedTransactions(
        IFormFile file,
        string fileExtension,
        string? delimiter,
        bool hasHeaderRow,
        int? dateColumnIndex,
        int? amountColumnIndex,
        int? descriptionColumnIndex)
    {
        using var stream = file.OpenReadStream();
        return string.Equals(fileExtension, ".xlsx", StringComparison.OrdinalIgnoreCase)
            ? _transactionImportParser.ParseXlsxTransactions(
                    stream,
                    new TransactionImportMapping(
                        hasHeaderRow,
                        dateColumnIndex,
                        amountColumnIndex,
                        descriptionColumnIndex))
                .ToList()
            : _transactionImportParser.ParseCsvTransactions(stream, delimiter).ToList();
    }

    private IActionResult NoValidImportRowsProblem()
    {
        return this.ApiValidationProblem(
            "Invalid transaction import",
            "No valid transactions were found in the uploaded file.",
            errors => errors.AddModelError("file", "The uploaded file does not contain any valid transaction rows."));
    }

    private static bool IsSupportedImportContentType(string fileExtension, string? contentType)
    {
        if (string.IsNullOrWhiteSpace(contentType))
        {
            return true;
        }

        return fileExtension.Equals(".xlsx", StringComparison.OrdinalIgnoreCase)
            ? AllowedXlsxContentTypes.Contains(contentType)
            : AllowedCsvContentTypes.Contains(contentType);
    }

    [HttpPut("{transactionId:guid}")]
    public async Task<IActionResult> Update(
        Guid transactionId,
        [FromBody] UpdateTransactionRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId is null)
        {
            return UnauthorizedProblem("A valid authenticated user is required to update transactions.");
        }

        var category = TransactionCategories.Normalize(request.Category);
        var description = request.Description?.Trim();
        var notes = string.IsNullOrWhiteSpace(request.Notes)
            ? null
            : request.Notes.Trim();
        var treatment = string.IsNullOrWhiteSpace(request.Treatment)
            ? TransactionTreatment.GetDefault(request.Amount, category)
            : TransactionTreatment.Normalize(request.Treatment);
        var hasInvalidTreatment = treatment is null;
        var financialValueValidation = FinancialValueValidator.Validate(
            request.Amount,
            request.Date);

        if (!financialValueValidation.IsValid ||
            string.IsNullOrWhiteSpace(description) ||
            description.Length > 200 ||
            notes?.Length > 500 ||
            category is null ||
            hasInvalidTreatment)
        {
            return this.ApiValidationProblem(
                "Invalid transaction",
                "Check the provided transaction details and try again.",
                errors =>
                {
                    foreach (var error in financialValueValidation.DateErrors)
                    {
                        errors.AddModelError(nameof(request.Date), error);
                    }

                    foreach (var error in financialValueValidation.AmountErrors)
                    {
                        errors.AddModelError(nameof(request.Amount), error);
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

                    if (hasInvalidTreatment)
                    {
                        errors.AddModelError(nameof(request.Treatment), "Unsupported transaction statistics treatment.");
                    }
                });
        }

        var transaction = await _repository.UpdateAsync(
            userId,
            transactionId,
            new TransactionUpdate
            {
                Date = request.Date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
                Amount = request.Amount,
                Description = description,
                Category = category,
                Treatment = treatment!,
                Notes = notes
            });

        if (transaction is null)
        {
            return TransactionNotFoundProblem();
        }

        return Ok(transaction);
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
            return TransactionNotFoundProblem();
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
            return TransactionNotFoundProblem();
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
            return TransactionNotFoundProblem();
        }

        var aiLocationContext = await _userPreferencesRepository.GetAiLocationContextAsync(userId);
        var categorizationResult = await _aiService.CategorizeTransactionsAsync(
            [transaction],
            aiLocationContext);

        if (categorizationResult.ChangedCount == 0 &&
            categorizationResult.FailedCount > 0)
        {
            return this.ApiProblem(
                StatusCodes.Status502BadGateway,
                "Upstream service failure",
                "The AI provider did not return a valid categorization result.",
                "urn:budgetbeacon:external-service");
        }

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
                ChangedCount = 0,
                FailedCount = 0,
                RemainingCount = 0,
                CategorizedCount = 0
            });
        }

        var aiLocationContext = await _userPreferencesRepository.GetAiLocationContextAsync(userId);
        var categorizationResult = await _aiService.CategorizeTransactionsAsync(
            uncategorized,
            aiLocationContext);

        if (categorizationResult.ChangedCount == 0 &&
            categorizationResult.FailedCount > 0)
        {
            return this.ApiProblem(
                StatusCodes.Status502BadGateway,
                "Upstream service failure",
                "The AI provider did not return any valid categorization results.",
                "urn:budgetbeacon:external-service");
        }

        if (categorizationResult.ChangedCount > 0)
        {
            await _repository.SaveChangesAsync();
        }

        var message = categorizationResult.FailedCount > 0
            ? "Categorization partially completed. Some transactions could not be categorized."
            : "Categorization successful.";

        return Ok(new
        {
            Message = message,
            categorizationResult.ProcessedCount,
            categorizationResult.ChangedCount,
            categorizationResult.FailedCount,
            categorizationResult.RemainingCount,
            CategorizedCount = categorizationResult.ChangedCount
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
            var startDate = GetUtcTipsStartDate(monthsBack);
            (transactions, _) = await _repository.GetTransactionsPagedAsync(
                userId,
                new TransactionQueryOptions(StartDate: startDate),
                1,
                10000);
            timeframe = FormatTipsTimeframe(monthsBack);
        }

        if (!transactions.Any())
        {
            return this.ApiProblem(
                StatusCodes.Status404NotFound,
                "No transactions available for analysis",
                "No transactions were found in the selected timeframe to generate savings tips.",
                "urn:budgetbeacon:tips-source-data-not-found");
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
            "urn:budgetbeacon:authentication-required");
    }

    private IActionResult TransactionNotFoundProblem()
    {
        return this.ApiProblem(
            StatusCodes.Status404NotFound,
            "Transaction not found",
            "The requested transaction could not be found for the current user.",
            "urn:budgetbeacon:transaction-not-found");
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

    private static DateTime GetUtcTipsStartDate(int monthsBack)
    {
        var utcToday = DateOnly.FromDateTime(DateTime.UtcNow);
        return utcToday.AddMonths(-monthsBack).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
    }

    private static string FormatTipsTimeframe(int monthsBack) =>
        monthsBack switch
        {
            1 => "Last 1 month",
            12 => "Last 1 year",
            _ => $"Last {monthsBack} months"
        };

    private static bool TryParseTransactionTypeFilter(string? value, out TransactionTypeFilter transactionType)
    {
        transactionType = TransactionTypeFilter.All;

        if (string.IsNullOrWhiteSpace(value))
        {
            return true;
        }

        switch (value.Trim().ToLowerInvariant())
        {
            case "all":
                transactionType = TransactionTypeFilter.All;
                return true;
            case "income":
                transactionType = TransactionTypeFilter.Income;
                return true;
            case "expense":
                transactionType = TransactionTypeFilter.Expense;
                return true;
            default:
                return false;
        }
    }

    private static bool TryParseTransactionSortField(string? value, out TransactionSortField sortBy)
    {
        sortBy = TransactionSortField.Date;

        if (string.IsNullOrWhiteSpace(value))
        {
            return true;
        }

        switch (value.Trim().ToLowerInvariant())
        {
            case "date":
                sortBy = TransactionSortField.Date;
                return true;
            case "amount":
                sortBy = TransactionSortField.Amount;
                return true;
            case "category":
                sortBy = TransactionSortField.Category;
                return true;
            case "description":
                sortBy = TransactionSortField.Description;
                return true;
            default:
                return false;
        }
    }

    private static bool TryParseTransactionSortDirection(string? value, out TransactionSortDirection sortDirection)
    {
        sortDirection = TransactionSortDirection.Desc;

        if (string.IsNullOrWhiteSpace(value))
        {
            return true;
        }

        switch (value.Trim().ToLowerInvariant())
        {
            case "asc":
                sortDirection = TransactionSortDirection.Asc;
                return true;
            case "desc":
                sortDirection = TransactionSortDirection.Desc;
                return true;
            default:
                return false;
        }
    }

    public sealed record UpdateTransactionCategoryRequest(string? Category);
    public sealed record CreateTransactionRequest(
        DateOnly Date,
        decimal Amount,
        string? Description,
        string? Category,
        string? Notes,
        string? Treatment = null);
    public sealed record UpdateTransactionRequest(
        DateOnly Date,
        decimal Amount,
        string? Description,
        string? Category,
        string? Notes,
        string? Treatment = null);

}
