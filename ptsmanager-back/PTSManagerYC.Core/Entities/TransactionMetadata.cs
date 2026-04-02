using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace PTSManagerYC.Core.Entities
{
    public class TransactionMetadata
    {
        public string RawDescription { get; set; } = string.Empty;
        public double? AiConfidenceScore { get; set; }
        public string? AiSuggestedCategory { get; set; }
    }
}
