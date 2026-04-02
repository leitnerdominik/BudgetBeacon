using PTSManagerYC.Core.Entities;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace PTSManagerYC.Core.Interfaces
{
    public interface ICsvReaderService
    {
        IEnumerable<Transaction> ParseTransactions(Stream fileStream);
    }
}
