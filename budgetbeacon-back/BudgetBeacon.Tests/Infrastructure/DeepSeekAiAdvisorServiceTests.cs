using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Exceptions;
using BudgetBeacon.Infrastructure.External;

namespace BudgetBeacon.Tests.Infrastructure;

public sealed class DeepSeekAiAdvisorServiceTests
{
    [Fact]
    public void Constructor_ThrowsWhenApiKeyIsMissing()
    {
        using var httpClient = new HttpClient(new StubHttpMessageHandler())
        {
            BaseAddress = new Uri("https://api.deepseek.test/")
        };
        var config = CreateConfig(("DeepSeek:Model", "test-model"));

        var exception = Assert.Throws<InvalidOperationException>(() =>
            new DeepSeekAiAdvisorService(
                httpClient,
                config,
                NullLogger<DeepSeekAiAdvisorService>.Instance));

        Assert.Contains("DeepSeek:ApiKey", exception.Message);
    }

    [Fact]
    public async Task CategorizeTransactionsAsync_UsesDefaultModelWhenModelIsNotConfigured()
    {
        var transaction = new Transaction
        {
            Id = Guid.NewGuid(),
            Amount = -15m,
            Metadata = new TransactionMetadata { RawDescription = "Local merchant" }
        };
        var handler = new StubHttpMessageHandler();
        handler.Enqueue(DeepSeekResponse($"[{{\"Id\":\"{transaction.Id}\",\"Category\":\"Food & Groceries\",\"Confidence\":0.8}}]"));
        var httpClient = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://api.deepseek.test/")
        };
        var sut = new DeepSeekAiAdvisorService(
            httpClient,
            CreateConfig(("DeepSeek:ApiKey", "test-api-key")),
            NullLogger<DeepSeekAiAdvisorService>.Instance);

        await sut.CategorizeTransactionsAsync([transaction]);

