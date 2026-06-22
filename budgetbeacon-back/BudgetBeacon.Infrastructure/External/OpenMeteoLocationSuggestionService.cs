using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using BudgetBeacon.Core.Interfaces;
using BudgetBeacon.Core.Models;

namespace BudgetBeacon.Infrastructure.External;

public sealed class OpenMeteoLocationSuggestionService : ILocationSuggestionService
{
    private const int MaxCount = 8;
    private readonly HttpClient _httpClient;
    private readonly string? _apiKey;
    private readonly ILogger<OpenMeteoLocationSuggestionService> _logger;

    public OpenMeteoLocationSuggestionService(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<OpenMeteoLocationSuggestionService> logger)
    {
        _httpClient = httpClient;
        _apiKey = configuration["OpenMeteo:GeocodingApiKey"];
        _logger = logger;
    }

    public async Task<IReadOnlyList<LocationSuggestion>> SearchAsync(
        string query,
        int count,
        CancellationToken cancellationToken = default)
    {
        var normalizedQuery = NormalizeQuery(query);
        if (normalizedQuery.Length < 3)
        {
            return [];
        }

        var safeCount = Math.Clamp(count, 1, MaxCount);
        var requestPath =
            $"v1/search?name={Uri.EscapeDataString(normalizedQuery)}" +
            $"&count={safeCount}" +
            "&language=en" +
            "&format=json";

        if (!string.IsNullOrWhiteSpace(_apiKey))
        {
            requestPath += $"&apikey={Uri.EscapeDataString(_apiKey)}";
        }

        try
        {
            var response = await _httpClient.GetFromJsonAsync<OpenMeteoGeocodingResponse>(
                requestPath,
                cancellationToken);

            return response?.Results?
                .Select(MapSuggestion)
                .Where(suggestion => suggestion is not null)
                .Select(suggestion => suggestion!)
                .Take(safeCount)
                .ToList() ?? [];
        }
        catch (Exception ex) when (
            ex is HttpRequestException or
            TaskCanceledException or
            NotSupportedException or
            System.Text.Json.JsonException)
        {
            _logger.LogWarning(
                ex,
                "Location suggestion provider request failed.");
            return [];
        }
    }

    private static LocationSuggestion? MapSuggestion(OpenMeteoLocationResult result)
    {
        var name = result.Name?.Trim();
        var country = result.Country?.Trim();
        var countryCode = result.CountryCode?.Trim().ToUpperInvariant();

        if (result.Id is null ||
            string.IsNullOrWhiteSpace(name) ||
            string.IsNullOrWhiteSpace(country) ||
            string.IsNullOrWhiteSpace(countryCode))
        {
            return null;
        }

        var admin1 = string.IsNullOrWhiteSpace(result.Admin1)
            ? null
            : result.Admin1.Trim();
        var label = string.Join(
            ", ",
            new[] { name, admin1, country }
                .Where(part => !string.IsNullOrWhiteSpace(part)));

        return new LocationSuggestion(
            result.Id.Value.ToString(System.Globalization.CultureInfo.InvariantCulture),
            label,
            name,
            admin1,
            country,
            countryCode);
    }

    private static string NormalizeQuery(string value) =>
        string.Join(" ", (value ?? string.Empty)
            .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

    private sealed class OpenMeteoGeocodingResponse
    {
        [JsonPropertyName("results")]
        public List<OpenMeteoLocationResult>? Results { get; init; }
    }

    private sealed class OpenMeteoLocationResult
    {
        [JsonPropertyName("id")]
        public int? Id { get; init; }

        [JsonPropertyName("name")]
        public string? Name { get; init; }

        [JsonPropertyName("admin1")]
        public string? Admin1 { get; init; }

        [JsonPropertyName("country")]
        public string? Country { get; init; }

        [JsonPropertyName("country_code")]
        public string? CountryCode { get; init; }
    }
}
