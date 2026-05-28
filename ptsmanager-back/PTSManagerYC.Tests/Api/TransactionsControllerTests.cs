using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using PTSManagerWeb.Api.Controllers;
using PTSManagerYC.Core.Entities;
using PTSManagerYC.Core.Interfaces;
using PTSManagerYC.Core.Models;
using PTSManagerYC.Core.Services;

namespace PTSManagerYC.Tests.Api;

public sealed class TransactionsControllerTests
{
    [Fact]
    public async Task GetAllTransactions_ReturnsUnauthorizedProblemWithoutAuthenticatedUser()
    {
        var controller = CreateController(userId: null);

        var result = await controller.GetAllTransactions(null);

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status401Unauthorized, objectResult.StatusCode);
        var problem = Assert.IsType<ProblemDetails>(objectResult.Value);
        Assert.Equal("urn:ptsmanager:authentication-required", problem.Type);
    }

    [Fact]
    public async Task GetAllTransactions_ReturnsValidationProblemForInvalidPagination()
    {
        var controller = CreateController();

        var result = await controller.GetAllTransactions(null, page: 0, pageSize: 201);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var problem = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.Contains("page", problem.Errors.Keys);
        Assert.Contains("pageSize", problem.Errors.Keys);
    }

    [Fact]
    public async Task GetMonthlySummary_ReturnsSummaryForRequestedMonth()
    {
        var repository = new FakeTransactionRepository
        {
            MonthlyTransactions =
            [
                new Transaction { Amount = 1000m, Date = new DateTime(2026, 4, 1), UserId = "user-1" },
                new Transaction { Amount = -10m, Date = new DateTime(2026, 4, 3), UserId = "user-1" },
                new Transaction { Amount = -30m, Date = new DateTime(2026, 4, 4), UserId = "user-1" }
            ]
        };
        var controller = CreateController(repository);

        var result = await controller.GetMonthlySummary(2026, 4);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(1000m, GetValue<decimal>(ok.Value, "TotalIncome"));
        Assert.Equal(-40m, GetValue<decimal>(ok.Value, "TotalExpense"));
        Assert.Equal(960m, GetValue<decimal>(ok.Value, "NetBalance"));
        Assert.Equal(-20m, GetValue<decimal>(ok.Value, "AverageExpense"));
        Assert.Equal(-20m, GetValue<decimal>(ok.Value, "MedianExpense"));
        Assert.Equal(3, GetValue<int>(ok.Value, "TransactionCount"));
    }

    [Theory]
    [InlineData(1999, 4, "year")]
    [InlineData(2026, 0, "month")]
    [InlineData(2026, 13, "month")]
    public async Task GetMonthlySummary_ReturnsValidationProblemForInvalidDateParts(
        int year,
        int month,
        string expectedErrorKey)
    {
        var controller = CreateController();

        var result = await controller.GetMonthlySummary(year, month);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var problem = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.Contains(expectedErrorKey, problem.Errors.Keys);
    }

    [Fact]
    public async Task UploadCsv_ReturnsValidationProblemForNullFile()
    {
        var csvReader = new FakeCsvReaderService();
        var controller = CreateController(csvReader: csvReader);

        var result = await controller.UploadCsv(null);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var problem = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.Contains("file", problem.Errors.Keys);
        Assert.Equal(0, csvReader.ParseCalls);
    }

    [Fact]
    public async Task UploadCsv_ReturnsValidationProblemForUnsupportedFileExtension()
    {
        var csvReader = new FakeCsvReaderService();
        var controller = CreateController(csvReader: csvReader);
        var file = CreateFormFile("transactions.txt", "text/csv");

        var result = await controller.UploadCsv(file);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(0, csvReader.ParseCalls);
    }

    [Fact]
    public async Task UploadCsv_UsesAtomicImportAndAssignsCurrentUserAndFingerprints()
    {
        var repository = new FakeTransactionRepository
        {
            ImportedCount = 1
        };
        var csvReader = new FakeCsvReaderService
        {
            ParsedTransactions =
            [
                new Transaction
                {
                    Date = new DateTime(2026, 4, 3),
                    Amount = -12.34m,
                    Metadata = new TransactionMetadata { RawDescription = "  Existing   transaction " }
                },
                new Transaction
                {
                    Date = new DateTime(2026, 4, 4),
                    Amount = -20m,
                    Metadata = new TransactionMetadata { RawDescription = "New transaction" }
                }
            ]
        };
        var controller = CreateController(repository, csvReader: csvReader);
        var file = CreateFormFile("transactions.csv", "text/csv");

        var result = await controller.UploadCsv(file);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(2, GetValue<int>(ok.Value, "TotalParsed"));
        Assert.Equal(1, GetValue<int>(ok.Value, "Imported"));
        Assert.Equal(1, GetValue<int>(ok.Value, "DuplicatesSkipped"));

        Assert.Equal(2, repository.ImportAttemptedTransactions.Count);
        Assert.All(repository.ImportAttemptedTransactions, transaction =>
        {
            Assert.Equal("user-1", transaction.UserId);
            Assert.Equal(TransactionImportFingerprint.Create(transaction), transaction.ImportFingerprint);
        });
        Assert.Empty(repository.AddedTransactions);
    }

    [Fact]
    public async Task UpdateCategory_UpdatesCurrentUsersTransaction()
    {
        var transactionId = Guid.NewGuid();
        var transaction = new Transaction
        {
            Id = transactionId,
            UserId = "user-1",
            Category = "Uncategorized",
            Metadata = new TransactionMetadata
            {
                RawDescription = "Test",
                AiSuggestedCategory = "Groceries",
                AiConfidenceScore = 0.91
            }
        };
        var repository = new FakeTransactionRepository
        {
            TransactionToUpdate = transaction
        };
        var controller = CreateController(repository);

        var result = await controller.UpdateCategory(
            transactionId,
            new TransactionsController.UpdateTransactionCategoryRequest("transport"));

        var ok = Assert.IsType<OkObjectResult>(result);
        var updatedTransaction = Assert.IsType<Transaction>(ok.Value);
        Assert.Equal("Transport", updatedTransaction.Category);
        Assert.Null(updatedTransaction.Metadata.AiSuggestedCategory);
        Assert.Null(updatedTransaction.Metadata.AiConfidenceScore);
        Assert.Equal("user-1", repository.LastUpdateCategoryUserId);
        Assert.Equal(transactionId, repository.LastUpdateCategoryTransactionId);
    }

    [Fact]
    public async Task UpdateCategory_ReturnsValidationProblemForUnsupportedCategory()
    {
        var controller = CreateController();

        var result = await controller.UpdateCategory(
            Guid.NewGuid(),
            new TransactionsController.UpdateTransactionCategoryRequest("Not real"));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var problem = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.Contains("Category", problem.Errors.Keys);
    }

    [Fact]
    public async Task UpdateCategory_ReturnsNotFoundWhenTransactionIsNotOwnedByCurrentUser()
    {
        var repository = new FakeTransactionRepository();
        var controller = CreateController(repository);

        var result = await controller.UpdateCategory(
            Guid.NewGuid(),
            new TransactionsController.UpdateTransactionCategoryRequest("Groceries"));

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status404NotFound, objectResult.StatusCode);
    }

    [Fact]
    public async Task Delete_RemovesCurrentUsersTransaction()
    {
        var transactionId = Guid.NewGuid();
        var repository = new FakeTransactionRepository
        {
            TransactionToDelete = new Transaction
            {
                Id = transactionId,
                UserId = "user-1"
            }
        };
        var controller = CreateController(repository);

        var result = await controller.Delete(transactionId);

        Assert.IsType<NoContentResult>(result);
        Assert.True(repository.DeleteCalled);
        Assert.Equal("user-1", repository.LastDeleteUserId);
        Assert.Equal(transactionId, repository.LastDeleteTransactionId);
    }

    [Fact]
    public async Task Delete_ReturnsNotFoundWhenTransactionIsNotOwnedByCurrentUser()
    {
        var repository = new FakeTransactionRepository();
        var controller = CreateController(repository);

        var result = await controller.Delete(Guid.NewGuid());

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status404NotFound, objectResult.StatusCode);
    }

    [Fact]
    public async Task RegenerateCategory_CategorizesCurrentUsersTransaction()
    {
        var transactionId = Guid.NewGuid();
        var transaction = new Transaction
        {
            Id = transactionId,
            UserId = "user-1",
            Category = "Uncategorized",
            Metadata = new TransactionMetadata
            {
                RawDescription = "Bakery purchase"
            }
        };
        var repository = new FakeTransactionRepository
        {
            TransactionById = transaction
        };
        var preferencesRepository = new FakeUserPreferencesRepository
        {
            AiLocationContext = "Brixen, South Tyrol, Italy"
        };
        var aiService = new FakeAiAdvisorService
        {
            CategorizeAction = items =>
            {
                items[0].Category = "Dining";
                items[0].Metadata.AiSuggestedCategory = "Dining";
                items[0].Metadata.AiConfidenceScore = 0.87;
                return Task.CompletedTask;
            }
        };
        var controller = CreateController(repository, preferencesRepository, aiService: aiService);

        var result = await controller.RegenerateCategory(transactionId);

        var ok = Assert.IsType<OkObjectResult>(result);
        var updatedTransaction = Assert.IsType<Transaction>(ok.Value);
        Assert.Equal("Dining", updatedTransaction.Category);
        Assert.Equal(0.87, updatedTransaction.Metadata.AiConfidenceScore);
        Assert.Equal("user-1", repository.LastGetByIdUserId);
        Assert.Equal(transactionId, repository.LastGetByIdTransactionId);
        Assert.Equal(1, aiService.CategorizeCalls);
        Assert.Equal("Brixen, South Tyrol, Italy", aiService.LastCategorizationLocationContext);
        Assert.True(repository.SaveChangesCalled);
    }

    [Fact]
    public async Task RegenerateCategory_ReturnsNotFoundWhenTransactionIsNotOwnedByCurrentUser()
    {
        var repository = new FakeTransactionRepository();
        var aiService = new FakeAiAdvisorService();
        var controller = CreateController(repository, aiService: aiService);

        var result = await controller.RegenerateCategory(Guid.NewGuid());

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status404NotFound, objectResult.StatusCode);
        Assert.Equal(0, aiService.CategorizeCalls);
        Assert.False(repository.SaveChangesCalled);
    }

    [Fact]
    public async Task TriggerCategorization_ReturnsNoOpWhenThereAreNoUncategorizedTransactions()
    {
        var aiService = new FakeAiAdvisorService();
        var repository = new FakeTransactionRepository();
        var controller = CreateController(repository, aiService: aiService);

        var result = await controller.TriggerCategorization();

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(0, GetValue<int>(ok.Value, "ProcessedCount"));
        Assert.Equal(0, GetValue<int>(ok.Value, "CategorizedCount"));
        Assert.Equal(0, aiService.CategorizeCalls);
        Assert.False(repository.SaveChangesCalled);
    }

    [Fact]
    public async Task TriggerCategorization_SavesAndCountsOnlyTransactionsChangedFromUncategorized()
    {
        var transactions = new List<Transaction>
        {
            new() { Category = "Uncategorized" },
            new() { Category = "Uncategorized" }
        };
        var repository = new FakeTransactionRepository
        {
            UncategorizedTransactions = transactions
        };
        var preferencesRepository = new FakeUserPreferencesRepository
        {
            AiLocationContext = "Bolzano, South Tyrol, Italy"
        };
        var aiService = new FakeAiAdvisorService
        {
            CategorizeAction = items =>
            {
                items[0].Category = "Groceries";
                return Task.CompletedTask;
            }
        };
        var controller = CreateController(repository, preferencesRepository, aiService: aiService);

        var result = await controller.TriggerCategorization();

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(2, GetValue<int>(ok.Value, "ProcessedCount"));
        Assert.Equal(1, GetValue<int>(ok.Value, "CategorizedCount"));
        Assert.Equal(1, aiService.CategorizeCalls);
        Assert.Equal("Bolzano, South Tyrol, Italy", aiService.LastCategorizationLocationContext);
        Assert.True(repository.SaveChangesCalled);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(25)]
    public async Task GetAiSavingsTips_ReturnsValidationProblemForInvalidMonthsBack(int monthsBack)
    {
        var controller = CreateController();

        var result = await controller.GetAiSavingsTips(monthsBack);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var problem = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.Contains("monthsBack", problem.Errors.Keys);
    }

    [Fact]
    public async Task GetAiSavingsTips_ReturnsTipsForPagedTransactions()
    {
        var repository = new FakeTransactionRepository
        {
            PagedTransactions = [new Transaction { Amount = -25m, Category = "Groceries" }],
            PagedTotalCount = 1
        };
        var preferencesRepository = new FakeUserPreferencesRepository
        {
            AiLocationContext = "Merano, South Tyrol, Italy"
        };
        var aiService = new FakeAiAdvisorService
        {
            SavingTips =
            [
                new SavingsTip
                {
                    Id = "tip-1",
                    Title = "Plan groceries",
                    Description = "Use a weekly shopping list.",
                    Impact = "Medium",
                    Category = "Groceries"
                }
            ]
        };
        var controller = CreateController(repository, preferencesRepository, aiService: aiService);

        var result = await controller.GetAiSavingsTips(3);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal("Last 3 months", GetValue<string>(ok.Value, "Timeframe"));
        var tips = Assert.IsAssignableFrom<IReadOnlyList<SavingsTip>>(GetRawValue(ok.Value, "Tips"));
        var tip = Assert.Single(tips);
        Assert.Equal("tip-1", tip.Id);
        Assert.Equal(1, aiService.GetSavingTipsCalls);
        Assert.Equal("Merano, South Tyrol, Italy", aiService.LastSavingsTipsLocationContext);
    }

    private static TransactionsController CreateController(
        FakeTransactionRepository? repository = null,
        FakeUserPreferencesRepository? preferencesRepository = null,
        FakeAiAdvisorService? aiService = null,
        FakeCsvReaderService? csvReader = null,
        string? userId = "user-1")
    {
        var controller = new TransactionsController(
            repository ?? new FakeTransactionRepository(),
            preferencesRepository ?? new FakeUserPreferencesRepository(),
            new FinanceAggregationService(),
            aiService ?? new FakeAiAdvisorService(),
            csvReader ?? new FakeCsvReaderService(),
            NullLogger<TransactionsController>.Instance);

        var httpContext = new DefaultHttpContext
        {
            TraceIdentifier = "test-trace-id"
        };
        httpContext.Request.Path = "/api/transactions";

        if (userId is not null)
        {
            httpContext.User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, userId)],
                authenticationType: "UnitTest"));
        }

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = httpContext
        };

        return controller;
    }

    private static FormFile CreateFormFile(string fileName, string contentType)
    {
        var bytes = Encoding.UTF8.GetBytes("Datum;Betrag;Beschreibung\r\n2026-04-03;-1,00;Test");
        var stream = new MemoryStream(bytes);
        return new FormFile(stream, 0, stream.Length, "file", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };
    }

    private static T GetValue<T>(object? source, string propertyName)
    {
        var value = GetRawValue(source, propertyName);
        return Assert.IsType<T>(value);
    }

    private static object? GetRawValue(object? source, string propertyName)
    {
        Assert.NotNull(source);
        return source.GetType().GetProperty(propertyName)?.GetValue(source);
    }

    private sealed class FakeTransactionRepository : ITransactionRepository
    {
        public List<Transaction> AddedTransactions { get; } = [];
        public List<Transaction> ImportAttemptedTransactions { get; } = [];
        public IEnumerable<Transaction> AllTransactions { get; init; } = [];
        public List<Transaction> UncategorizedTransactions { get; init; } = [];
        public IEnumerable<Transaction> MonthlyTransactions { get; init; } = [];
        public IEnumerable<Transaction> PagedTransactions { get; init; } = [];
        public int PagedTotalCount { get; init; }
        public int ImportedCount { get; init; }
        public bool SaveChangesCalled { get; private set; }
        public bool DeleteCalled { get; private set; }
        public Transaction? TransactionById { get; init; }
        public Transaction? TransactionToDelete { get; init; }
        public Transaction? TransactionToUpdate { get; init; }
        public string? LastDeleteUserId { get; private set; }
        public Guid? LastDeleteTransactionId { get; private set; }
        public string? LastGetByIdUserId { get; private set; }
        public Guid? LastGetByIdTransactionId { get; private set; }
        public string? LastUpdateCategoryUserId { get; private set; }
        public Guid? LastUpdateCategoryTransactionId { get; private set; }

        public Task AddRangeAsync(IEnumerable<Transaction> transactions)
        {
            AddedTransactions.AddRange(transactions);
            return Task.CompletedTask;
        }

        public Task<int> AddImportedTransactionsAsync(IEnumerable<Transaction> transactions)
        {
            ImportAttemptedTransactions.AddRange(transactions);
            return Task.FromResult(ImportedCount);
        }

        public Task<bool> DeleteAsync(string userId, Guid transactionId)
        {
            LastDeleteUserId = userId;
            LastDeleteTransactionId = transactionId;

            if (TransactionToDelete is null ||
                TransactionToDelete.Id != transactionId ||
                TransactionToDelete.UserId != userId)
            {
                return Task.FromResult(false);
            }

            DeleteCalled = true;
            return Task.FromResult(true);
        }

        public Task<Transaction?> GetByIdAsync(string userId, Guid transactionId)
        {
            LastGetByIdUserId = userId;
            LastGetByIdTransactionId = transactionId;

            if (TransactionById is null ||
                TransactionById.Id != transactionId ||
                TransactionById.UserId != userId)
            {
                return Task.FromResult<Transaction?>(null);
            }

            return Task.FromResult<Transaction?>(TransactionById);
        }

        public Task SaveChangesAsync()
        {
            SaveChangesCalled = true;
            return Task.CompletedTask;
        }

        public Task<Transaction?> UpdateCategoryAsync(string userId, Guid transactionId, string category)
        {
            LastUpdateCategoryUserId = userId;
            LastUpdateCategoryTransactionId = transactionId;

            if (TransactionToUpdate is null ||
                TransactionToUpdate.Id != transactionId ||
                TransactionToUpdate.UserId != userId)
            {
                return Task.FromResult<Transaction?>(null);
            }

            TransactionToUpdate.Category = category;
            TransactionToUpdate.Metadata.AiSuggestedCategory = null;
            TransactionToUpdate.Metadata.AiConfidenceScore = null;

            return Task.FromResult<Transaction?>(TransactionToUpdate);
        }

        public Task<IEnumerable<Transaction>> GetAllAsync(string userId)
        {
            return Task.FromResult(AllTransactions);
        }

        public Task<List<Transaction>> GetUncategorizedAsync(string userId)
        {
            return Task.FromResult(UncategorizedTransactions);
        }

        public Task<IEnumerable<Transaction>> GetByMonthAsync(string userId, int year, int month)
        {
            return Task.FromResult(MonthlyTransactions);
        }

        public Task<IEnumerable<Transaction>> GetByDateRangeAsync(string userId, DateTime startDate, DateTime endDate)
        {
            return Task.FromResult(Enumerable.Empty<Transaction>());
        }

        public Task<(IEnumerable<Transaction> Items, int TotalCount)> GetTransactionsPagedAsync(
            string userId,
            DateTime? startDate,
            int pageNumber,
            int pageSize)
        {
            return Task.FromResult((PagedTransactions, PagedTotalCount));
        }
    }

    private sealed class FakeUserPreferencesRepository : IUserPreferencesRepository
    {
        public string? AiLocationContext { get; init; }

        public Task<UserPreferences?> GetAsync(string userId)
        {
            return Task.FromResult<UserPreferences?>(new UserPreferences
            {
                AiLocationContext = AiLocationContext
            });
        }

        public Task<string?> GetAiLocationContextAsync(string userId)
        {
            return Task.FromResult(AiLocationContext);
        }

        public Task<UserPreferences?> UpdateAsync(string userId, string? aiLocationContext)
        {
            return Task.FromResult<UserPreferences?>(new UserPreferences
            {
                AiLocationContext = aiLocationContext
            });
        }
    }

    private sealed class FakeAiAdvisorService : IAiAdvisorService
    {
        public int CategorizeCalls { get; private set; }
        public int GetSavingTipsCalls { get; private set; }
        public string? LastCategorizationLocationContext { get; private set; }
        public string? LastSavingsTipsLocationContext { get; private set; }
        public Func<List<Transaction>, Task>? CategorizeAction { get; init; }
        public IReadOnlyList<SavingsTip> SavingTips { get; init; } = [];

        public Task CategorizeTransactionsAsync(List<Transaction> transactions, string? aiLocationContext = null)
        {
            CategorizeCalls++;
            LastCategorizationLocationContext = aiLocationContext;
            return CategorizeAction?.Invoke(transactions) ?? Task.CompletedTask;
        }

        public Task<IReadOnlyList<SavingsTip>> GetSavingTipsAsync(
            IEnumerable<Transaction> transactions,
            string? aiLocationContext = null)
        {
            GetSavingTipsCalls++;
            LastSavingsTipsLocationContext = aiLocationContext;
            return Task.FromResult(SavingTips);
        }
    }

    private sealed class FakeCsvReaderService : ICsvReaderService
    {
        public int ParseCalls { get; private set; }
        public IEnumerable<Transaction> ParsedTransactions { get; init; } = [];

        public IEnumerable<Transaction> ParseTransactions(Stream fileStream)
        {
            ParseCalls++;
            return ParsedTransactions;
        }
    }
}
