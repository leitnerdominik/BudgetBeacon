using System.Net;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using BudgetBeacon.Infrastructure.External;

namespace BudgetBeacon.Tests.Infrastructure;

public sealed class OpenMeteoLocationSuggestionServiceTests
{
    [Fact]
    public async Task SearchAsync_ReturnsEmptyListForShortQuery()
    {
        var handler = new StubHttpMessageHandler();
        var sut = CreateService(handler);

        var suggestions = await sut.SearchAsync("Bo", 8);

        Assert.Empty(suggestions);
        Assert.Empty(handler.Requests);
    }

    [Fact]
    public async Task SearchAsync_MapsProviderResultsToLocationSuggestions()
    {
        var handler = new StubHttpMessageHandler();
        handler.EnqueueJson("""
            {
              "results": [
                {
                  "id": 2950159,
                  "name": "Berlin",
                  "admin1": "Berlin",
                  "country": "Germany",
                  "country_code": "de"
                }
              ]
            }
            """);
        var sut = CreateService(handler);

        var suggestions = await sut.SearchAsync("Berlin", 8);

        var suggestion = Assert.Single(suggestions);
        Assert.Equal("2950159", suggestion.Id);
        Assert.Equal("Berlin, Berlin, Germany", suggestion.Label);
        Assert.Equal("Berlin", suggestion.Name);
        Assert.Equal("Berlin", suggestion.Admin1);
        Assert.Equal("Germany", suggestion.Country);
        Assert.Equal("DE", suggestion.CountryCode);
        var request = Assert.Single(handler.Requests);
        Assert.NotNull(request.RequestUri);
        Assert.Contains("/v1/search?", request.RequestUri.PathAndQuery);
        Assert.Contains("name=Berlin", request.RequestUri.Query);
        Assert.Contains("count=8", request.RequestUri.Query);
        Assert.Contains("language=en", request.RequestUri.Query);
        Assert.Contains("format=json", request.RequestUri.Query);
    }

    [Fact]
    public async Task SearchAsync_FiltersMalformedResults()
    {
        var handler = new StubHttpMessageHandler();
        handler.EnqueueJson("""
            {
              "results": [
                {
                  "id": 1,
                  "name": "",
                  "country": "Germany",
                  "country_code": "DE"
                },
                {
                  "id": 2,
                  "name": "Munich",
                  "country": "Germany",
                  "country_code": "DE"
                }
              ]
            }
            """);
        var sut = CreateService(handler);

        var suggestions = await sut.SearchAsync("Munich", 8);

        var suggestion = Assert.Single(suggestions);
        Assert.Equal("Munich, Germany", suggestion.Label);
    }

    [Fact]
    public async Task SearchAsync_ReturnsEmptyListForMalformedProviderResponse()
    {
        var handler = new StubHttpMessageHandler();
        handler.Enqueue(
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{ not json", Encoding.UTF8, "application/json")
            });
        var sut = CreateService(handler);

        var suggestions = await sut.SearchAsync("Berlin", 8);

        Assert.Empty(suggestions);
    }

    private static OpenMeteoLocationSuggestionService CreateService(
        StubHttpMessageHandler handler)
    {
        var httpClient = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://geocoding-api.open-meteo.test/")
        };
        var configuration = new ConfigurationBuilder().Build();

        return new OpenMeteoLocationSuggestionService(
            httpClient,
            configuration,
            NullLogger<OpenMeteoLocationSuggestionService>.Instance);
    }

    private sealed class StubHttpMessageHandler : HttpMessageHandler
    {
        private readonly Queue<HttpResponseMessage> _responses = [];
        public List<HttpRequestMessage> Requests { get; } = [];

        public void EnqueueJson(string json)
        {
            Enqueue(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            });
        }

        public void Enqueue(HttpResponseMessage response)
        {
            _responses.Enqueue(response);
        }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            Requests.Add(request);
            return Task.FromResult(_responses.Count > 0
                ? _responses.Dequeue()
                : new HttpResponseMessage(HttpStatusCode.NotFound));
        }
    }
}
