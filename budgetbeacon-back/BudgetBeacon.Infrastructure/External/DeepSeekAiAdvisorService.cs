using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using BudgetBeacon.Core.Diagnostics;
using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Exceptions;
using BudgetBeacon.Core.Interfaces;
using BudgetBeacon.Core.Models;

namespace BudgetBeacon.Infrastructure.External;

public sealed class DeepSeekAiAdvisorService : IAiAdvisorService
{
    private const int CategorizationBatchSize = 10;
    private const string DefaultModel = "deepseek-v4-flash";
    private const string DefaultCategory = "Shopping & Personal";
    private static readonly string AllowedCategoryValues =
        string.Join(", ", TransactionCategories.UserFacing);
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private const int MaxLocationContextLength = 120;
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;
    private readonly string _model;
    private readonly ILogger<DeepSeekAiAdvisorService> _logger;

    public DeepSeekAiAdvisorService(
        HttpClient httpClient,
        IConfiguration config,
        ILogger<DeepSeekAiAdvisorService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        _apiKey = config["DeepSeek:ApiKey"]!;
        if (string.IsNullOrWhiteSpace(_apiKey))
        {
            throw new InvalidOperationException(
                "DeepSeek:ApiKey is missing. Configure it via .NET user secrets or environment variables.");
        }

        _model = string.IsNullOrWhiteSpace(config["DeepSeek:Model"])
            ? DefaultModel
            : config["DeepSeek:Model"]!;
    }

    public async Task<TransactionCategorizationResult> CategorizeTransactionsAsync(
        List<Transaction> transactions,
        string? aiLocationContext = null,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (!transactions.Any())
            return TransactionCategorizationResult.Empty;

        _logger.LogInformation(
            "Starting AI categorization for {Count} transactions via DeepSeek model {Model}.",
            transactions.Count,
            _model);

        var batches = transactions.Chunk(CategorizationBatchSize).ToList();
        var processedCount = 0;
        var changedCount = 0;
        var failedCount = 0;

        foreach (var batch in batches)
        {
            cancellationToken.ThrowIfCancellationRequested();
            processedCount += batch.Length;
            _logger.LogInformation("Processing batch... ({Processed}/{Total})", processedCount, transactions.Count);

            var transactionData = batch.Select(t => new
            {
                t.Id,
                Description = t.Metadata.RawDescription,
                t.Amount
            });

            var jsonPayload = JsonSerializer.Serialize(transactionData);

            var prompt = BuildCategorizationPrompt(jsonPayload, aiLocationContext);

            try
            {
                var textResult = await SendPromptAsync(
                    prompt,
                    "categorization",
                    cancellationToken: cancellationToken);
                var batchChangedCount = ApplyCategorizationResults(batch, textResult);
                changedCount += batchChangedCount;
                failedCount += batch.Length - batchChangedCount;
            }
            catch (ExternalServiceException ex)
            {
                failedCount += batch.Length;
                _logger.LogError(
                    ObservabilityEventIds.DeepSeekInvalidResponse,
                    ex,
                    "DeepSeek categorization batch returned no usable result for model {Model}.",
                    _model);
            }
        }

        var remainingCount = transactions.Count(transaction =>
            string.Equals(
                transaction.Category,
                "Uncategorized",
                StringComparison.OrdinalIgnoreCase));

        _logger.LogInformation(
            "Completed AI categorization. Processed: {ProcessedCount}, Changed: {ChangedCount}, Failed: {FailedCount}, Remaining: {RemainingCount}.",
            transactions.Count,
            changedCount,
            failedCount,
            remainingCount);

        return new TransactionCategorizationResult(
            transactions.Count,
            changedCount,
            failedCount,
            remainingCount);
    }

