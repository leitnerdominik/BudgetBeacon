using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using PTSManagerYC.Core.Models;

namespace PTSManagerYC.Core.Entities
{
    public class Transaction
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string? UserId { get; set; }
        public DateTime Date { get; set; }
        public decimal Amount { get; set; }
        public string Category { get; set; } = "Uncategorized";
        public string? Notes { get; set; }
        public string? ImportFingerprint { get; set; }

        public TransactionMetadata Metadata { get; set; } = new();

        public void ApplyUpdate(TransactionUpdate update)
        {
            var shouldResetAiMetadata =
                !string.Equals(Category, update.Category, StringComparison.Ordinal) ||
                !string.Equals(Metadata.RawDescription, update.Description, StringComparison.Ordinal);

            Date = update.Date;
            Amount = update.Amount;
            Category = update.Category;
            Notes = update.Notes;
            Metadata.RawDescription = update.Description;

            if (shouldResetAiMetadata)
            {
                Metadata.AiSuggestedCategory = null;
                Metadata.AiConfidenceScore = null;
            }
        }
    }
}
