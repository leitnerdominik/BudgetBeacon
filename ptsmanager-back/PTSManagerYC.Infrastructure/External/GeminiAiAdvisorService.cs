using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using PTSManagerYC.Core.Entities;
using PTSManagerYC.Core.Exceptions;
using PTSManagerYC.Core.Interfaces;
using PTSManagerYC.Core.Models;

namespace PTSManagerYC.Infrastructure.External;

public class GeminiAiAdvisorService : IAiAdvisorService
{
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
    private readonly ILogger<GeminiAiAdvisorService> _logger;

    public GeminiAiAdvisorService(HttpClient httpClient, IConfiguration config, ILogger<GeminiAiAdvisorService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        _apiKey = config["Gemini:ApiKey"] ?? throw new InvalidOperationException(
            "Gemini:ApiKey is missing. Configure it via .NET user secrets or environment variables.");
        _model = config["Gemini:Model"] ?? throw new InvalidOperationException(
            "Gemini:Model is missing. Configure it via application settings.");
    }

    public async Task CategorizeTransactionsAsync(List<Transaction> transactions)
    {
        if (!transactions.Any())
            return;

        _logger.LogInformation("Starting AI categorization for {Count} transactions via Gemini.", transactions.Count);
        var batches = transactions.Chunk(50).ToList();
        int processedCount = 0;

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

            string jsonPayload = JsonSerializer.Serialize(transactionData);

            string prompt = $@"
                You are an expert financial categorization AI.
                Context: The user is located in Brixen, Trentino-South Tyrol, Italy. Keep local merchants, utilities, and regional services in mind when analyzing the descriptions.
                
                Task: Categorize the following bank transactions into standard budgeting categories (e.g., Groceries, Housing, Utilities, Entertainment, Salary, Transport, Health, Subscriptions).

                CRUCIAL INSTRUCTION: For EACH transaction, you MUST calculate a realistic 'Confidence' score between 0.0 (completely guessing) and 1.0 (absolutely certain) based on how recognizable the description is. Do not just copy the example value!
                
                Return ONLY a raw JSON array of objects with the following exact structure (no markdown tags like ```json):
                [
                  {{
                    ""Id"": ""the-guid-here"",
                    ""Category"": ""Suggested Category"",
                    ""Confidence"": 0.82
                  }}
                ]
                
                Transactions to categorize:
                {jsonPayload}";

            var requestBody = new
            {
                contents = new[] { new { parts = new[] { new { text = prompt } } } },
                generationConfig = new { response_mime_type = "application/json" }
            };

            var url = $"v1beta/models/{_model}:generateContent?key={_apiKey}";

            var response = await _httpClient.PostAsJsonAsync(url, requestBody);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogError("Gemini API Error: {Error}", error);
                throw new ExternalServiceException("AI categorization is currently unavailable.");
            }

            var responseJson = await response.Content.ReadFromJsonAsync<JsonElement>();

            try
            {
                var textResult = responseJson
                    .GetProperty("candidates")[0]
                    .GetProperty("content")
                    .GetProperty("parts")[0]
                    .GetProperty("text").GetString();

                if (string.IsNullOrWhiteSpace(textResult))
                    continue;

                var aiResults = JsonSerializer.Deserialize<List<AiCategoryResponse>>(textResult, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (aiResults == null)
                    continue;

                foreach (var result in aiResults)
                {
                    var target = transactions.FirstOrDefault(t => t.Id == result.Id);
                    if (target != null)
                    {
                        target.Category = result.Category;
                        target.Metadata.AiSuggestedCategory = result.Category;
                        target.Metadata.AiConfidenceScore = result.Confidence;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to parse the JSON response from Gemini for the current batch.");
            }
        }

        _logger.LogInformation("Successfully completed AI categorization batches.");
    }

    public async Task<IReadOnlyList<SavingsTip>> GetSavingTipsAsync(IEnumerable<Transaction> transactions)
    {
        var transactionList = transactions.ToList();

        if (!transactionList.Any())
            return Array.Empty<SavingsTip>();

        _logger.LogInformation("Generating AI savings tips for {Count} transactions.", transactionList.Count);

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

        string jsonPayload = JsonSerializer.Serialize(expensesByCategory);

        string prompt = $@"
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

        var requestBody = new
        {
            contents = new[] { new { parts = new[] { new { text = prompt } } } },
            generationConfig = new { temperature = 0.7, response_mime_type = "application/json" }
        };

        var url = $"v1beta/models/gemini-2.5-flash:generateContent?key={_apiKey}";

        var response = await _httpClient.PostAsJsonAsync(url, requestBody);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            _logger.LogError("Gemini API Error during saving tips: {Error}", error);
            throw new ExternalServiceException("AI tips are currently unavailable.");
        }

        var responseJson = await response.Content.ReadFromJsonAsync<JsonElement>();

        try
        {
            var textResult = responseJson
                .GetProperty("candidates")[0]
                .GetProperty("content")
                .GetProperty("parts")[0]
                .GetProperty("text").GetString();

            if (string.IsNullOrWhiteSpace(textResult))
                return Array.Empty<SavingsTip>();

            var aiResults = JsonSerializer.Deserialize<List<SavingsTip>>(
                textResult,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
            ) ?? new List<SavingsTip>();

            return aiResults
                .Select((tip, index) => NormalizeSavingsTip(tip, index))
                .Where(tip => !string.IsNullOrWhiteSpace(tip.Description))
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse the saving tips response from Gemini.");
            throw new ExternalServiceException("The AI provider returned an invalid response.");
        }
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

    private class AiCategoryResponse
    {
        public Guid Id { get; set; }
        public string Category { get; set; } = string.Empty;
        public double Confidence { get; set; }
    }
}