    public async Task<IReadOnlyList<SavingsTip>> GetSavingTipsAsync(
        IEnumerable<Transaction> transactions,
        string? aiLocationContext = null)
    {
        var transactionList = transactions.ToList();

        if (!transactionList.Any())
            return Array.Empty<SavingsTip>();

        _logger.LogInformation(
            "Generating AI savings tips for {Count} transactions via DeepSeek model {Model}.",
            transactionList.Count,
            _model);

        var expensesByCategory = transactionList
            .Where(t => string.Equals(
                TransactionTreatment.Normalize(t.Treatment) ??
                TransactionTreatment.GetDefault(t.Amount, t.Category),
                TransactionTreatment.Expense,
                StringComparison.Ordinal))
            .GroupBy(t => t.Category)
            .Select(g => new
            {
                Category = g.Key,
                TotalSpent = Math.Abs(g.Sum(t => t.Amount))
            })
            .OrderByDescending(x => x.TotalSpent)
            .ToList();

        var jsonPayload = JsonSerializer.Serialize(expensesByCategory);

        var prompt = BuildSavingsTipsPrompt(jsonPayload, aiLocationContext);

        var textResult = await SendPromptAsync(prompt, "savings tips", temperature: 0.7);

        if (string.IsNullOrWhiteSpace(textResult))
            return Array.Empty<SavingsTip>();

        try
        {
            var aiResults = JsonSerializer.Deserialize<List<SavingsTip>>(
                NormalizeJsonText(textResult),
                JsonOptions
            ) ?? new List<SavingsTip>();

            return aiResults
                .Select((tip, index) => NormalizeSavingsTip(tip, index))
                .Where(tip => !string.IsNullOrWhiteSpace(tip.Description))
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ObservabilityEventIds.DeepSeekInvalidResponse,
                ex,
                "Failed to parse DeepSeek savings tips response for model {Model}.",
                _model);
            throw new ExternalServiceException("The AI provider returned an invalid response.");
        }
    }

    private async Task<string> SendPromptAsync(
        string prompt,
        string operation,
        double? temperature = null,
        CancellationToken cancellationToken = default)
    {
        var requestBody = new DeepSeekChatRequest
        {
            Model = _model,
            Messages =
            [
                new DeepSeekMessage
                {
                    Role = "user",
                    Content = prompt
                }
            ],
            Temperature = temperature
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, "chat/completions")
        {
            Content = JsonContent.Create(requestBody)
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);

        HttpResponseMessage response;
        try
        {
            response = await _httpClient.SendAsync(request, cancellationToken);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(
                ObservabilityEventIds.DeepSeekUpstreamFailure,
                ex,
                "DeepSeek {Operation} request failed during transport for model {Model}.",
                operation,
                _model);
            throw new ExternalServiceException($"AI {operation} is currently unavailable.", ex);
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogError(
                ObservabilityEventIds.DeepSeekUpstreamFailure,
                ex,
                "DeepSeek {Operation} request timed out for model {Model}.",
                operation,
                _model);
            throw new ExternalServiceException($"AI {operation} is currently unavailable.", ex);
        }

        using (response)
        {
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError(
                    ObservabilityEventIds.DeepSeekUpstreamFailure,
                    "DeepSeek {Operation} request failed. StatusCode: {StatusCode}, Model: {Model}",
                    operation,
                    (int)response.StatusCode,
                    _model);
                throw new ExternalServiceException($"AI {operation} is currently unavailable.");
            }

            try
            {
                string responseBody;
                try
                {
                    responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
                }
                catch (HttpRequestException ex)
                {
                    _logger.LogError(
                        ObservabilityEventIds.DeepSeekUpstreamFailure,
                        ex,
                        "DeepSeek {Operation} response failed during transport for model {Model}.",
                        operation,
                        _model);
                    throw new ExternalServiceException($"AI {operation} is currently unavailable.", ex);
                }
                catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
                {
                    _logger.LogError(
                        ObservabilityEventIds.DeepSeekUpstreamFailure,
                        ex,
                        "DeepSeek {Operation} response timed out for model {Model}.",
                        operation,
                        _model);
                    throw new ExternalServiceException($"AI {operation} is currently unavailable.", ex);
                }

                using var responseJson = JsonDocument.Parse(responseBody);

                if (responseJson.RootElement.ValueKind != JsonValueKind.Object ||
                    !responseJson.RootElement.TryGetProperty("choices", out var choices) ||
                    choices.ValueKind != JsonValueKind.Array ||
                    choices.GetArrayLength() == 0 ||
                    choices[0].ValueKind != JsonValueKind.Object ||
                    !choices[0].TryGetProperty("message", out var message) ||
                    message.ValueKind != JsonValueKind.Object ||
                    !message.TryGetProperty("content", out var content) ||
                    content.ValueKind != JsonValueKind.String)
                {
                    throw new JsonException("The expected AI response envelope was missing.");
                }

                var text = content.GetString();
                if (string.IsNullOrWhiteSpace(text))
                {
                    throw new JsonException("The AI response content was empty.");
                }

                return text;
            }
            catch (JsonException ex)
            {
                _logger.LogError(
                    ObservabilityEventIds.DeepSeekInvalidResponse,
                    ex,
                    "DeepSeek {Operation} returned an invalid response envelope for model {Model}.",
                    operation,
                    _model);
                throw new ExternalServiceException("The AI provider returned an invalid response.", ex);
            }
        }
    }

    private static int ApplyCategorizationResults(
        IReadOnlyList<Transaction> batch,
        string textResult)
    {
        JsonDocument document;
        try
        {
            document = JsonDocument.Parse(NormalizeJsonText(textResult));
        }
        catch (JsonException ex)
        {
            throw new ExternalServiceException("The AI provider returned an invalid response.", ex);
        }

        using (document)
        {
            if (document.RootElement.ValueKind != JsonValueKind.Array)
            {
                throw new ExternalServiceException("The AI provider returned an invalid response.");
            }

            var expectedTransactions = batch.ToDictionary(transaction => transaction.Id);
            var occurrenceCounts = new Dictionary<Guid, int>();
            var validResults = new Dictionary<Guid, ValidCategoryResult>();

            foreach (var item in document.RootElement.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.Object ||
                    !TryGetProperty(item, "Id", out var idElement) ||
                    idElement.ValueKind != JsonValueKind.String ||
                    !Guid.TryParse(idElement.GetString(), out var id) ||
                    !expectedTransactions.ContainsKey(id))
                {
                    continue;
                }

                occurrenceCounts[id] = occurrenceCounts.GetValueOrDefault(id) + 1;

                if (!TryGetProperty(item, "Category", out var categoryElement) ||
                    categoryElement.ValueKind != JsonValueKind.String)
                {
                    continue;
                }

                var category = TransactionCategories.NormalizeUserFacing(categoryElement.GetString());
                if (category is null ||
                    !TryGetProperty(item, "Confidence", out var confidenceElement) ||
                    confidenceElement.ValueKind != JsonValueKind.Number ||
                    !confidenceElement.TryGetDouble(out var confidence) ||
                    !double.IsFinite(confidence))
                {
                    continue;
                }

                validResults[id] = new ValidCategoryResult(
                    category,
                    Math.Clamp(confidence, 0.0, 1.0));
            }

            var changedCount = 0;
            foreach (var transaction in batch)
            {
                if (occurrenceCounts.GetValueOrDefault(transaction.Id) != 1 ||
                    !validResults.TryGetValue(transaction.Id, out var result))
                {
                    continue;
                }

                transaction.Category = result.Category;
                transaction.Treatment = TransactionTreatment.GetDefault(
                    transaction.Amount,
                    result.Category);
                transaction.Metadata.AiSuggestedCategory = result.Category;
                transaction.Metadata.AiConfidenceScore = result.Confidence;
                changedCount++;
            }

            return changedCount;
        }
    }

    private static bool TryGetProperty(
        JsonElement element,
        string propertyName,
        out JsonElement value)
    {
        foreach (var property in element.EnumerateObject())
        {
            if (string.Equals(property.Name, propertyName, StringComparison.OrdinalIgnoreCase))
            {
                value = property.Value;
                return true;
            }
        }

        value = default;
        return false;
    }

    private static string BuildCategorizationPrompt(string jsonPayload, string? aiLocationContext)
    {
        return $@"
                You are an expert financial categorization AI.
                Context: {BuildLocationContext(aiLocationContext)}

                Task: Categorize the following bank transactions into standard budgeting categories.

                Allowed Category values: {AllowedCategoryValues}

                CRUCIAL INSTRUCTION: For EACH transaction, you MUST calculate a realistic 'Confidence' score between 0.0 (completely guessing) and 1.0 (absolutely certain) based on how recognizable the description is. Do not just copy the example value!

                Return ONLY a raw JSON array of objects with the following exact structure. Do not use markdown fences or prose:
                [
                  {{
                    ""Id"": ""the-guid-here"",
                    ""Category"": ""Suggested Category"",
                    ""Confidence"": 0.82
                  }}
                ]

                Transactions to categorize:
                {jsonPayload}";
    }

    private static string BuildSavingsTipsPrompt(string jsonPayload, string? aiLocationContext)
    {
        return $@"
            You are a highly skilled personal finance advisor.
            Context: {BuildLocationContext(aiLocationContext)}

            Task: Analyze the user's spending habits based on the following categorized expense summary. Provide exactly 3 actionable and specific tips on how to save money.

            CRUCIAL OUTPUT INSTRUCTIONS (STRICTLY ENFORCED):
            1. Return ONLY a raw JSON array. No markdown, no prose before or after.
            2. Use this exact structure:
               [
                 {{
                   ""Title"": ""Short headline"",
                   ""Description"": ""One practical paragraph with the recommendation."",
                   ""Impact"": ""High"",
                   ""Category"": ""Transport"",
                   ""Reasoning"": ""One short paragraph explaining why this tip follows from the aggregated category totals."",
                   ""SupportingSignals"": [
                     ""Transport is one of the highest expense categories in the selected period."",
                     ""The spending pattern suggests recurring costs in this category.""
                   ]
                 }}
               ]
            3. Allowed Impact values: High, Medium, Low.
            4. Allowed Category values: {AllowedCategoryValues}.
            5. Keep each title under 60 characters.
            6. Description must be plain text, readable in a web UI, and may include the EUR symbol.
            7. Reasoning must explain the recommendation using only the provided aggregated expense summary and must not imply access to individual transactions.
            8. SupportingSignals must contain 1 to 3 short plain-text observations from the aggregated category totals.

            Expense Summary (Absolute Values):
            {jsonPayload}";
    }

    private static string BuildLocationContext(string? aiLocationContext)
    {
        var normalized = NormalizeLocationContext(aiLocationContext);

        return normalized is null
            ? "No specific user location is configured. Do not assume a city or region."
            : $"The user is located in {normalized}. Keep local merchants, utilities, and regional services in mind.";
    }

    private static string? NormalizeLocationContext(string? value)
    {
        var normalized = string.Join(
            ' ',
            (value ?? string.Empty).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

        if (string.IsNullOrWhiteSpace(normalized))
            return null;

        return normalized.Length <= MaxLocationContextLength
            ? normalized
            : normalized[..MaxLocationContextLength].TrimEnd();
    }

    private static SavingsTip NormalizeSavingsTip(SavingsTip tip, int index)
    {
        var description = (tip.Description ?? string.Empty).Trim();
        var title = (tip.Title ?? string.Empty).Trim();
        var reasoning = (tip.Reasoning ?? string.Empty).Trim();
        var supportingSignals = tip.SupportingSignals?
            .Select(signal => signal.Trim())
            .Where(signal => !string.IsNullOrWhiteSpace(signal))
            .Take(3)
            .ToArray() ?? [];

        if (string.IsNullOrWhiteSpace(title))
        {
            title = $"Savings Tip {index + 1}";
        }

        if (title.Length > 60)
        {
            title = title[..60].TrimEnd();
        }

        if (string.IsNullOrWhiteSpace(reasoning))
        {
            reasoning = "This recommendation was generated from the aggregated spending summary for the selected timeframe.";
        }

        if (supportingSignals.Length == 0)
        {
            supportingSignals =
            [
                "The AI used category-level expense totals rather than raw transaction details."
            ];
        }

        return new SavingsTip
        {
            Id = $"tip-{index + 1}",
            Title = title,
            Description = description,
            Impact = NormalizeImpact(tip.Impact),
            Category = NormalizeCategory(tip.Category),
            Reasoning = reasoning,
            SupportingSignals = supportingSignals
        };
    }

    private static string NormalizeImpact(string? impact)
    {
        return impact?.Trim().ToLowerInvariant() switch
        {
            "high" => "High",
            "medium" => "Medium",
            "low" => "Low",
            _ => "Medium"
        };
    }

    private static string NormalizeCategory(string? category)
    {
        var normalized = category?.Trim();

        if (string.IsNullOrWhiteSpace(normalized))
            return DefaultCategory;

        return TransactionCategories.NormalizeUserFacing(normalized) ?? DefaultCategory;
    }

    private static string NormalizeJsonText(string text)
    {
        var trimmed = text.Trim();

        if (!trimmed.StartsWith("```", StringComparison.Ordinal))
            return trimmed;

        var firstLineEnd = trimmed.IndexOf('\n');
        if (firstLineEnd < 0)
            return trimmed;

        var withoutOpeningFence = trimmed[(firstLineEnd + 1)..].Trim();
        var closingFenceIndex = withoutOpeningFence.LastIndexOf("```", StringComparison.Ordinal);

        return closingFenceIndex >= 0
            ? withoutOpeningFence[..closingFenceIndex].Trim()
            : withoutOpeningFence;
    }

    private sealed class DeepSeekChatRequest
    {
        [JsonPropertyName("model")]
        public string Model { get; init; } = string.Empty;

        [JsonPropertyName("messages")]
        public IReadOnlyList<DeepSeekMessage> Messages { get; init; } = Array.Empty<DeepSeekMessage>();

        [JsonPropertyName("temperature")]
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public double? Temperature { get; init; }
    }

    private sealed class DeepSeekMessage
    {
        [JsonPropertyName("role")]
        public string Role { get; init; } = string.Empty;

        [JsonPropertyName("content")]
        public string Content { get; init; } = string.Empty;
    }

    private sealed record ValidCategoryResult(string Category, double Confidence);
}
