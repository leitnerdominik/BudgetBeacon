using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using BudgetBeacon.Api.Controllers;
using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Exceptions;
using BudgetBeacon.Core.Interfaces;
using BudgetBeacon.Core.Models;
using BudgetBeacon.Core.Services;

namespace BudgetBeacon.Tests.Api;

public sealed class TransactionsControllerTests
{
    public static TheoryData<bool, decimal, DateTime, string> InvalidImportedFinancialValues =>
        new()
        {
            {
                false,
                0m,
                new DateTime(2026, 4, 3),
                "Amount must not be zero."
            },
            {
                true,
                0m,
                new DateTime(2026, 4, 3),
                "Amount must not be zero."
            },
            {
                false,
                1.234m,
                new DateTime(2026, 4, 3),
                "Amount must have no more than 2 decimal places."
            },
            {
                true,
                1.234m,
                new DateTime(2026, 4, 3),
                "Amount must have no more than 2 decimal places."
            },
            {
                false,
                10_000_000_000_000m,
                new DateTime(2026, 4, 3),
                "Amount must be between"
            },
            {
                true,
                -10_000_000_000_000m,
                new DateTime(2026, 4, 3),
                "Amount must be between"
            },
            {
                false,
                1m,
                new DateTime(1999, 12, 31),
                "Date must be between"
            },
            {
                true,
                1m,
                new DateTime(2101, 1, 1),
                "Date must be between"
            }
        };

    [Fact]
    public async Task GetAllTransactions_ReturnsUnauthorizedProblemWithoutAuthenticatedUser()
    {
        var controller = CreateController(userId: null);

        var result = await controller.GetAllTransactions(null);

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status401Unauthorized, objectResult.StatusCode);
        var problem = Assert.IsType<ProblemDetails>(objectResult.Value);
        Assert.Equal("urn:budgetbeacon:authentication-required", problem.Type);
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
    public async Task GetAllTransactions_ReturnsValidationProblemForInvalidFilterAndSortValues()
    {
        var controller = CreateController();

        var result = await controller.GetAllTransactions(
            startDate: new DateOnly(2026, 2, 1),
            endDate: new DateOnly(2026, 1, 1),
            searchTerm: new string('a', 101),
            category: "Not a category",
            transactionType: "refund",
            sortBy: "balance",
            sortDirection: "sideways");

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var problem = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.Contains("endDate", problem.Errors.Keys);
        Assert.Contains("searchTerm", problem.Errors.Keys);
        Assert.Contains("category", problem.Errors.Keys);
        Assert.Contains("transactionType", problem.Errors.Keys);
        Assert.Contains("sortBy", problem.Errors.Keys);
        Assert.Contains("sortDirection", problem.Errors.Keys);
    }

