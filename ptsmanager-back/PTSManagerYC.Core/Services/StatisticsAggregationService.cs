using System.Text.RegularExpressions;
using PTSManagerYC.Core.Entities;
using PTSManagerYC.Core.Models;

namespace PTSManagerYC.Core.Services;

public sealed partial class StatisticsAggregationService
{
    private const int TopExpenseLimit = 5;
    private const int RecurringExpenseLimit = 10;

    private readonly FinanceAggregationService _financeAggregationService;

    public StatisticsAggregationService(FinanceAggregationService financeAggregationService)
    {
        _financeAggregationService = financeAggregationService;
    }

    public StatisticsOverview BuildFixedPeriod(
        IEnumerable<Transaction> transactions,
        DateTime startDate,
        DateTime endDate,
        int monthsBack)
    {
        var allTransactions = transactions.ToList();
        var periodTransactions = FilterByDateRange(allTransactions, startDate, endDate);
        var previousMonthSummary = monthsBack == 1
            ? BuildSummary(FilterByDateRange(allTransactions, startDate.AddMonths(-1), startDate.AddTicks(-1)))
            : null;

        return new StatisticsOverview(
            AllTime: false,
            MonthsBack: monthsBack,
            StartDate: startDate,
            EndDate: endDate,
            TrendGranularity: "month",
            Summary: BuildSummary(periodTransactions),
            PreviousMonthSummary: previousMonthSummary,
            Trend: BuildMonthlyTrend(periodTransactions, startDate, endDate),
            Categories: BuildCategorySummaries(periodTransactions),
            TopExpenses: BuildTopExpenses(periodTransactions, TopExpenseLimit),
            RecurringExpenses: monthsBack >= 2
                ? BuildRecurringExpenses(periodTransactions, RecurringExpenseLimit)
                : []);
    }

    public StatisticsOverview BuildAllTime(IEnumerable<Transaction> transactions)
    {
        var allTransactions = transactions
            .OrderBy(transaction => transaction.Date)
            .ToList();
        var startDate = allTransactions.Count > 0
            ? StartOfMonth(allTransactions[0].Date)
            : (DateTime?)null;
        var endDate = allTransactions.Count > 0
            ? EndOfMonth(allTransactions[^1].Date)
            : (DateTime?)null;

        return new StatisticsOverview(
            AllTime: true,
            MonthsBack: null,
            StartDate: startDate,
            EndDate: endDate,
            TrendGranularity: "year",
            Summary: BuildSummary(allTransactions),
            PreviousMonthSummary: null,
            Trend: BuildYearlyTrend(allTransactions),
            Categories: BuildCategorySummaries(allTransactions),
            TopExpenses: BuildTopExpenses(allTransactions, TopExpenseLimit),
            RecurringExpenses: BuildRecurringExpenses(allTransactions, RecurringExpenseLimit));
    }

    public MonthlySummary BuildMonthlySummary(
        int year,
        int month,
        IEnumerable<Transaction> transactions)
    {
        var monthlyTransactions = transactions.ToList();
        var summary = BuildSummary(monthlyTransactions);

        return new MonthlySummary(
            year,
            month,
            summary.TotalIncome,
            summary.TotalExpense,
            summary.NetBalance,
            summary.AverageExpense,
            summary.MedianExpense,
            summary.TransactionCount);
    }

    public IReadOnlyList<MonthlySummary> BuildMonthlySummaries(
        int startYear,
        int startMonth,
        int endYear,
        int endMonth,
        IEnumerable<Transaction> transactions)
    {
        var transactionsByMonth = transactions
            .GroupBy(transaction => new { transaction.Date.Year, transaction.Date.Month })
            .ToDictionary(group => (group.Key.Year, group.Key.Month), group => group.ToList());

        return EnumerateMonths(startYear, startMonth, endYear, endMonth)
            .Select(monthRef =>
            {
                transactionsByMonth.TryGetValue((monthRef.Year, monthRef.Month), out var monthlyTransactions);

                return BuildMonthlySummary(
                    monthRef.Year,
                    monthRef.Month,
                    monthlyTransactions ?? []);
            })
            .ToList();
    }

    private StatisticsSummary BuildSummary(IReadOnlyCollection<Transaction> transactions)
    {
        var incomes = transactions.Where(transaction => transaction.Amount > 0).ToList();
        var expenses = transactions.Where(transaction => transaction.Amount < 0).ToList();

        return new StatisticsSummary(
            _financeAggregationService.CalculateTotal(incomes),
            _financeAggregationService.CalculateTotal(expenses),
            _financeAggregationService.CalculateTotal(transactions),
            _financeAggregationService.CalculateAverage(expenses),
            _financeAggregationService.CalculateMedian(expenses),
            transactions.Count);
    }