        var request = Assert.Single(handler.Requests);
        using var body = JsonDocument.Parse(request.Body);
        Assert.Equal("deepseek-v4-flash", body.RootElement.GetProperty("model").GetString());
    }

    [Fact]
    public async Task CategorizeTransactionsAsync_DoesNotCallProviderForEmptyInput()
    {
        var handler = new StubHttpMessageHandler();
        var sut = CreateService(handler);

        var result = await sut.CategorizeTransactionsAsync([]);

        Assert.Empty(handler.Requests);
        Assert.Equal(0, result.ProcessedCount);
        Assert.Equal(0, result.ChangedCount);
        Assert.Equal(0, result.FailedCount);
        Assert.Equal(0, result.RemainingCount);
    }

    [Fact]
    public async Task CategorizeTransactionsAsync_MapsNormalizedCategoriesAndClampedConfidence()
    {
        var transportId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        var unknownCategoryId = Guid.NewGuid();
        var ignoredId = Guid.NewGuid();
        var transactions = new List<Transaction>
        {
            new()
            {
                Id = transportId,
                Amount = -12m,
                Metadata = new TransactionMetadata { RawDescription = "SAD NAHVERKEHR" }
            },
            new()
            {
                Id = otherId,
                Amount = -20m,
                Metadata = new TransactionMetadata { RawDescription = "Unclassified merchant" }
            },
            new()
            {
                Id = unknownCategoryId,
                Amount = -80m,
                Metadata = new TransactionMetadata { RawDescription = "Ambiguous merchant" }
            }
        };
        var providerContent =
            "```json\n[" +
            $"{{\"Id\":\"{transportId}\",\"Category\":\"transport\",\"Confidence\":1.2}}," +
            $"{{\"Id\":\"{otherId}\",\"Category\":\" other \",\"Confidence\":0.75}}," +
            $"{{\"Id\":\"{unknownCategoryId}\",\"Category\":\"Not a real category\",\"Confidence\":-0.25}}," +
            $"{{\"Id\":\"{ignoredId}\",\"Category\":\"Food & Groceries\",\"Confidence\":0.9}}" +
            "\n]```";
        var handler = new StubHttpMessageHandler();
        handler.Enqueue(DeepSeekResponse(providerContent));
        var sut = CreateService(handler);

        var result = await sut.CategorizeTransactionsAsync(transactions);

        Assert.Equal("Transport", transactions[0].Category);
        Assert.Equal("Transport", transactions[0].Metadata.AiSuggestedCategory);
        Assert.Equal(1.0, transactions[0].Metadata.AiConfidenceScore);

        Assert.Equal("Other", transactions[1].Category);
        Assert.Equal("Other", transactions[1].Metadata.AiSuggestedCategory);
        Assert.Equal(0.75, transactions[1].Metadata.AiConfidenceScore);

        Assert.Equal("Uncategorized", transactions[2].Category);
        Assert.Null(transactions[2].Metadata.AiSuggestedCategory);
        Assert.Null(transactions[2].Metadata.AiConfidenceScore);
        Assert.Equal(3, result.ProcessedCount);
        Assert.Equal(2, result.ChangedCount);
        Assert.Equal(1, result.FailedCount);
        Assert.Equal(1, result.RemainingCount);

        var request = Assert.Single(handler.Requests);
        Assert.Equal(HttpMethod.Post, request.Method);
        Assert.EndsWith("/chat/completions", request.Uri, StringComparison.Ordinal);
        Assert.Equal("Bearer", request.AuthorizationScheme);
        Assert.Equal("test-api-key", request.AuthorizationParameter);

        using var body = JsonDocument.Parse(request.Body);
        Assert.Equal("test-model", body.RootElement.GetProperty("model").GetString());
        Assert.Equal("user", body.RootElement.GetProperty("messages")[0].GetProperty("role").GetString());
        Assert.False(body.RootElement.TryGetProperty("temperature", out _));

        var prompt = GetPrompt(request.Body);
        Assert.Contains("Food & Groceries", prompt);
        Assert.Contains("Shopping & Personal", prompt);
        Assert.Contains("Other", prompt);
        Assert.DoesNotContain("Groceries, Lifestyle", prompt);
    }

    [Fact]
    public async Task CategorizeTransactionsAsync_UsesProvidedLocationContextInPrompt()
    {
        var transaction = new Transaction
        {
            Id = Guid.NewGuid(),
            Amount = -15m,
            Metadata = new TransactionMetadata { RawDescription = "Local merchant" }
        };
        var handler = new StubHttpMessageHandler();
        handler.Enqueue(DeepSeekResponse($"[{{\"Id\":\"{transaction.Id}\",\"Category\":\"Food & Groceries\",\"Confidence\":0.8}}]"));
        var sut = CreateService(handler);

        await sut.CategorizeTransactionsAsync([transaction], " Bolzano,\nSouth Tyrol, Italy ");

        var request = Assert.Single(handler.Requests);
        var prompt = GetPrompt(request.Body);
        Assert.Contains("Bolzano, South Tyrol, Italy", prompt);
        Assert.DoesNotContain("Brixen, Trentino-South Tyrol, Italy", prompt);
    }

    [Fact]
    public async Task CategorizeTransactionsAsync_UsesNeutralPromptWhenLocationIsMissing()
    {
        var transaction = new Transaction
        {
            Id = Guid.NewGuid(),
            Amount = -15m,
            Metadata = new TransactionMetadata { RawDescription = "Local merchant" }
        };
        var handler = new StubHttpMessageHandler();
        handler.Enqueue(DeepSeekResponse($"[{{\"Id\":\"{transaction.Id}\",\"Category\":\"Food & Groceries\",\"Confidence\":0.8}}]"));
        var sut = CreateService(handler);

        await sut.CategorizeTransactionsAsync([transaction], "   ");

        var request = Assert.Single(handler.Requests);
        var prompt = GetPrompt(request.Body);
        Assert.Contains("No specific user location is configured", prompt);
        Assert.DoesNotContain("Brixen, Trentino-South Tyrol, Italy", prompt);
    }

    [Fact]
    public async Task CategorizeTransactionsAsync_SplitsRequestsIntoBatchesOfFifty()
    {
        var transactions = Enumerable.Range(0, 51)
            .Select(index => new Transaction
            {
                Id = Guid.NewGuid(),
                Amount = -index,
                Metadata = new TransactionMetadata { RawDescription = $"Transaction {index}" }
            })
            .ToList();
        var handler = new StubHttpMessageHandler();
        handler.Enqueue(DeepSeekResponse($"[{{\"Id\":\"{transactions[0].Id}\",\"Category\":\"Food & Groceries\",\"Confidence\":0.7}}]"));
        handler.Enqueue(DeepSeekResponse($"[{{\"Id\":\"{transactions[50].Id}\",\"Category\":\"Transport\",\"Confidence\":0.8}}]"));
        var sut = CreateService(handler);

        var result = await sut.CategorizeTransactionsAsync(transactions);

        Assert.Equal(2, handler.Requests.Count);
        Assert.Equal("Food & Groceries", transactions[0].Category);
        Assert.Equal("Transport", transactions[50].Category);
        Assert.Equal(51, result.ProcessedCount);
        Assert.Equal(2, result.ChangedCount);
        Assert.Equal(49, result.FailedCount);
        Assert.Equal(49, result.RemainingCount);
    }

    [Fact]
    public async Task CategorizeTransactionsAsync_LeavesTransactionsUnchangedWhenProviderReturnsInvalidJson()
    {
        var transaction = new Transaction
        {
            Category = "Uncategorized",
            Metadata = new TransactionMetadata { RawDescription = "Unknown merchant" }
        };
        var handler = new StubHttpMessageHandler();
        handler.Enqueue(DeepSeekResponse("this is not json"));
        var sut = CreateService(handler);

        var result = await sut.CategorizeTransactionsAsync([transaction]);

        Assert.Equal("Uncategorized", transaction.Category);
        Assert.Null(transaction.Metadata.AiSuggestedCategory);
        Assert.Null(transaction.Metadata.AiConfidenceScore);
        Assert.Equal(1, result.ProcessedCount);
        Assert.Equal(0, result.ChangedCount);
        Assert.Equal(1, result.FailedCount);
        Assert.Equal(1, result.RemainingCount);
    }

    [Fact]
    public async Task CategorizeTransactionsAsync_RejectsMissingCategoryAndConfidence()
    {
        var missingCategory = new Transaction();
        var missingConfidence = new Transaction();
        var handler = new StubHttpMessageHandler();
        handler.Enqueue(DeepSeekResponse(
            "[" +
            $"{{\"Id\":\"{missingCategory.Id}\",\"Confidence\":0.8}}," +
            $"{{\"Id\":\"{missingConfidence.Id}\",\"Category\":\"Transport\"}}" +
            "]"));
        var sut = CreateService(handler);

        var result = await sut.CategorizeTransactionsAsync(
            [missingCategory, missingConfidence]);

        Assert.Equal(2, result.ProcessedCount);
        Assert.Equal(0, result.ChangedCount);
        Assert.Equal(2, result.FailedCount);
        Assert.Equal(2, result.RemainingCount);
    }

    [Fact]
    public async Task CategorizeTransactionsAsync_RejectsDuplicateResultsAndIgnoresUnknownIds()
    {
        var duplicate = new Transaction();
        var missing = new Transaction();
        var unknownId = Guid.NewGuid();
        var handler = new StubHttpMessageHandler();
        handler.Enqueue(DeepSeekResponse(
            "[" +
            $"{{\"Id\":\"{duplicate.Id}\",\"Category\":\"Transport\",\"Confidence\":0.8}}," +
            $"{{\"Id\":\"{duplicate.Id}\",\"Category\":\"Food & Groceries\",\"Confidence\":0.9}}," +
            $"{{\"Id\":\"{unknownId}\",\"Category\":\"Other\",\"Confidence\":0.7}}" +
            "]"));
        var sut = CreateService(handler);

        var result = await sut.CategorizeTransactionsAsync([duplicate, missing]);

        Assert.Equal(0, result.ChangedCount);
        Assert.Equal(2, result.FailedCount);
        Assert.All([duplicate, missing], transaction =>
            Assert.Equal("Uncategorized", transaction.Category));
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("{\"choices\":[]}")]
    [InlineData("{\"choices\":[{}]}")]
    [InlineData("{\"choices\":[{\"message\":{}}]}")]
    [InlineData("{\"choices\":[{\"message\":{\"content\":\"\"}}]}")]
    [InlineData("not json")]
    public async Task CategorizeTransactionsAsync_TreatsMalformedProviderEnvelopeAsFailedBatch(
        string responseBody)
    {
        var transaction = new Transaction();
        var handler = new StubHttpMessageHandler();
        handler.Enqueue(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(responseBody, Encoding.UTF8, "application/json")
        });
        var sut = CreateService(handler);

        var result = await sut.CategorizeTransactionsAsync([transaction]);

        Assert.Equal(0, result.ChangedCount);
        Assert.Equal(1, result.FailedCount);
        Assert.Equal("Uncategorized", transaction.Category);
    }

    [Fact]
    public async Task CategorizeTransactionsAsync_ContinuesAfterFailedBatch()
    {
        var transactions = Enumerable.Range(0, 51)
            .Select(_ => new Transaction())
            .ToList();
        var handler = new StubHttpMessageHandler();
        handler.Enqueue(DeepSeekResponse("not json"));
        handler.Enqueue(DeepSeekResponse(
            $"[{{\"Id\":\"{transactions[50].Id}\",\"Category\":\"Transport\",\"Confidence\":0.8}}]"));
        var sut = CreateService(handler);

        var result = await sut.CategorizeTransactionsAsync(transactions);

        Assert.Equal(51, result.ProcessedCount);
        Assert.Equal(1, result.ChangedCount);
        Assert.Equal(50, result.FailedCount);
        Assert.Equal(50, result.RemainingCount);
        Assert.Equal("Transport", transactions[50].Category);
    }

    [Fact]
    public async Task CategorizeTransactionsAsync_TreatsUpstreamFailureAsFailedBatch()
    {
        var handler = new StubHttpMessageHandler();
        handler.Enqueue(new HttpResponseMessage(HttpStatusCode.BadGateway)
        {
            Content = new StringContent("sensitive provider failure")
        });
        var logger = new CapturingLogger<DeepSeekAiAdvisorService>();
        var sut = CreateService(handler, logger);

        var result = await sut.CategorizeTransactionsAsync([new Transaction()]);

        Assert.Equal(0, result.ChangedCount);
        Assert.Equal(1, result.FailedCount);
        Assert.DoesNotContain(
            logger.Messages,
            message => message.Contains("sensitive provider failure", StringComparison.Ordinal));
    }

    [Fact]
    public async Task CategorizeTransactionsAsync_TreatsTransportFailureAsFailedBatch()
    {
        var handler = new StubHttpMessageHandler();
        handler.EnqueueException(new HttpRequestException("transport unavailable"));
        var sut = CreateService(handler);

        var result = await sut.CategorizeTransactionsAsync([new Transaction()]);

        Assert.Equal(0, result.ChangedCount);
        Assert.Equal(1, result.FailedCount);
    }

    [Fact]
    public async Task CategorizeTransactionsAsync_DoesNotLogInvalidProviderContent()
    {
        const string sensitiveContent = "Merchant ABC 123.45 is not valid JSON";
        var handler = new StubHttpMessageHandler();
        handler.Enqueue(DeepSeekResponse(sensitiveContent));
        var logger = new CapturingLogger<DeepSeekAiAdvisorService>();
        var sut = CreateService(handler, logger);

        await sut.CategorizeTransactionsAsync([new Transaction()]);

        Assert.DoesNotContain(
            logger.Messages,
            message => message.Contains(sensitiveContent, StringComparison.Ordinal));
    }

    [Fact]
    public async Task GetSavingTipsAsync_DoesNotCallProviderForEmptyInput()
    {
        var handler = new StubHttpMessageHandler();
        var sut = CreateService(handler);

        var tips = await sut.GetSavingTipsAsync([]);

        Assert.Empty(tips);
        Assert.Empty(handler.Requests);
    }

    [Fact]
    public async Task GetSavingTipsAsync_NormalizesProviderTipsAndFiltersBlankDescriptions()
    {
        var longTitle = new string('A', 75);
        var providerTips = JsonSerializer.Serialize(new object[]
        {
            new
            {
                Title = "  Use a local transport pass  ",
                Description = "  Buy a monthly pass when commuting regularly.  ",
                Impact = "HIGH",
                Category = "transport",
                Reasoning = "  Transport is the largest category in the summary.  ",
                SupportingSignals = new[]
                {
                    "Transport spending is high.",
                    "Commuting costs appear recurring.",
                    "A pass may reduce repeat fares.",
                    "This extra signal should be ignored."
                }
            },
            new
            {
                Title = "",
                Description = "Cancel subscriptions that were not used this month.",
                Impact = "unexpected",
                Category = "unknown"
            },
            new
            {
                Title = longTitle,
                Description = "Move recurring grocery purchases to a planned weekly shop.",
                Impact = "low",
                Category = "Food & Groceries"
            },
            new
            {
                Title = "Blank description",
                Description = "   ",
                Impact = "High",
                Category = "Housing & Utilities"
            }
        });
        var handler = new StubHttpMessageHandler();
        handler.Enqueue(DeepSeekResponse($"```json\n{providerTips}\n```"));
        var sut = CreateService(handler);
        var transactions = new[]
        {
            new Transaction { Amount = -30m, Category = "Transport" },
            new Transaction { Amount = -15m, Category = "Subscriptions & Services" },
            new Transaction { Amount = 2500m, Category = "Income" }
        };

        var tips = await sut.GetSavingTipsAsync(transactions);

        Assert.Collection(
            tips,
            first =>
            {
                Assert.Equal("tip-1", first.Id);
                Assert.Equal("Use a local transport pass", first.Title);
                Assert.Equal("Buy a monthly pass when commuting regularly.", first.Description);
                Assert.Equal("High", first.Impact);
                Assert.Equal("Transport", first.Category);
                Assert.Equal("Transport is the largest category in the summary.", first.Reasoning);
                Assert.Equal(
                    [
                        "Transport spending is high.",
                        "Commuting costs appear recurring.",
                        "A pass may reduce repeat fares."
                    ],
                    first.SupportingSignals);
            },
            second =>
            {
                Assert.Equal("tip-2", second.Id);
                Assert.Equal("Savings Tip 2", second.Title);
                Assert.Equal("Medium", second.Impact);
                Assert.Equal("Shopping & Personal", second.Category);
                Assert.NotEmpty(second.Reasoning);
                Assert.Single(second.SupportingSignals);
            },
            third =>
            {
                Assert.Equal("tip-3", third.Id);
                Assert.True(third.Title.Length <= 60);
                Assert.Equal("Low", third.Impact);
                Assert.Equal("Food & Groceries", third.Category);
            });

        var request = Assert.Single(handler.Requests);
        using var body = JsonDocument.Parse(request.Body);
        Assert.Equal(0.7, body.RootElement.GetProperty("temperature").GetDouble());

        var prompt = GetPrompt(request.Body);
        Assert.Contains("Subscriptions & Services", prompt);
        Assert.Contains("Savings & Investments", prompt);
        Assert.Contains("Other", prompt);
        Assert.Contains("Reasoning", prompt);
        Assert.Contains("SupportingSignals", prompt);
        Assert.Contains("aggregated category totals", prompt);
        Assert.DoesNotContain("Energy, Groceries", prompt);
    }

    [Fact]
    public async Task GetSavingTipsAsync_UsesProvidedLocationContextInPrompt()
    {
        var handler = new StubHttpMessageHandler();
        handler.Enqueue(DeepSeekResponse("[{\"Title\":\"Tip\",\"Description\":\"Use local alternatives.\",\"Impact\":\"Medium\",\"Category\":\"Transport\"}]"));
        var sut = CreateService(handler);

        await sut.GetSavingTipsAsync(
            [new Transaction { Amount = -20m, Category = "Transport" }],
            "Merano, South Tyrol, Italy");

        var request = Assert.Single(handler.Requests);
        var prompt = GetPrompt(request.Body);
        Assert.Contains("Merano, South Tyrol, Italy", prompt);
        Assert.DoesNotContain("Brixen, Trentino-South Tyrol, Italy", prompt);
    }

    [Fact]
    public async Task GetSavingTipsAsync_ThrowsExternalServiceExceptionForInvalidProviderJson()
    {
        var handler = new StubHttpMessageHandler();
        handler.Enqueue(DeepSeekResponse("not json"));
        var sut = CreateService(handler);

        await Assert.ThrowsAsync<ExternalServiceException>(() =>
            sut.GetSavingTipsAsync([new Transaction { Amount = -20m, Category = "Food & Groceries" }]));
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("{\"choices\":[]}")]
    [InlineData("{\"choices\":[{\"message\":{}}]}")]
    [InlineData("not json")]
    public async Task GetSavingTipsAsync_ThrowsExternalServiceExceptionForMalformedProviderEnvelope(
        string responseBody)
    {
        var handler = new StubHttpMessageHandler();
        handler.Enqueue(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(responseBody, Encoding.UTF8, "application/json")
        });
        var sut = CreateService(handler);

        await Assert.ThrowsAsync<ExternalServiceException>(() =>
            sut.GetSavingTipsAsync(
                [new Transaction { Amount = -20m, Category = "Food & Groceries" }]));
    }

    [Fact]
    public async Task GetSavingTipsAsync_ThrowsExternalServiceExceptionForUpstreamFailure()
    {
        var handler = new StubHttpMessageHandler();
        handler.Enqueue(new HttpResponseMessage(HttpStatusCode.InternalServerError)
        {
            Content = new StringContent("upstream failed")
        });
        var sut = CreateService(handler);

        var exception = await Assert.ThrowsAsync<ExternalServiceException>(() =>
            sut.GetSavingTipsAsync([new Transaction { Amount = -20m, Category = "Food & Groceries" }]));

        Assert.Contains("unavailable", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetSavingTipsAsync_DoesNotLogRawUpstreamErrorBody()
    {
        const string sensitiveErrorBody = "raw provider payload includes Merchant ABC and 123.45";
        var handler = new StubHttpMessageHandler();
        handler.Enqueue(new HttpResponseMessage(HttpStatusCode.InternalServerError)
        {
            Content = new StringContent(sensitiveErrorBody)
        });
        var logger = new CapturingLogger<DeepSeekAiAdvisorService>();
        var sut = CreateService(handler, logger);

        await Assert.ThrowsAsync<ExternalServiceException>(() =>
            sut.GetSavingTipsAsync([new Transaction { Amount = -20m, Category = "Food & Groceries" }]));

        Assert.DoesNotContain(logger.Messages, message => message.Contains(sensitiveErrorBody, StringComparison.Ordinal));
        Assert.Contains(logger.Messages, message => message.Contains("DeepSeek savings tips request failed", StringComparison.Ordinal));
    }

    private static DeepSeekAiAdvisorService CreateService(
        StubHttpMessageHandler handler,
        ILogger<DeepSeekAiAdvisorService>? logger = null)
    {
        var httpClient = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://api.deepseek.test/")
        };

        return new DeepSeekAiAdvisorService(
            httpClient,
            CreateConfig(
                ("DeepSeek:ApiKey", "test-api-key"),
                ("DeepSeek:Model", "test-model")),
            logger ?? NullLogger<DeepSeekAiAdvisorService>.Instance);
    }

    private static IConfiguration CreateConfig(params (string Key, string? Value)[] values)
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(values.ToDictionary(value => value.Key, value => value.Value))
            .Build();
    }

    private static HttpResponseMessage DeepSeekResponse(string content)
    {
        var json = JsonSerializer.Serialize(new
        {
            choices = new[]
            {
                new
                {
                    message = new
                    {
                        content
                    }
                }
            }
        });

        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };
    }

    private static string GetPrompt(string requestBody)
    {
        using var body = JsonDocument.Parse(requestBody);

        return body.RootElement
            .GetProperty("messages")[0]
            .GetProperty("content")
            .GetString() ?? string.Empty;
    }

    private sealed class StubHttpMessageHandler : HttpMessageHandler
    {
        private readonly Queue<Func<HttpResponseMessage>> _responses = new();

        public List<CapturedRequest> Requests { get; } = [];

        public void Enqueue(HttpResponseMessage response)
        {
            _responses.Enqueue(() => response);
        }

        public void EnqueueException(Exception exception)
        {
            _responses.Enqueue(() => throw exception);
        }

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            if (_responses.Count == 0)
            {
                throw new InvalidOperationException("No HTTP response was queued for the test.");
            }

            var body = request.Content is null
                ? string.Empty
                : await request.Content.ReadAsStringAsync(cancellationToken);

            Requests.Add(new CapturedRequest(
                request.Method,
                request.RequestUri?.ToString() ?? string.Empty,
                request.Headers.Authorization?.Scheme,
                request.Headers.Authorization?.Parameter,
                body));

            return _responses.Dequeue()();
        }
    }

    private sealed record CapturedRequest(
        HttpMethod Method,
        string Uri,
        string? AuthorizationScheme,
        string? AuthorizationParameter,
        string Body);

    private sealed class CapturingLogger<T> : ILogger<T>
    {
        public List<string> Messages { get; } = [];

        public IDisposable? BeginScope<TState>(TState state)
            where TState : notnull =>
            NoopScope.Instance;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            Messages.Add(formatter(state, exception));
        }
    }

    private sealed class NoopScope : IDisposable
    {
        public static readonly NoopScope Instance = new();

        public void Dispose()
        {
        }
    }
}