    [Fact]
    public async Task GetAllTransactions_PassesValidatedQueryOptionsToRepository()
    {
        var repository = new FakeTransactionRepository();
        var controller = CreateController(repository);

        var result = await controller.GetAllTransactions(
            startDate: new DateOnly(2026, 1, 1),
            endDate: new DateOnly(2026, 1, 31),
            searchTerm: "  market  ",
            category: " other ",
            transactionType: "expense",
            sortBy: "amount",
            sortDirection: "asc",
            page: 2,
            pageSize: 25);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal("user-1", repository.LastPagedUserId);
        Assert.NotNull(repository.LastPagedOptions);
        Assert.Equal(new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc), repository.LastPagedOptions.StartDate);
        Assert.Equal(new DateTime(2026, 1, 31, 23, 59, 59, 999, DateTimeKind.Utc).AddTicks(9999), repository.LastPagedOptions.EndDate);
        Assert.Equal("market", repository.LastPagedOptions.SearchTerm);
        Assert.Equal("Other", repository.LastPagedOptions.Category);
        Assert.Equal(TransactionTypeFilter.Expense, repository.LastPagedOptions.TransactionType);
        Assert.Equal(TransactionSortField.Amount, repository.LastPagedOptions.SortBy);
        Assert.Equal(TransactionSortDirection.Asc, repository.LastPagedOptions.SortDirection);
        Assert.Equal(2, repository.LastPagedPageNumber);
        Assert.Equal(25, repository.LastPagedPageSize);
    }

    [Fact]
    public async Task GetById_ReturnsCurrentUsersTransaction()
    {
        var transactionId = Guid.NewGuid();
        var transaction = new Transaction
        {
            Id = transactionId,
            UserId = "user-1",
            Amount = -12.34m
        };
        var repository = new FakeTransactionRepository
        {
            TransactionById = transaction
        };
        var controller = CreateController(repository);

        var result = await controller.GetById(transactionId);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Same(transaction, ok.Value);
        Assert.Equal("user-1", repository.LastGetByIdUserId);
        Assert.Equal(transactionId, repository.LastGetByIdTransactionId);
    }

    [Fact]
    public async Task GetById_ReturnsNotFoundWhenTransactionIsNotOwnedByCurrentUser()
    {
        var controller = CreateController(new FakeTransactionRepository());

        var result = await controller.GetById(Guid.NewGuid());

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status404NotFound, objectResult.StatusCode);
    }

    [Fact]
    public async Task Create_StoresTrimmedNotesForCurrentUser()
    {
        var repository = new FakeTransactionRepository();
        var controller = CreateController(repository);

        var result = await controller.Create(new TransactionsController.CreateTransactionRequest(
            new DateOnly(2026, 6, 4),
            -12.34m,
            "  Grocery store  ",
            "food & groceries",
            "  Weekly shopping  "));

        var created = Assert.IsType<CreatedResult>(result);
        var transaction = Assert.IsType<Transaction>(created.Value);
        Assert.Equal("user-1", transaction.UserId);
        Assert.Equal("Food & Groceries", transaction.Category);
        Assert.Equal(TransactionTreatment.Expense, transaction.Treatment);
        Assert.Equal("Weekly shopping", transaction.Notes);
        Assert.Equal("Grocery store", transaction.Metadata.RawDescription);
        Assert.Same(transaction, Assert.Single(repository.AddedTransactions));
    }

    [Fact]
    public async Task Create_StoresWhitespaceOnlyNotesAsNull()
    {
        var repository = new FakeTransactionRepository();
        var controller = CreateController(repository);

        var result = await controller.Create(new TransactionsController.CreateTransactionRequest(
            new DateOnly(2026, 6, 4),
            2500m,
            "Salary",
            "Income",
            "   "));

        var created = Assert.IsType<CreatedResult>(result);
        var transaction = Assert.IsType<Transaction>(created.Value);
        Assert.Null(transaction.Notes);
        Assert.Equal(TransactionTreatment.Income, transaction.Treatment);
    }

    [Fact]
    public async Task Create_AcceptsOtherCategoryCaseInsensitively()
    {
        var repository = new FakeTransactionRepository();
        var controller = CreateController(repository);

        var result = await controller.Create(new TransactionsController.CreateTransactionRequest(
            new DateOnly(2026, 6, 4),
            -25m,
            "Miscellaneous purchase",
            " other ",
            null));

        var created = Assert.IsType<CreatedResult>(result);
        var transaction = Assert.IsType<Transaction>(created.Value);
        Assert.Equal("Other", transaction.Category);
        Assert.Equal(TransactionTreatment.Expense, transaction.Treatment);
        Assert.Same(transaction, Assert.Single(repository.AddedTransactions));
    }

    [Fact]
    public async Task Create_AcceptsExplicitTreatment()
    {
        var repository = new FakeTransactionRepository();
        var controller = CreateController(repository);

        var result = await controller.Create(new TransactionsController.CreateTransactionRequest(
            new DateOnly(2026, 6, 4),
            -500m,
            "ETF savings",
            "Savings & Investments",
            null,
            "SavingsInvestment"));

        var created = Assert.IsType<CreatedResult>(result);
        var transaction = Assert.IsType<Transaction>(created.Value);
        Assert.Equal(TransactionTreatment.SavingsInvestment, transaction.Treatment);
    }

    [Fact]
    public async Task Create_ReturnsValidationProblemForInvalidTreatment()
    {
        var repository = new FakeTransactionRepository();
        var controller = CreateController(repository);

        var result = await controller.Create(new TransactionsController.CreateTransactionRequest(
            new DateOnly(2026, 6, 4),
            -12.34m,
            "Grocery store",
            "Food & Groceries",
            null,
            "NotSupported"));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var problem = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.Contains("Treatment", problem.Errors.Keys);
        Assert.Empty(repository.AddedTransactions);
    }

    [Fact]
    public async Task Create_ReturnsValidationProblemWhenNotesAreTooLong()
    {
        var repository = new FakeTransactionRepository();
        var controller = CreateController(repository);

        var result = await controller.Create(new TransactionsController.CreateTransactionRequest(
            new DateOnly(2026, 6, 4),
            -12.34m,
            "Grocery store",
            "Food & Groceries",
            new string('a', 501)));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var problem = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.Contains("Notes", problem.Errors.Keys);
        Assert.Empty(repository.AddedTransactions);
    }

    [Fact]
    public async Task Create_ReturnsValidationProblemForInvalidFinancialValues()
    {
        var repository = new FakeTransactionRepository();
        var controller = CreateController(repository);

        var result = await controller.Create(new TransactionsController.CreateTransactionRequest(
            new DateOnly(1999, 12, 31),
            1.234m,
            "Grocery store",
            "Food & Groceries",
            null));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var problem = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.Contains("Date", problem.Errors.Keys);
        Assert.Contains("Amount", problem.Errors.Keys);
        Assert.Contains(
            problem.Errors["Amount"],
            error => error.Contains("2 decimal places", StringComparison.Ordinal));
        Assert.Empty(repository.AddedTransactions);
    }

    [Fact]
    public async Task Update_UpdatesAllFieldsAndKeepsImportFingerprint()
    {
        var transactionId = Guid.NewGuid();
        var fingerprint = new string('A', 64);
        var transaction = new Transaction
        {
            Id = transactionId,
            UserId = "user-1",
            Date = new DateTime(2026, 5, 1, 0, 0, 0, DateTimeKind.Utc),
            Amount = -10m,
            Category = "Food & Groceries",
            Notes = "Old note",
            ImportFingerprint = fingerprint,
            Metadata = new TransactionMetadata
            {
                RawDescription = "Old description",
                AiSuggestedCategory = "Food & Groceries",
                AiConfidenceScore = 0.91
            }
        };
        var repository = new FakeTransactionRepository
        {
            TransactionToUpdate = transaction
        };
        var controller = CreateController(repository);

        var result = await controller.Update(
            transactionId,
            new TransactionsController.UpdateTransactionRequest(
                new DateOnly(2026, 6, 4),
                1250m,
                "  Updated salary  ",
                "income",
                "  Updated note  "));

        var ok = Assert.IsType<OkObjectResult>(result);
        var updatedTransaction = Assert.IsType<Transaction>(ok.Value);
        Assert.Equal(new DateTime(2026, 6, 4, 0, 0, 0, DateTimeKind.Utc), updatedTransaction.Date);
        Assert.Equal(1250m, updatedTransaction.Amount);
        Assert.Equal("Income", updatedTransaction.Category);
        Assert.Equal(TransactionTreatment.Income, updatedTransaction.Treatment);
        Assert.Equal("Updated note", updatedTransaction.Notes);
        Assert.Equal("Updated salary", updatedTransaction.Metadata.RawDescription);
        Assert.Equal(fingerprint, updatedTransaction.ImportFingerprint);
        Assert.Null(updatedTransaction.Metadata.AiSuggestedCategory);
        Assert.Null(updatedTransaction.Metadata.AiConfidenceScore);
        Assert.Equal("user-1", repository.LastUpdateUserId);
        Assert.Equal(transactionId, repository.LastUpdateTransactionId);
    }

    [Fact]
    public async Task Update_KeepsAiMetadataWhenOnlyDateAmountAndNotesChange()
    {
        var transactionId = Guid.NewGuid();
        var transaction = new Transaction
        {
            Id = transactionId,
            UserId = "user-1",
            Date = new DateTime(2026, 5, 1, 0, 0, 0, DateTimeKind.Utc),
            Amount = -10m,
            Category = "Food & Groceries",
            Metadata = new TransactionMetadata
            {
                RawDescription = "Market",
                AiSuggestedCategory = "Food & Groceries",
                AiConfidenceScore = 0.91
            }
        };
        var repository = new FakeTransactionRepository
        {
            TransactionToUpdate = transaction
        };
        var controller = CreateController(repository);

        var result = await controller.Update(
            transactionId,
            new TransactionsController.UpdateTransactionRequest(
                new DateOnly(2026, 6, 4),
                -20m,
                "Market",
                "Food & Groceries",
                "New note"));

        var ok = Assert.IsType<OkObjectResult>(result);
        var updatedTransaction = Assert.IsType<Transaction>(ok.Value);
        Assert.Equal("Food & Groceries", updatedTransaction.Metadata.AiSuggestedCategory);
        Assert.Equal(0.91, updatedTransaction.Metadata.AiConfidenceScore);
    }

    [Fact]
    public async Task Update_AcceptsOtherCategoryCaseInsensitively()
    {
        var transactionId = Guid.NewGuid();
        var repository = new FakeTransactionRepository
        {
            TransactionToUpdate = new Transaction
            {
                Id = transactionId,
                UserId = "user-1",
                Date = new DateTime(2026, 5, 1, 0, 0, 0, DateTimeKind.Utc),
                Amount = -10m,
                Category = "Food & Groceries",
                Metadata = new TransactionMetadata { RawDescription = "Market" }
            }
        };
        var controller = CreateController(repository);

        var result = await controller.Update(
            transactionId,
            new TransactionsController.UpdateTransactionRequest(
                new DateOnly(2026, 5, 1),
                -10m,
                "Market",
                "OTHER",
                null));

        var ok = Assert.IsType<OkObjectResult>(result);
        var transaction = Assert.IsType<Transaction>(ok.Value);
        Assert.Equal("Other", transaction.Category);
        Assert.Equal(TransactionTreatment.Expense, transaction.Treatment);
    }

    [Fact]
    public async Task Update_ReturnsValidationProblemForInvalidTransaction()
    {
        var repository = new FakeTransactionRepository();
        var controller = CreateController(repository);

        var result = await controller.Update(
            Guid.NewGuid(),
            new TransactionsController.UpdateTransactionRequest(
                new DateOnly(1999, 1, 1),
                0m,
                " ",
                "Not real",
                new string('a', 501),
                "NotSupported"));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var problem = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.Contains("Date", problem.Errors.Keys);
        Assert.Contains("Amount", problem.Errors.Keys);
        Assert.Contains("Description", problem.Errors.Keys);
        Assert.Contains("Category", problem.Errors.Keys);
        Assert.Contains("Notes", problem.Errors.Keys);
        Assert.Contains("Treatment", problem.Errors.Keys);
        Assert.Null(repository.LastUpdateTransactionId);
    }

    [Fact]
    public async Task Update_ReturnsValidationProblemForOutOfRangeFinancialValues()
    {
        var repository = new FakeTransactionRepository();
        var controller = CreateController(repository);

        var result = await controller.Update(
            Guid.NewGuid(),
            new TransactionsController.UpdateTransactionRequest(
                new DateOnly(2101, 1, 1),
                10_000_000_000_000m,
                "Salary",
                "Income",
                null));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var problem = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.Contains("Date", problem.Errors.Keys);
        Assert.Contains("Amount", problem.Errors.Keys);
        Assert.Contains(
            problem.Errors["Amount"],
            error => error.Contains("9,999,999,999,999.99", StringComparison.Ordinal));
        Assert.Null(repository.LastUpdateTransactionId);
    }

    [Fact]
    public async Task Update_ReturnsNotFoundWhenTransactionIsNotOwnedByCurrentUser()
    {
        var controller = CreateController(new FakeTransactionRepository());

        var result = await controller.Update(
            Guid.NewGuid(),
            new TransactionsController.UpdateTransactionRequest(
                new DateOnly(2026, 6, 4),
                -20m,
                "Market",
                "Food & Groceries",
                null));

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status404NotFound, objectResult.StatusCode);
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

    [Fact]
    public async Task GetMonthlySummary_ReturnsEmptySummaryWhenMonthHasNoTransactions()
    {
        var controller = CreateController(new FakeTransactionRepository());

        var result = await controller.GetMonthlySummary(2026, 5);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(0m, GetValue<decimal>(ok.Value, "TotalIncome"));
        Assert.Equal(0m, GetValue<decimal>(ok.Value, "TotalExpense"));
        Assert.Equal(0m, GetValue<decimal>(ok.Value, "NetBalance"));
        Assert.Equal(0m, GetValue<decimal>(ok.Value, "AverageExpense"));
        Assert.Equal(0m, GetValue<decimal>(ok.Value, "MedianExpense"));
        Assert.Equal(0, GetValue<int>(ok.Value, "TransactionCount"));
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
    public async Task GetMonthlySummaries_ReturnsContinuousSummariesForRequestedRange()
    {
        var repository = new FakeTransactionRepository
        {
            RangeTransactions =
            [
                new Transaction { Amount = 1000m, Date = new DateTime(2026, 1, 1), UserId = "user-1" },
                new Transaction { Amount = -50m, Date = new DateTime(2026, 1, 12), UserId = "user-1" },
                new Transaction { Amount = -25m, Date = new DateTime(2026, 3, 4), UserId = "user-1" }
            ]
        };
        var controller = CreateController(repository);

        var result = await controller.GetMonthlySummaries(2026, 1, 2026, 3);

        var ok = Assert.IsType<OkObjectResult>(result);
        var summaries = Assert.IsAssignableFrom<IEnumerable<object>>(ok.Value).ToList();
        Assert.Equal(3, summaries.Count);

        Assert.Equal(2026, GetValue<int>(summaries[0], "Year"));
        Assert.Equal(1, GetValue<int>(summaries[0], "Month"));
        Assert.Equal(1000m, GetValue<decimal>(summaries[0], "TotalIncome"));
        Assert.Equal(-50m, GetValue<decimal>(summaries[0], "TotalExpense"));
        Assert.Equal(950m, GetValue<decimal>(summaries[0], "NetBalance"));
        Assert.Equal(2, GetValue<int>(summaries[0], "TransactionCount"));

        Assert.Equal(2, GetValue<int>(summaries[1], "Month"));
        Assert.Equal(0m, GetValue<decimal>(summaries[1], "NetBalance"));
        Assert.Equal(0, GetValue<int>(summaries[1], "TransactionCount"));

        Assert.Equal(3, GetValue<int>(summaries[2], "Month"));
        Assert.Equal(-25m, GetValue<decimal>(summaries[2], "TotalExpense"));
        Assert.Equal(-25m, GetValue<decimal>(summaries[2], "NetBalance"));
        Assert.Equal(1, GetValue<int>(summaries[2], "TransactionCount"));

        Assert.Equal("user-1", repository.LastDateRangeUserId);
        Assert.Equal(new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc), repository.LastDateRangeStartDate);
        Assert.Equal(
            new DateTime(2026, 4, 1, 0, 0, 0, DateTimeKind.Utc).AddTicks(-1),
            repository.LastDateRangeEndDate);
    }

    [Theory]
    [InlineData(1999, 1, 2026, 3, "startYear")]
    [InlineData(2026, 0, 2026, 3, "startMonth")]
    [InlineData(2026, 4, 2026, 3, "startMonth")]
    [InlineData(2024, 1, 2026, 2, "endMonth")]
    public async Task GetMonthlySummaries_ReturnsValidationProblemForInvalidRange(
        int startYear,
        int startMonth,
        int endYear,
        int endMonth,
        string expectedErrorKey)
    {
        var controller = CreateController();

        var result = await controller.GetMonthlySummaries(startYear, startMonth, endYear, endMonth);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var problem = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.Contains(expectedErrorKey, problem.Errors.Keys);
    }

    [Fact]
    public async Task GetStatistics_ReturnsFixedPeriodStatisticsForCurrentUser()
    {
        var repository = new FakeTransactionRepository
        {
            RangeTransactions =
            [
                new Transaction
                {
                    Amount = -25m,
                    Date = new DateTime(2026, 3, 5, 0, 0, 0, DateTimeKind.Utc),
                    Category = "Food & Groceries",
                    Metadata = new TransactionMetadata { RawDescription = "Market" },
                    UserId = "user-1"
                },
                new Transaction
                {
                    Amount = -40m,
                    Date = new DateTime(2026, 4, 5, 0, 0, 0, DateTimeKind.Utc),
                    Category = "Food & Groceries",
                    Metadata = new TransactionMetadata { RawDescription = "Market" },
                    UserId = "user-1"
                }
            ]
        };
        var controller = CreateController(repository);

        var result = await controller.GetStatistics(
            allTime: false,
            endYear: 2026,
            endMonth: 4,
            monthsBack: 1);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.False(GetValue<bool>(ok.Value, "AllTime"));
        Assert.Equal(1, GetValue<int>(ok.Value, "MonthsBack"));
        var summary = GetRawValue(ok.Value, "Summary");
        Assert.Equal(-40m, GetValue<decimal>(summary, "TotalExpense"));
        var previous = GetRawValue(ok.Value, "PreviousMonthSummary");
        Assert.Equal(-25m, GetValue<decimal>(previous, "TotalExpense"));
        Assert.Equal("user-1", repository.LastDateRangeUserId);
        Assert.Equal(
            new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc),
            repository.LastDateRangeStartDate);
        Assert.Equal(
            new DateTime(2026, 5, 1, 0, 0, 0, DateTimeKind.Utc).AddTicks(-1),
            repository.LastDateRangeEndDate);
    }

    [Fact]
    public async Task GetStatistics_ReturnsAllTimeStatistics()
    {
        var repository = new FakeTransactionRepository
        {
            AllTransactions =
            [
                new Transaction
                {
                    Amount = -25m,
                    Date = new DateTime(2026, 4, 5),
                    Category = "Food & Groceries",
                    Metadata = new TransactionMetadata { RawDescription = "Market" },
                    UserId = "user-1"
                }
            ]
        };
        var controller = CreateController(repository);

        var result = await controller.GetStatistics(allTime: true);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.True(GetValue<bool>(ok.Value, "AllTime"));
        Assert.Equal("year", GetValue<string>(ok.Value, "TrendGranularity"));
        Assert.Equal(1, repository.GetAllCalls);
    }

    [Theory]
    [InlineData(false, null, null, null, "endYear")]
    [InlineData(false, 2026, 4, 2, "monthsBack")]
    [InlineData(false, 1999, 4, 3, "endYear")]
    [InlineData(false, 2026, 13, 3, "endMonth")]
    [InlineData(true, 2026, null, null, "allTime")]
    public async Task GetStatistics_ReturnsValidationProblemForInvalidQuery(
        bool allTime,
        int? endYear,
        int? endMonth,
        int? monthsBack,
        string expectedErrorKey)
    {
        var controller = CreateController();

        var result = await controller.GetStatistics(allTime, endYear, endMonth, monthsBack);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var problem = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.Contains(expectedErrorKey, problem.Errors.Keys);
    }

    [Fact]
    public async Task GetMonthlyCategorySummary_ReturnsExpensesGroupedByCategory()
    {
        var repository = new FakeTransactionRepository
        {
            MonthlyTransactions =
            [
                new Transaction { Amount = 1000m, Category = "Income", Date = new DateTime(2026, 4, 1), UserId = "user-1" },
                new Transaction { Amount = -75m, Category = "Food & Groceries", Date = new DateTime(2026, 4, 2), UserId = "user-1" },
                new Transaction { Amount = -25m, Category = "Food & Groceries", Date = new DateTime(2026, 4, 3), UserId = "user-1" },
                new Transaction { Amount = -50m, Category = "Transport", Date = new DateTime(2026, 4, 4), UserId = "user-1" },
                new Transaction { Amount = -25m, Category = "", Date = new DateTime(2026, 4, 5), UserId = "user-1" }
            ]
        };
        var controller = CreateController(repository);

        var result = await controller.GetMonthlyCategorySummary(2026, 4);

        var ok = Assert.IsType<OkObjectResult>(result);
        var summaries = Assert.IsAssignableFrom<IEnumerable<object>>(ok.Value).ToList();
        Assert.Equal(3, summaries.Count);

        Assert.Equal("Food & Groceries", GetValue<string>(summaries[0], "Category"));
        Assert.Equal(100m, GetValue<decimal>(summaries[0], "TotalExpense"));
        Assert.Equal(57.14m, GetValue<decimal>(summaries[0], "Percentage"), precision: 2);
        Assert.Equal(2, GetValue<int>(summaries[0], "TransactionCount"));

        Assert.Equal("Transport", GetValue<string>(summaries[1], "Category"));
        Assert.Equal(50m, GetValue<decimal>(summaries[1], "TotalExpense"));
        Assert.Equal(1, GetValue<int>(summaries[1], "TransactionCount"));

        Assert.Equal("Uncategorized", GetValue<string>(summaries[2], "Category"));
        Assert.Equal(25m, GetValue<decimal>(summaries[2], "TotalExpense"));
        Assert.Equal(1, GetValue<int>(summaries[2], "TransactionCount"));
    }

    [Theory]
    [InlineData(1999, 4, "year")]
    [InlineData(2026, 0, "month")]
    [InlineData(2026, 13, "month")]
    public async Task GetMonthlyCategorySummary_ReturnsValidationProblemForInvalidDateParts(
        int year,
        int month,
        string expectedErrorKey)
    {
        var controller = CreateController();

        var result = await controller.GetMonthlyCategorySummary(year, month);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var problem = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.Contains(expectedErrorKey, problem.Errors.Keys);
    }

    [Fact]
    public async Task GetMonthlyTopExpenses_ReturnsLargestExpensesForRequestedMonth()
    {
        var largestExpenseId = Guid.NewGuid();
        var secondLargestExpenseId = Guid.NewGuid();
        var repository = new FakeTransactionRepository
        {
            MonthlyTransactions =
            [
                new Transaction
                {
                    Id = Guid.NewGuid(),
                    Amount = 1000m,
                    Category = "Income",
                    Date = new DateTime(2026, 4, 1),
                    Metadata = new TransactionMetadata { RawDescription = "Salary" },
                    UserId = "user-1"
                },
                new Transaction
                {
                    Id = secondLargestExpenseId,
                    Amount = -75m,
                    Category = "Food & Groceries",
                    Date = new DateTime(2026, 4, 2),
                    Metadata = new TransactionMetadata { RawDescription = "Market" },
                    UserId = "user-1"
                },
                new Transaction
                {
                    Id = largestExpenseId,
                    Amount = -150m,
                    Category = "Housing & Utilities",
                    Date = new DateTime(2026, 4, 3),
                    Metadata = new TransactionMetadata { RawDescription = "Rent" },
                    UserId = "user-1"
                },
                new Transaction
                {
                    Id = Guid.NewGuid(),
                    Amount = -20m,
                    Category = "Transport",
                    Date = new DateTime(2026, 4, 4),
                    Metadata = new TransactionMetadata { RawDescription = "Bus" },
                    UserId = "user-1"
                }
            ]
        };
        var controller = CreateController(repository);

        var result = await controller.GetMonthlyTopExpenses(2026, 4, limit: 2);

        var ok = Assert.IsType<OkObjectResult>(result);
        var expenses = Assert.IsAssignableFrom<IEnumerable<object>>(ok.Value).ToList();
        Assert.Equal(2, expenses.Count);

        Assert.Equal(largestExpenseId, GetValue<Guid>(expenses[0], "Id"));
        Assert.Equal(150m, GetValue<decimal>(expenses[0], "Amount"));
        Assert.Equal("Housing & Utilities", GetValue<string>(expenses[0], "Category"));
        Assert.Equal("Rent", GetValue<string>(expenses[0], "Description"));

        Assert.Equal(secondLargestExpenseId, GetValue<Guid>(expenses[1], "Id"));
        Assert.Equal(75m, GetValue<decimal>(expenses[1], "Amount"));
    }

    [Theory]
    [InlineData(1999, 4, 5, "year")]
    [InlineData(2026, 0, 5, "month")]
    [InlineData(2026, 13, 5, "month")]
    [InlineData(2026, 4, 0, "limit")]
    [InlineData(2026, 4, 21, "limit")]
    public async Task GetMonthlyTopExpenses_ReturnsValidationProblemForInvalidQuery(
        int year,
        int month,
        int limit,
        string expectedErrorKey)
    {
        var controller = CreateController();

        var result = await controller.GetMonthlyTopExpenses(year, month, limit);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var problem = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.Contains(expectedErrorKey, problem.Errors.Keys);
    }

    [Fact]
    public async Task GetRecurringExpenseCandidates_ReturnsRepeatedExpensesAcrossMonths()
    {
        var repository = new FakeTransactionRepository
        {
            RangeTransactions =
            [
                new Transaction
                {
                    Amount = -50m,
                    Category = "Subscriptions & Services",
                    Date = new DateTime(2026, 1, 5),
                    Metadata = new TransactionMetadata { RawDescription = "Music Stream" },
                    UserId = "user-1"
                },
                new Transaction
                {
                    Amount = -52m,
                    Category = "Subscriptions & Services",
                    Date = new DateTime(2026, 2, 5),
                    Metadata = new TransactionMetadata { RawDescription = "  MUSIC   STREAM " },
                    UserId = "user-1"
                },
                new Transaction
                {
                    Amount = -90m,
                    Category = "Housing & Utilities",
                    Date = new DateTime(2026, 2, 10),
                    Metadata = new TransactionMetadata { RawDescription = "Power Co" },
                    UserId = "user-1"
                },
                new Transaction
                {
                    Amount = -20m,
                    Category = "Transport",
                    Date = new DateTime(2026, 3, 4),
                    Metadata = new TransactionMetadata { RawDescription = "Bus Ticket" },
                    UserId = "user-1"
                },
                new Transaction
                {
                    Amount = 1000m,
                    Category = "Income",
                    Date = new DateTime(2026, 3, 20),
                    Metadata = new TransactionMetadata { RawDescription = "Salary" },
                    UserId = "user-1"
                }
            ]
        };
        var controller = CreateController(repository);

        var result = await controller.GetRecurringExpenseCandidates(2026, 3, monthsBack: 3, limit: 10);

        var ok = Assert.IsType<OkObjectResult>(result);
        var candidates = Assert.IsAssignableFrom<IEnumerable<object>>(ok.Value).ToList();
        var candidate = Assert.Single(candidates);

        Assert.Equal("music stream", GetValue<string>(candidate, "Description"));
        Assert.Equal("Subscriptions & Services", GetValue<string>(candidate, "Category"));
        Assert.Equal(51m, GetValue<decimal>(candidate, "AverageAmount"));
        Assert.Equal(50m, GetValue<decimal>(candidate, "MinAmount"));
        Assert.Equal(52m, GetValue<decimal>(candidate, "MaxAmount"));
        Assert.Equal(2, GetValue<int>(candidate, "OccurrenceCount"));
        Assert.Equal(2, GetValue<int>(candidate, "MonthCount"));
        Assert.Equal(new DateTime(2026, 2, 5), GetValue<DateTime>(candidate, "LastDate"));

        Assert.Equal("user-1", repository.LastDateRangeUserId);
        Assert.Equal(new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc), repository.LastDateRangeStartDate);
        Assert.Equal(
            new DateTime(2026, 4, 1, 0, 0, 0, DateTimeKind.Utc).AddTicks(-1),
            repository.LastDateRangeEndDate);
    }

    [Theory]
    [InlineData(1999, 4, 6, 10, "endYear")]
    [InlineData(2026, 0, 6, 10, "endMonth")]
    [InlineData(2026, 13, 6, 10, "endMonth")]
    [InlineData(2026, 4, 1, 10, "monthsBack")]
    [InlineData(2026, 4, 25, 10, "monthsBack")]
    [InlineData(2026, 4, 6, 0, "limit")]
    [InlineData(2026, 4, 6, 21, "limit")]
    public async Task GetRecurringExpenseCandidates_ReturnsValidationProblemForInvalidQuery(
        int endYear,
        int endMonth,
        int monthsBack,
        int limit,
        string expectedErrorKey)
    {
        var controller = CreateController();

        var result = await controller.GetRecurringExpenseCandidates(endYear, endMonth, monthsBack, limit);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var problem = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.Contains(expectedErrorKey, problem.Errors.Keys);
    }

    [Fact]
    public async Task ImportTransactions_ReturnsValidationProblemForNullFile()
    {
        var importParser = new FakeTransactionImportParser();
        var controller = CreateController(importParser: importParser);

        var result = await controller.ImportTransactions(null);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        var problem = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.Contains("file", problem.Errors.Keys);
        Assert.Equal(0, importParser.ParseCalls);
    }

    [Fact]
    public async Task ImportTransactions_ReturnsValidationProblemForUnsupportedFileExtension()
    {
        var importParser = new FakeTransactionImportParser();
        var controller = CreateController(importParser: importParser);
        var file = CreateFormFile("transactions.txt", "text/csv");

        var result = await controller.ImportTransactions(file, delimiter: "comma");

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(0, importParser.ParseCalls);
    }

    [Fact]
    public async Task ImportTransactions_UsesAtomicImportAndAssignsCurrentUserAndFingerprints()
    {
        var repository = new FakeTransactionRepository
        {
            ImportedCount = 1
        };
        var importParser = new FakeTransactionImportParser
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
        var controller = CreateController(repository, importParser: importParser);
        var file = CreateFormFile("transactions.csv", "text/csv");

        var result = await controller.ImportTransactions(file, delimiter: "comma");

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(2, GetValue<int>(ok.Value, "TotalParsed"));
        Assert.Equal(1, GetValue<int>(ok.Value, "Imported"));
        Assert.Equal(1, GetValue<int>(ok.Value, "DuplicatesSkipped"));

        Assert.Equal(2, repository.ImportAttemptedTransactions.Count);
        Assert.Equal("comma", importParser.LastDelimiter);
        Assert.All(repository.ImportAttemptedTransactions, transaction =>
        {
            Assert.Equal("user-1", transaction.UserId);
            Assert.Equal(
                TransactionImportFingerprint.Create(
                    transaction.Date,
                    transaction.Amount,
                    transaction.Metadata.RawDescription),
                transaction.ImportFingerprint);
        });
        Assert.Empty(repository.AddedTransactions);
    }

    [Fact]
    public async Task ImportTransactions_AcceptsXlsxAndPassesMappingToParser()
    {
        var repository = new FakeTransactionRepository
        {
            ImportedCount = 1
        };
        var importParser = new FakeTransactionImportParser
        {
            ParsedTransactions =
            [
                new Transaction
                {
                    Date = new DateTime(2026, 6, 1),
                    Amount = -42.10m,
                    Metadata = new TransactionMetadata { RawDescription = "Card payment" }
                }
            ]
        };
        var controller = CreateController(repository, importParser: importParser);
        var file = CreateFormFile(
            "transactions.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

        var result = await controller.ImportTransactions(
            file,
            hasHeaderRow: true,
            dateColumnIndex: 2,
            amountColumnIndex: 4,
            descriptionColumnIndex: 5);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(1, GetValue<int>(ok.Value, "TotalParsed"));
        Assert.Equal(1, GetValue<int>(ok.Value, "Imported"));
        Assert.Equal(1, importParser.ParseCalls);
        Assert.Equal(new TransactionImportMapping(true, 2, 4, 5), importParser.LastXlsxMapping);
        Assert.Equal("user-1", repository.ImportAttemptedTransactions.Single().UserId);
    }

    [Fact]
    public async Task ImportTransactions_RedactsBlacklistedDescriptionTextBeforeSaving()
    {
        var repository = new FakeTransactionRepository
        {
            ImportedCount = 2
        };
        var importParser = new FakeTransactionImportParser
        {
            ParsedTransactions =
            [
                new Transaction
                {
                    Date = new DateTime(2026, 4, 3),
                    Amount = -12.34m,
                    Metadata = new TransactionMetadata
                    {
                        RawDescription = "Card SECRET IBAN DE123 purchase"
                    }
                },
                new Transaction
                {
                    Date = new DateTime(2026, 4, 4),
                    Amount = -20m,
                    Metadata = new TransactionMetadata
                    {
                        RawDescription = "Safe purchase"
                    }
                }
            ]
        };
        var preferencesRepository = new FakeUserPreferencesRepository
        {
            TransactionImportBlacklistRules =
            [
                new TransactionImportBlacklistRule
                {
                    Type = TransactionImportBlacklistRule.LiteralType,
                    Value = "secret"
                },
                new TransactionImportBlacklistRule
                {
                    Type = TransactionImportBlacklistRule.RegexType,
                    Value = @"IBAN\s+[A-Z0-9]+"
                }
            ]
        };
        var controller = CreateController(
            repository,
            preferencesRepository,
            importParser: importParser);
        var file = CreateFormFile("transactions.csv", "text/csv");

        var result = await controller.ImportTransactions(file, delimiter: "comma");

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(1, GetValue<int>(ok.Value, "RedactedTransactions"));
        Assert.Equal("Card purchase", repository.ImportAttemptedTransactions[0].Metadata.RawDescription);
        Assert.Equal("Safe purchase", repository.ImportAttemptedTransactions[1].Metadata.RawDescription);
        Assert.Equal(
            TransactionImportFingerprint.Create(
                new DateTime(2026, 4, 3),
                -12.34m,
                "Card SECRET IBAN DE123 purchase"),
            repository.ImportAttemptedTransactions[0].ImportFingerprint);
    }

    [Fact]
    public async Task ImportTransactions_ImportsBlankDescriptionWhenRedactionRemovesEverything()
    {
        var repository = new FakeTransactionRepository
        {
            ImportedCount = 1
        };
        var importParser = new FakeTransactionImportParser
        {
            ParsedTransactions =
            [
                new Transaction
                {
                    Date = new DateTime(2026, 4, 3),
                    Amount = -12.34m,
                    Metadata = new TransactionMetadata
                    {
                        RawDescription = "Sensitive"
                    }
                }
            ]
        };
        var preferencesRepository = new FakeUserPreferencesRepository
        {
            TransactionImportBlacklistRules =
            [
                new TransactionImportBlacklistRule
                {
                    Type = TransactionImportBlacklistRule.LiteralType,
                    Value = "Sensitive"
                }
            ]
        };
        var controller = CreateController(
            repository,
            preferencesRepository,
            importParser: importParser);
        var file = CreateFormFile("transactions.csv", "text/csv");

        var result = await controller.ImportTransactions(file, delimiter: "comma");

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(1, GetValue<int>(ok.Value, "RedactedTransactions"));
        Assert.Equal(string.Empty, repository.ImportAttemptedTransactions.Single().Metadata.RawDescription);
    }

    [Fact]
    public async Task TransactionImportService_UsesStableSourceFingerprintAcrossRedactionRules()
    {
        const string sourceDescription = "Card SECRET IBAN DE123 purchase";
        var ruleSets = new IReadOnlyList<TransactionImportBlacklistRule>[]
        {
            [],
            [
                new TransactionImportBlacklistRule
                {
                    Type = TransactionImportBlacklistRule.LiteralType,
                    Value = "SECRET"
                }
            ],
            [
                new TransactionImportBlacklistRule
                {
                    Type = TransactionImportBlacklistRule.RegexType,
                    Value = @"IBAN\s+[A-Z0-9]+"
                }
            ]
        };
        var fingerprints = new HashSet<string>(StringComparer.Ordinal);

        foreach (var rules in ruleSets)
        {
            var repository = new FakeTransactionRepository
            {
                ImportedCount = 1
            };
            var service = new TransactionImportService(
                repository,
                new FakeUserPreferencesRepository
                {
                    TransactionImportBlacklistRules = rules
                },
                new TransactionImportDescriptionRedactionService());

            await service.ImportAsync(
                "user-1",
                [
                    new Transaction
                    {
                        Date = new DateTime(2026, 4, 3),
                        Amount = -12.34m,
                        Metadata = new TransactionMetadata
                        {
                            RawDescription = sourceDescription
                        }
                    }
                ]);

            fingerprints.Add(
                Assert.Single(repository.ImportAttemptedTransactions).ImportFingerprint!);
        }

        Assert.Single(fingerprints);
        Assert.Contains(
            TransactionImportFingerprint.Create(
                new DateTime(2026, 4, 3),
                -12.34m,
                sourceDescription),
            fingerprints);
    }

    [Fact]
    public async Task TransactionImportService_MatchesExistingUnredactedFingerprintAfterRuleChange()
    {
        const string sourceDescription = "Card SECRET purchase";
        var sourceFingerprint = TransactionImportFingerprint.Create(
            new DateTime(2026, 4, 3),
            -12.34m,
            sourceDescription);
        var repository = new FakeTransactionRepository
        {
            ExistingImportFingerprints = new HashSet<string>(StringComparer.Ordinal)
            {
                sourceFingerprint
            }
        };
        var service = new TransactionImportService(
            repository,
            new FakeUserPreferencesRepository
            {
                TransactionImportBlacklistRules =
                [
                    new TransactionImportBlacklistRule
                    {
                        Type = TransactionImportBlacklistRule.LiteralType,
                        Value = "SECRET"
                    }
                ]
            },
            new TransactionImportDescriptionRedactionService());

        var result = await service.PreviewAsync(
            "user-1",
            [
                new Transaction
                {
                    Date = new DateTime(2026, 4, 3),
                    Amount = -12.34m,
                    Metadata = new TransactionMetadata
                    {
                        RawDescription = sourceDescription
                    }
                }
            ]);

        var previewItem = Assert.Single(result.Transactions);
        Assert.Equal(1, result.ExistingDuplicates);
        Assert.Equal(0, result.Importable);
        Assert.Equal(
            TransactionImportDuplicateReason.ExistingDuplicate,
            previewItem.DuplicateReason);
        Assert.Equal("Card purchase", previewItem.Transaction.Metadata.RawDescription);
        Assert.Equal(sourceFingerprint, previewItem.Transaction.ImportFingerprint);
    }

    [Fact]
    public async Task TransactionImportService_KeepsDistinctSourcesWhenRedactionOutputsMatch()
    {
        var service = new TransactionImportService(
            new FakeTransactionRepository(),
            new FakeUserPreferencesRepository
            {
                TransactionImportBlacklistRules =
                [
                    new TransactionImportBlacklistRule
                    {
                        Type = TransactionImportBlacklistRule.RegexType,
                        Value = @"SECRET-[AB]"
                    }
                ]
            },
            new TransactionImportDescriptionRedactionService());

        var result = await service.PreviewAsync(
            "user-1",
            [
                new Transaction
                {
                    Date = new DateTime(2026, 4, 3),
                    Amount = -12.34m,
                    Metadata = new TransactionMetadata
                    {
                        RawDescription = "Card SECRET-A Coffee"
                    }
                },
                new Transaction
                {
                    Date = new DateTime(2026, 4, 3),
                    Amount = -12.34m,
                    Metadata = new TransactionMetadata
                    {
                        RawDescription = "Card SECRET-B Coffee"
                    }
                }
            ]);

        Assert.Equal(2, result.Importable);
        Assert.Equal(0, result.FileDuplicates);
        Assert.All(
            result.Transactions,
            item => Assert.Equal(
                "Card Coffee",
                item.Transaction.Metadata.RawDescription));
        Assert.Equal(
            2,
            result.Transactions
                .Select(item => item.Transaction.ImportFingerprint)
                .Distinct(StringComparer.Ordinal)
                .Count());
    }

    [Fact]
    public async Task PreviewImportTransactions_ClassifiesDuplicatesAndRedactionsWithoutWriting()
    {
        var existingTransaction = new Transaction
        {
            Date = new DateTime(2026, 4, 3),
            Amount = -12.34m,
            Metadata = new TransactionMetadata { RawDescription = "Existing transaction" }
        };
        var repository = new FakeTransactionRepository
        {
            ExistingImportFingerprints = new HashSet<string>(StringComparer.Ordinal)
            {
                TransactionImportFingerprint.Create(
                    existingTransaction.Date,
                    existingTransaction.Amount,
                    existingTransaction.Metadata.RawDescription)
            }
        };
        var importParser = new FakeTransactionImportParser
        {
            ParsedTransactions =
            [
                existingTransaction,
                new Transaction
                {
                    Date = new DateTime(2026, 4, 4),
                    Amount = -20m,
                    Metadata = new TransactionMetadata { RawDescription = "SECRET Coffee" }
                },
                new Transaction
                {
                    Date = new DateTime(2026, 4, 4),
                    Amount = -20m,
                    Metadata = new TransactionMetadata { RawDescription = "SECRET Coffee" }
                }
            ]
        };
        var preferencesRepository = new FakeUserPreferencesRepository
        {
            TransactionImportBlacklistRules =
            [
                new TransactionImportBlacklistRule
                {
                    Type = TransactionImportBlacklistRule.LiteralType,
                    Value = "secret"
                }
            ]
        };
        var controller = CreateController(
            repository,
            preferencesRepository,
            importParser: importParser);
        var file = CreateFormFile("transactions.csv", "text/csv");

        var result = await controller.PreviewImportTransactions(file, delimiter: "comma");

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(3, GetValue<int>(ok.Value, "TotalParsed"));
        Assert.Equal(1, GetValue<int>(ok.Value, "Importable"));
        Assert.Equal(2, GetValue<int>(ok.Value, "DuplicatesSkipped"));
        Assert.Equal(1, GetValue<int>(ok.Value, "ExistingDuplicates"));
        Assert.Equal(1, GetValue<int>(ok.Value, "FileDuplicates"));
        Assert.Equal(2, GetValue<int>(ok.Value, "RedactedTransactions"));
        Assert.Equal("user-1", repository.LastFingerprintLookupUserId);
        Assert.Empty(repository.ImportAttemptedTransactions);

        var transactions = Assert.IsAssignableFrom<IEnumerable<object>>(
            GetRawValue(ok.Value, "Transactions"));
        var transactionList = transactions.ToList();
        Assert.Equal("skipped", GetValue<string>(transactionList[0], "Status"));
        Assert.Equal(
            "existingDuplicate",
            GetValue<string>(transactionList[0], "DuplicateReason"));
        Assert.Equal("willImport", GetValue<string>(transactionList[1], "Status"));
        Assert.Equal("Coffee", GetValue<string>(transactionList[1], "Description"));
        Assert.True(GetValue<bool>(transactionList[1], "DescriptionRedacted"));
        Assert.Equal("skipped", GetValue<string>(transactionList[2], "Status"));
        Assert.Equal("fileDuplicate", GetValue<string>(transactionList[2], "DuplicateReason"));
    }

    [Fact]
    public async Task PreviewImportTransactions_RejectsUnauthenticatedRequestWithoutParsing()
    {
        var importParser = new FakeTransactionImportParser();
        var controller = CreateController(importParser: importParser, userId: null);
        var file = CreateFormFile("transactions.csv", "text/csv");

        var result = await controller.PreviewImportTransactions(file);

        var unauthorized = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status401Unauthorized, unauthorized.StatusCode);
        Assert.Equal(0, importParser.ParseCalls);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task TransactionImportService_RejectsOversizedParserResultBeforeRepositoryAccess(
        bool import)
    {
        var repository = new FakeTransactionRepository();
        var preferencesRepository = new FakeUserPreferencesRepository();
        var service = new TransactionImportService(
            repository,
            preferencesRepository,
            new TransactionImportDescriptionRedactionService());
        var parsedTransactions = Enumerable
            .Range(0, TransactionImportLimits.MaxRowCount + 1)
            .Select(index => new Transaction
            {
                Date = new DateTime(2026, 4, 3),
                Amount = index + 1,
                Metadata = new TransactionMetadata
                {
                    RawDescription = $"Transaction {index}"
                }
            });

        var exception = import
            ? await Assert.ThrowsAsync<InvalidInputException>(() =>
                service.ImportAsync("user-1", parsedTransactions))
            : await Assert.ThrowsAsync<InvalidInputException>(() =>
                service.PreviewAsync("user-1", parsedTransactions));

        Assert.Equal(TransactionImportLimits.RowLimitExceededMessage, exception.Message);
        Assert.Null(repository.LastFingerprintLookupUserId);
        Assert.Empty(repository.ImportAttemptedTransactions);
    }

    [Theory]
    [MemberData(nameof(InvalidImportedFinancialValues))]
    public async Task TransactionImportService_RejectsInvalidFinancialValuesBeforeRepositoryAccess(
        bool import,
        decimal amount,
        DateTime date,
        string expectedError)
    {
        var repository = new FakeTransactionRepository();
        var service = new TransactionImportService(
            repository,
            new FakeUserPreferencesRepository(),
            new TransactionImportDescriptionRedactionService());
        var parsedTransactions = new[]
        {
            new Transaction
            {
                Date = date,
                Amount = amount,
                Metadata = new TransactionMetadata
                {
                    RawDescription = "Invalid transaction"
                }
            }
        };

        var exception = import
            ? await Assert.ThrowsAsync<InvalidInputException>(() =>
                service.ImportAsync("user-1", parsedTransactions))
            : await Assert.ThrowsAsync<InvalidInputException>(() =>
                service.PreviewAsync("user-1", parsedTransactions));

        Assert.Contains("Import row 1", exception.Message, StringComparison.Ordinal);
        Assert.Contains(expectedError, exception.Message, StringComparison.Ordinal);
        Assert.Null(repository.LastFingerprintLookupUserId);
        Assert.Empty(repository.ImportAttemptedTransactions);
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
                AiSuggestedCategory = "Food & Groceries",
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
            new TransactionsController.UpdateTransactionCategoryRequest("Food & Groceries"));

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
                items[0].Category = "Eating Out";
                items[0].Metadata.AiSuggestedCategory = "Eating Out";
                items[0].Metadata.AiConfidenceScore = 0.87;
                return new TransactionCategorizationResult(1, 1, 0, 0);
            }
        };
        var controller = CreateController(repository, preferencesRepository, aiService: aiService);

        var result = await controller.RegenerateCategory(transactionId);

        var ok = Assert.IsType<OkObjectResult>(result);
        var updatedTransaction = Assert.IsType<Transaction>(ok.Value);
        Assert.Equal("Eating Out", updatedTransaction.Category);
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
    public async Task RegenerateCategory_ReturnsBadGatewayWithoutSavingWhenProviderResultFails()
    {
        var transactionId = Guid.NewGuid();
        var transaction = new Transaction
        {
            Id = transactionId,
            UserId = "user-1",
            Category = "Uncategorized"
        };
        var repository = new FakeTransactionRepository
        {
            TransactionById = transaction
        };
        var aiService = new FakeAiAdvisorService
        {
            CategorizeAction = _ => new TransactionCategorizationResult(1, 0, 1, 1)
        };
        var controller = CreateController(repository, aiService: aiService);

        var result = await controller.RegenerateCategory(transactionId);

        var badGateway = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status502BadGateway, badGateway.StatusCode);
        var problem = Assert.IsType<ProblemDetails>(badGateway.Value);
        Assert.Equal("urn:budgetbeacon:external-service", problem.Type);
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
        Assert.Equal(0, GetValue<int>(ok.Value, "ChangedCount"));
        Assert.Equal(0, GetValue<int>(ok.Value, "FailedCount"));
        Assert.Equal(0, GetValue<int>(ok.Value, "RemainingCount"));
        Assert.Equal(0, GetValue<int>(ok.Value, "CategorizedCount"));
        Assert.Equal(0, aiService.CategorizeCalls);
        Assert.False(repository.SaveChangesCalled);
    }

    [Fact]
    public async Task TriggerCategorization_ReturnsFullSuccessWithAllCounts()
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
        var aiService = new FakeAiAdvisorService
        {
            CategorizeAction = items =>
            {
                items[0].Category = "Food & Groceries";
                items[1].Category = "Transport";
                return new TransactionCategorizationResult(2, 2, 0, 0);
            }
        };
        var controller = CreateController(repository, aiService: aiService);

        var result = await controller.TriggerCategorization();

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(2, GetValue<int>(ok.Value, "ProcessedCount"));
        Assert.Equal(2, GetValue<int>(ok.Value, "ChangedCount"));
        Assert.Equal(0, GetValue<int>(ok.Value, "FailedCount"));
        Assert.Equal(0, GetValue<int>(ok.Value, "RemainingCount"));
        Assert.Equal(2, GetValue<int>(ok.Value, "CategorizedCount"));
        Assert.Equal("Categorization successful.", GetValue<string>(ok.Value, "Message"));
        Assert.True(repository.SaveChangesCalled);
    }

    [Fact]
    public async Task TriggerCategorization_ReturnsPartialResultAndSavesValidChanges()
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
                items[0].Category = "Food & Groceries";
                return new TransactionCategorizationResult(2, 1, 1, 1);
            }
        };
        var controller = CreateController(repository, preferencesRepository, aiService: aiService);

        var result = await controller.TriggerCategorization();

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(2, GetValue<int>(ok.Value, "ProcessedCount"));
        Assert.Equal(1, GetValue<int>(ok.Value, "ChangedCount"));
        Assert.Equal(1, GetValue<int>(ok.Value, "FailedCount"));
        Assert.Equal(1, GetValue<int>(ok.Value, "RemainingCount"));
        Assert.Equal(1, GetValue<int>(ok.Value, "CategorizedCount"));
        Assert.Contains("partially", GetValue<string>(ok.Value, "Message"), StringComparison.OrdinalIgnoreCase);
        Assert.Equal(1, aiService.CategorizeCalls);
        Assert.Equal("Bolzano, South Tyrol, Italy", aiService.LastCategorizationLocationContext);
        Assert.True(repository.SaveChangesCalled);
    }

    [Fact]
    public async Task TriggerCategorization_ReturnsBadGatewayWithoutSavingForTotalFailure()
    {
        var repository = new FakeTransactionRepository
        {
            UncategorizedTransactions =
            [
                new Transaction { Category = "Uncategorized" },
                new Transaction { Category = "Uncategorized" }
            ]
        };
        var aiService = new FakeAiAdvisorService
        {
            CategorizeAction = _ => new TransactionCategorizationResult(2, 0, 2, 2)
        };
        var controller = CreateController(repository, aiService: aiService);

        var result = await controller.TriggerCategorization();

        var badGateway = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status502BadGateway, badGateway.StatusCode);
        var problem = Assert.IsType<ProblemDetails>(badGateway.Value);
        Assert.Equal("urn:budgetbeacon:external-service", problem.Type);
        Assert.False(repository.SaveChangesCalled);
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
    public async Task GetAiSavingsTips_ReturnsSourceDataNotFoundProblemWhenNoTransactionsExist()
    {
        var aiService = new FakeAiAdvisorService();
        var controller = CreateController(aiService: aiService);

        var result = await controller.GetAiSavingsTips(3);

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status404NotFound, objectResult.StatusCode);
        var problem = Assert.IsType<ProblemDetails>(objectResult.Value);
        Assert.Equal("urn:budgetbeacon:tips-source-data-not-found", problem.Type);
        Assert.Equal(0, aiService.GetSavingTipsCalls);
    }

    [Fact]
    public async Task GetAiSavingsTips_ReturnsTipsForAllTransactionsWhenAllTimeRequested()
    {
        var repository = new FakeTransactionRepository
        {
            AllTransactions = [new Transaction { Amount = -45m, Category = "Eating Out" }]
        };
        var aiService = new FakeAiAdvisorService
        {
            SavingTips =
            [
                new SavingsTip
                {
                    Id = "tip-1",
                    Title = "Review dining",
                    Description = "Compare restaurant spending over the full history.",
                    Impact = "Low",
                    Category = "Eating Out"
                }
            ]
        };
        var controller = CreateController(repository, aiService: aiService);

        var result = await controller.GetAiSavingsTips(allTime: true);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal("All time", GetValue<string>(ok.Value, "Timeframe"));
        Assert.Equal(1, repository.GetAllCalls);
        Assert.Equal(0, repository.PagedCalls);
        Assert.Equal(1, aiService.GetSavingTipsCalls);
    }

    [Fact]
    public async Task GetAiSavingsTips_ReturnsTipsForPagedTransactions()
    {
        var repository = new FakeTransactionRepository
        {
            PagedTransactions = [new Transaction { Amount = -25m, Category = "Food & Groceries" }],
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
                    Category = "Food & Groceries"
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

    [Fact]
    public async Task GetAiSavingsTips_UsesUtcDayBoundaryForRelativeFilter()
    {
        var repository = new FakeTransactionRepository
        {
            PagedTransactions = [new Transaction { Amount = -25m, Category = "Food & Groceries" }],
            PagedTotalCount = 1
        };
        var controller = CreateController(repository);
        var earliestExpectedStartDate = DateOnly.FromDateTime(DateTime.UtcNow)
            .AddMonths(-3)
            .ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        await controller.GetAiSavingsTips(3);

        var latestExpectedStartDate = DateOnly.FromDateTime(DateTime.UtcNow)
            .AddMonths(-3)
            .ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        Assert.Equal("user-1", repository.LastPagedUserId);
        Assert.NotNull(repository.LastPagedOptions?.StartDate);
        Assert.Equal(DateTimeKind.Utc, repository.LastPagedOptions.StartDate.Value.Kind);
        Assert.Equal(TimeSpan.Zero, repository.LastPagedOptions.StartDate.Value.TimeOfDay);
        Assert.InRange(repository.LastPagedOptions.StartDate.Value, earliestExpectedStartDate, latestExpectedStartDate);
        Assert.Equal(1, repository.LastPagedPageNumber);
        Assert.Equal(10000, repository.LastPagedPageSize);
    }

    private static TransactionsController CreateController(
        FakeTransactionRepository? repository = null,
        FakeUserPreferencesRepository? preferencesRepository = null,
        FakeAiAdvisorService? aiService = null,
        FakeTransactionImportParser? importParser = null,
        string? userId = "user-1")
    {
        var transactionRepository = repository ?? new FakeTransactionRepository();
        var userPreferencesRepository = preferencesRepository ?? new FakeUserPreferencesRepository();
        var redactionService = new TransactionImportDescriptionRedactionService();
        var controller = new TransactionsController(
            transactionRepository,
            userPreferencesRepository,
            new StatisticsAggregationService(new FinanceAggregationService()),
            aiService ?? new FakeAiAdvisorService(),
            importParser ?? new FakeTransactionImportParser(),
            new TransactionImportService(
                transactionRepository,
                userPreferencesRepository,
                redactionService),
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
        public IEnumerable<Transaction> RangeTransactions { get; init; } = [];
        public IEnumerable<Transaction> PagedTransactions { get; init; } = [];
        public int PagedTotalCount { get; init; }
        public int GetAllCalls { get; private set; }
        public int PagedCalls { get; private set; }
        public int ImportedCount { get; init; }
        public IReadOnlySet<string> ExistingImportFingerprints { get; init; } =
            new HashSet<string>(StringComparer.Ordinal);
        public bool SaveChangesCalled { get; private set; }
        public bool DeleteCalled { get; private set; }
        public Transaction? TransactionById { get; init; }
        public Transaction? TransactionToDelete { get; init; }
        public Transaction? TransactionToUpdate { get; init; }
        public string? LastDeleteUserId { get; private set; }
        public Guid? LastDeleteTransactionId { get; private set; }
        public string? LastGetByIdUserId { get; private set; }
        public Guid? LastGetByIdTransactionId { get; private set; }
        public string? LastUpdateUserId { get; private set; }
        public Guid? LastUpdateTransactionId { get; private set; }
        public string? LastUpdateCategoryUserId { get; private set; }
        public Guid? LastUpdateCategoryTransactionId { get; private set; }
        public string? LastDateRangeUserId { get; private set; }
        public DateTime? LastDateRangeStartDate { get; private set; }
        public DateTime? LastDateRangeEndDate { get; private set; }
        public string? LastPagedUserId { get; private set; }
        public string? LastFingerprintLookupUserId { get; private set; }
        public TransactionQueryOptions? LastPagedOptions { get; private set; }
        public int? LastPagedPageNumber { get; private set; }
        public int? LastPagedPageSize { get; private set; }

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

        public Task<IReadOnlySet<string>> GetExistingImportFingerprintsAsync(
            string userId,
            IReadOnlyCollection<string> importFingerprints)
        {
            LastFingerprintLookupUserId = userId;
            var matches = ExistingImportFingerprints
                .Where(importFingerprints.Contains)
                .ToHashSet(StringComparer.Ordinal);
            return Task.FromResult<IReadOnlySet<string>>(matches);
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

        public Task<Transaction?> UpdateAsync(string userId, Guid transactionId, TransactionUpdate update)
        {
            LastUpdateUserId = userId;
            LastUpdateTransactionId = transactionId;

            if (TransactionToUpdate is null ||
                TransactionToUpdate.Id != transactionId ||
                TransactionToUpdate.UserId != userId)
            {
                return Task.FromResult<Transaction?>(null);
            }

            TransactionToUpdate.ApplyUpdate(update);

            return Task.FromResult<Transaction?>(TransactionToUpdate);
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
            GetAllCalls++;
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
            LastDateRangeUserId = userId;
            LastDateRangeStartDate = startDate;
            LastDateRangeEndDate = endDate;

            return Task.FromResult(RangeTransactions);
        }

        public Task<(IEnumerable<Transaction> Items, int TotalCount)> GetTransactionsPagedAsync(
            string userId,
            TransactionQueryOptions options,
            int pageNumber,
            int pageSize)
        {
            PagedCalls++;
            LastPagedUserId = userId;
            LastPagedOptions = options;
            LastPagedPageNumber = pageNumber;
            LastPagedPageSize = pageSize;
            return Task.FromResult((PagedTransactions, PagedTotalCount));
        }
    }

    private sealed class FakeUserPreferencesRepository : IUserPreferencesRepository
    {
        public string? AiLocationContext { get; init; }
        public IReadOnlyList<TransactionImportBlacklistRule> TransactionImportBlacklistRules { get; init; } = [];

        public Task<UserPreferences?> GetAsync(string userId)
        {
            return Task.FromResult<UserPreferences?>(new UserPreferences
            {
                AiLocationContext = AiLocationContext,
                TransactionImportBlacklistRules = TransactionImportBlacklistRules
            });
        }

        public Task<string?> GetAiLocationContextAsync(string userId)
        {
            return Task.FromResult(AiLocationContext);
        }

        public Task<UserPreferences?> UpdateAsync(
            string userId,
            string? aiLocationContext,
            IReadOnlyList<TransactionImportBlacklistRule>? transactionImportBlacklistRules)
        {
            return Task.FromResult<UserPreferences?>(new UserPreferences
            {
                AiLocationContext = aiLocationContext,
                TransactionImportBlacklistRules = transactionImportBlacklistRules ?? []
            });
        }
    }

    private sealed class FakeAiAdvisorService : IAiAdvisorService
    {
        public int CategorizeCalls { get; private set; }
        public int GetSavingTipsCalls { get; private set; }
        public string? LastCategorizationLocationContext { get; private set; }
        public string? LastSavingsTipsLocationContext { get; private set; }
        public Func<List<Transaction>, TransactionCategorizationResult>? CategorizeAction { get; init; }
        public IReadOnlyList<SavingsTip> SavingTips { get; init; } = [];

        public Task<TransactionCategorizationResult> CategorizeTransactionsAsync(
            List<Transaction> transactions,
            string? aiLocationContext = null)
        {
            CategorizeCalls++;
            LastCategorizationLocationContext = aiLocationContext;
            return Task.FromResult(
                CategorizeAction?.Invoke(transactions) ??
                new TransactionCategorizationResult(
                    transactions.Count,
                    transactions.Count,
                    0,
                    transactions.Count(transaction =>
                        string.Equals(
                            transaction.Category,
                            "Uncategorized",
                            StringComparison.OrdinalIgnoreCase))));
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

    private sealed class FakeTransactionImportParser : ITransactionImportParser
    {
        public int ParseCalls { get; private set; }
        public string? LastDelimiter { get; private set; }
        public TransactionImportMapping? LastXlsxMapping { get; private set; }
        public IEnumerable<Transaction> ParsedTransactions { get; init; } = [];

        public IEnumerable<Transaction> ParseCsvTransactions(Stream fileStream, string? delimiter = null)
        {
            ParseCalls++;
            LastDelimiter = delimiter;
            return ParsedTransactions;
        }

        public IEnumerable<Transaction> ParseXlsxTransactions(
            Stream fileStream,
            TransactionImportMapping mapping)
        {
            ParseCalls++;
            LastXlsxMapping = mapping;
            return ParsedTransactions;
        }
    }
}