    private IReadOnlyList<StatisticsTrendPoint> BuildMonthlyTrend(
        IReadOnlyCollection<Transaction> transactions,
        DateTime startDate,
        DateTime endDate)
    {
        var transactionsByMonth = transactions
            .GroupBy(transaction => new { transaction.Date.Year, transaction.Date.Month })
            .ToDictionary(group => (group.Key.Year, group.Key.Month), group => group.ToList());
        var points = new List<StatisticsTrendPoint>();

        for (var month = StartOfMonth(startDate); month <= endDate; month = month.AddMonths(1))
        {
            transactionsByMonth.TryGetValue((month.Year, month.Month), out var monthlyTransactions);
            var summary = BuildSummary(monthlyTransactions ?? []);
            points.Add(ToTrendPoint(month.Year, month.Month, summary));
        }

        return points;
    }

    private IReadOnlyList<StatisticsTrendPoint> BuildYearlyTrend(
        IReadOnlyCollection<Transaction> transactions)
    {
        if (transactions.Count == 0)
        {
            return [];
        }

        var transactionsByYear = transactions
            .GroupBy(transaction => transaction.Date.Year)
            .ToDictionary(group => group.Key, group => group.ToList());
        var firstYear = transactions.Min(transaction => transaction.Date.Year);
        var lastYear = transactions.Max(transaction => transaction.Date.Year);
        var points = new List<StatisticsTrendPoint>();

        for (var year = firstYear; year <= lastYear; year++)
        {
            transactionsByYear.TryGetValue(year, out var yearlyTransactions);
            points.Add(ToTrendPoint(year, null, BuildSummary(yearlyTransactions ?? [])));
        }

        return points;
    }

    private static StatisticsTrendPoint ToTrendPoint(
        int year,
        int? month,
        StatisticsSummary summary) =>
        new(
            year,
            month,
            summary.TotalIncome,
            summary.TotalExpense,
            summary.NetBalance,
            summary.TransactionCount);

    public IReadOnlyList<StatisticsCategorySummary> BuildCategorySummaries(
        IReadOnlyCollection<Transaction> transactions)
    {
        var expenses = transactions.Where(transaction => transaction.Amount < 0).ToList();
        var totalExpense = Math.Abs(_financeAggregationService.CalculateTotal(expenses));

        return expenses
            .GroupBy(transaction =>
                string.IsNullOrWhiteSpace(transaction.Category)
                    ? "Uncategorized"
                    : transaction.Category)
            .Select(group =>
            {
                var categoryTotal = Math.Abs(_financeAggregationService.CalculateTotal(group));

                return new StatisticsCategorySummary(
                    group.Key,
                    categoryTotal,
                    totalExpense > 0 ? categoryTotal / totalExpense * 100 : 0,
                    group.Count());
            })
            .OrderByDescending(summary => summary.TotalExpense)
            .ThenBy(summary => summary.Category)
            .ToList();
    }

    public IReadOnlyList<StatisticsTopExpense> BuildTopExpenses(
        IReadOnlyCollection<Transaction> transactions,
        int limit) =>
        transactions
            .Where(transaction => transaction.Amount < 0)
            .OrderBy(transaction => transaction.Amount)
            .ThenByDescending(transaction => transaction.Date)
            .Take(limit)
            .Select(transaction => new StatisticsTopExpense(
                transaction.Id,
                transaction.Date,
                Math.Abs(transaction.Amount),
                transaction.Category,
                transaction.Metadata.RawDescription?.Trim() ?? "No description"))
            .ToList();

    public IReadOnlyList<StatisticsRecurringExpense> BuildRecurringExpenses(
        IReadOnlyCollection<Transaction> transactions,
        int limit) =>
        transactions
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
                    Candidate = new StatisticsRecurringExpense(
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

    private static List<Transaction> FilterByDateRange(
        IEnumerable<Transaction> transactions,
        DateTime startDate,
        DateTime endDate) =>
        transactions
            .Where(transaction => transaction.Date >= startDate && transaction.Date <= endDate)
            .ToList();

    private static DateTime StartOfMonth(DateTime date) =>
        new(date.Year, date.Month, 1, 0, 0, 0, DateTimeKind.Utc);

    private static DateTime EndOfMonth(DateTime date) =>
        StartOfMonth(date).AddMonths(1).AddTicks(-1);

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

    private static string NormalizeDescription(string? description)
    {
        if (string.IsNullOrWhiteSpace(description))
        {
            return string.Empty;
        }

        return WhitespaceRegex().Replace(description.Trim(), " ").ToLowerInvariant();
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRegex();
}
