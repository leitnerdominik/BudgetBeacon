using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using PTSManagerYC.Core.Diagnostics;
using PTSManagerYC.Core.Entities;
using PTSManagerYC.Core.Exceptions;
using PTSManagerYC.Core.Interfaces;
using PTSManagerYC.Core.Models;

namespace PTSManagerYC.Infrastructure.External;

public sealed class OpenRouterAiAdvisorService : IAiAdvisorService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private static readonly string[] AllowedCategories =
    [
        "Transport",
        "Energy",
        "Groceries",
        "Lifestyle",
        "Housing",
        "Utilities",
        "Entertainment",
        "Health",
        "Subscriptions",
        "Income"
    ];

    private readonly HttpClient _httpClient;
    private readonly string _apiKey;
    private readonly string _model;
    private readonly ILogger<OpenRouterAiAdvisorService> _logger;

    public OpenRouterAiAdvisorService(
        HttpClient httpClient,
        IConfiguration config,
        ILogger<OpenRouterAiAdvisorService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        _apiKey = config["OpenRouter:ApiKey"] ?? throw new InvalidOperationException(
            "OpenRouter:ApiKey is missing. Configure it via .NET user secrets or environment variables.");
        _model = config["OpenRouter:Model"] ?? throw new InvalidOperationException(
            "OpenRouter:Model is missing. Configure it via application settings.");
    }

    public async Task CategorizeTransactionsAsync(List<Transaction> transactions)
    {
        if (!transactions.Any())
            return;

        _logger.LogInformation(
            "Starting AI categorization for {Count} transactions via OpenRouter model {Model}.",
            transactions.Count,
            _model);

        var batches = transactions.Chunk(50).ToList();
        var processedCount = 0;

        foreach (var batch in batches)
        {
            processedCount += batch.Length;
            _logger.LogInformation("Processing batch... ({Processed}/{Total})", processedCount, transactions.Count);

            var transactionData = batch.Select(t => new
            {
                t.Id,
                Description = t.Metadata.RawDescription,
                t.Amount
            });

            var jsonPayload = JsonSerializer.Serialize(transactionData);

            var prompt = $@"
                You are an expert financial categorization AI.
                Context: The user is located in Brixen, Trentino-South Tyrol, Italy. Keep local merchants, utilities, and regional services in mind when analyzing the descriptions.

                Task: Categorize the following bank transactions into standard budgeting categories (e.g., Groceries, Housing, Utilities, Entertainment, Salary, Transport, Health, Subscriptions).

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

            var textResult = await SendPromptAsync(prompt, "categorization");

            if (string.IsNullOrWhiteSpace(textResult))
                continue;

            try
            {
                var aiResults = JsonSerializer.Deserialize<List<AiCategoryResponse>>(
                    NormalizeJsonText(textResult),
                    JsonOptions);

                if (aiResults == null)
                    continue;

                foreach (var result in aiResults)
                {
                    var target = transactions.FirstOrDefault(t => t.Id == result.Id);
                    if (target != null)
                    {
                        var category = NormalizeCategory(result.Category);
                        target.Category = category;
                        target.Metadata.AiSuggestedCategory = category;
                        target.Metadata.AiConfidenceScore = Math.Clamp(result.Confidence, 0.0, 1.0);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ObservabilityEventIds.OpenRouterInvalidResponse,
                    ex,
                    "Failed to parse OpenRouter categorization response for model {Model}.",
                    _model);
            }
        }

        _logger.LogInformation("Successfully completed AI categorization batches.");
    }

    public async Task<IReadOnlyList<SavingsTip>> GetSavingTipsAsync(IEnumerable<Transaction> transactions)
    {
        var transactionList = transactions.ToList();

        if (!transactionList.Any())
            return Array.Empty<SavingsTip>();

        _logger.LogInformation(
            "Generating AI savings tips for {Count} transactions via OpenRouter model {Model}.",
            transactionList.Count,
            _model);

        var expensesByCategory = transactionList
            .Where(t => t.Amount < 0)
            .GroupBy(t => t.Category)
            .Select(g => new
            {
                Category = g.Key,
                TotalSpent = Math.Abs(g.Sum(t => t.Amount))
            })
            .OrderByDescending(x => x.TotalSpent)
            .ToList();

        var jsonPayload = JsonSerializer.Serialize(expensesByCategory);

        var prompt = $@"
            You are a highly skilled personal finance advisor.
            Context: The user is located in Brixen, Trentino-South Tyrol, Italy. Use this context to provide realistic, localized advice if applicable.

            Task: Analyze the user's spending habits based on the following categorized expense summary. Provide exactly 3 actionable and specific tips on how to save money.

            CRUCIAL OUTPUT INSTRUCTIONS (STRICTLY ENFORCED):
            1. Return ONLY a raw JSON array. No markdown, no prose before or after.
            2. Use this exact structure:
               [
                 {{
                   ""Title"": ""Short headline"",
                   ""Description"": ""One practical paragraph with the recommendation."",
                   ""Impact"": ""High"",
                   ""Category"": ""Transport""
                 }}
               ]
            3. Allowed Impact values: High, Medium, Low.
            4. Allowed Category values: Transport, Energy, Groceries, Lifestyle, Housing, Utilities, Entertainment, Health, Subscriptions, Income.
            5. Keep each title under 60 characters.
            6. Description must be plain text, readable in a web UI, and may include the EUR symbol.

            Expense Summary (Absolute Values):
            {jsonPayload}";

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
                ObservabilityEventIds.OpenRouterInvalidResponse,
                ex,
                "Failed to parse OpenRouter savings tips response for model {Model}.",
                _model);
            throw new ExternalServiceException("The AI provider returned an invalid response.");
        }
    }

    private async Task<string?> SendPromptAsync(string prompt, string operation, double? temperature = null)
    {
        var requestBody = new OpenRouterChatRequest
        {
            Model = _model,
            Messages =
            [
                new OpenRouterMessage
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

        using var response = await _httpClient.SendAsync(request);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            _logger.LogError(
                ObservabilityEventIds.OpenRouterUpstreamFailure,
                "OpenRouter {Operation} request failed. StatusCode: {StatusCode}, Model: {Model}, Error: {Error}",
                operation,
                (int)response.StatusCode,
                _model,
                error);
            throw new ExternalServiceException($"AI {operation} is currently unavailable.");
        }

        var responseJson = await response.Content.ReadFromJsonAsync<JsonElement>();

        return responseJson
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString();
    }

    private static SavingsTip NormalizeSavingsTip(SavingsTip tip, int index)
    {
        var description = (tip.Description ?? string.Empty).Trim();
        var title = (tip.Title ?? string.Empty).Trim();

        if (string.IsNullOrWhiteSpace(title))
        {
            title = $"Savings Tip {index + 1}";
        }

        if (title.Length > 60)
        {
            title = title[..60].TrimEnd();
        }

        return new SavingsTip
        {
            Id = $"tip-{index + 1}",
            Title = title,
            Description = description,
            Impact = NormalizeImpact(tip.Impact),
            Category = NormalizeCategory(tip.Category)
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
            return "Lifestyle";

        var match = AllowedCategories.FirstOrDefault(allowed =>
            string.Equals(allowed, normalized, StringComparison.OrdinalIgnoreCase));

        return match ?? "Lifestyle";
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

    private sealed class OpenRouterChatRequest
    {
        [JsonPropertyName("model")]
        public string Model { get; init; } = string.Empty;

        [JsonPropertyName("messages")]
        public IReadOnlyList<OpenRouterMessage> Messages { get; init; } = Array.Empty<OpenRouterMessage>();

        [JsonPropertyName("temperature")]
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public double? Temperature { get; init; }
    }

    private sealed class OpenRouterMessage
    {
        [JsonPropertyName("role")]
        public string Role { get; init; } = string.Empty;

        [JsonPropertyName("content")]
        public string Content { get; init; } = string.Empty;
    }

    private sealed class AiCategoryResponse
    {
        public Guid Id { get; set; }
        public string Category { get; set; } = string.Empty;
        public double Confidence { get; set; }
    }
}
