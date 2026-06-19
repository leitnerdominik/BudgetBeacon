using BudgetBeacon.Core.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BudgetBeacon.Core.Services
{
    public class FinanceAggregationService
    {
        public decimal CalculateTotal(IEnumerable<Transaction> transactions) => transactions.Sum(t => t.Amount);

        public decimal CalculateAverage(IEnumerable<Transaction> transactions)
        {
            if (!transactions.Any()) 
                return 0;
            return transactions.Average(t => t.Amount);
        }

        public decimal CalculateMedian(IEnumerable<Transaction> transactions)
        {
            List<decimal> sortedAmounts = transactions.Select(t => t.Amount).OrderBy(a => a).ToList();
            int count = sortedAmounts.Count;

            if (count == 0)
                return 0;

            int midIndex = count / 2;

            // Wenn ungerade, nimm das mittlere Element. Wenn gerade, nimm den Durchschnitt der beiden mittleren.
            if (count % 2 != 0)
            {
                return sortedAmounts[midIndex];
            }
            else
            {
                return (sortedAmounts[midIndex - 1] + sortedAmounts[midIndex]) / 2m;
            }
        }
    }
}
