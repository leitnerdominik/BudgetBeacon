using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using BudgetBeacon.Core.Models;

namespace BudgetBeacon.Core.Entities
{
    public class Transaction
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string? UserId { get; set; }
        public DateTime Date { get; set; }
        public decimal Amount { get; set; }
        public string Category { get; set; } = "Uncategorized";
        public string Treatment { get; set; } = string.Empty;
        public SpendingFlexibilityOverride? ManualSpendingFlexibility { get; set; }
        public SpendingFlexibilityOverride? AiSpendingFlexibility { get; set; }
        public double? FlexibilityConfidence { get; set; }
        public string? Notes { get; set; }
        public string? ImportFingerprint { get; set; }

        public TransactionMetadata Metadata { get; set; } = new();

        public string EffectiveTreatment => TransactionTreatment.GetEffective(Treatment, Amount, Category);

        public bool MatchesCategorizationBasis(Transaction original) =>
            Category == original.Category &&
            Metadata.RawDescription == original.Metadata.RawDescription &&
            Amount == original.Amount &&
            EffectiveTreatment == original.EffectiveTreatment &&
            ManualSpendingFlexibility == original.ManualSpendingFlexibility;

        public void ApplyUpdate(TransactionUpdate update)
        {
            var shouldResetAiMetadata =
                !string.Equals(Category, update.Category, StringComparison.Ordinal) ||
                !string.Equals(Metadata.RawDescription, update.Description, StringComparison.Ordinal);
            var originalTreatment = EffectiveTreatment;
            var originalAmount = Amount;

            Date = update.Date;
            Amount = update.Amount;
            Category = update.Category;
            Treatment = update.Treatment;
            Notes = update.Notes;
            Metadata.RawDescription = update.Description;

            if (update.SpendingFlexibilityOverride is { } flexibility)
            {
                ManualSpendingFlexibility = flexibility.Value;
            }

            if (shouldResetAiMetadata)
            {
                Metadata.AiSuggestedCategory = null;
                Metadata.AiConfidenceScore = null;
            }

            if (shouldResetAiMetadata || originalAmount != Amount || originalTreatment != EffectiveTreatment)
            {
                ClearAiFlexibility();
            }
        }

        public void ApplyCategoryUpdate(string category)
        {
            var treatment = TransactionTreatment.GetDefault(Amount, category);
            if (Category != category || EffectiveTreatment != treatment)
            {
                ClearAiFlexibility();
            }

            Category = category;
            Treatment = treatment;
            Metadata.AiSuggestedCategory = null;
            Metadata.AiConfidenceScore = null;
        }

        public void ApplyCategorization(TransactionCategorization suggestion)
        {
            Category = suggestion.Category;
            Treatment = TransactionTreatment.GetDefault(Amount, Category);
            Metadata.AiSuggestedCategory = Category;
            Metadata.AiConfidenceScore = suggestion.Confidence;

            var flexibility = Treatment == TransactionTreatment.Expense ? suggestion.Flexibility : null;
            AiSpendingFlexibility = flexibility?.Value;
            FlexibilityConfidence = flexibility?.Confidence;
        }

        private void ClearAiFlexibility()
        {
            AiSpendingFlexibility = null;
            FlexibilityConfidence = null;
        }
    }
}
