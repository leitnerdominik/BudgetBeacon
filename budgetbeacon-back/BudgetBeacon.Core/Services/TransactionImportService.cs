using BudgetBeacon.Core.Entities;
using BudgetBeacon.Core.Exceptions;
using BudgetBeacon.Core.Interfaces;
using BudgetBeacon.Core.Models;

namespace BudgetBeacon.Core.Services;

public sealed class TransactionImportService
{
    private readonly ITransactionRepository _transactionRepository;
    private readonly IUserPreferencesRepository _userPreferencesRepository;
    private readonly TransactionImportDescriptionRedactionService _descriptionRedactionService;

    public TransactionImportService(
        ITransactionRepository transactionRepository,
        IUserPreferencesRepository userPreferencesRepository,
        TransactionImportDescriptionRedactionService descriptionRedactionService)
    {
        _transactionRepository = transactionRepository;
        _userPreferencesRepository = userPreferencesRepository;
        _descriptionRedactionService = descriptionRedactionService;
    }

    public async Task<TransactionImportPreviewResult> PreviewAsync(
        string userId,
        IEnumerable<Transaction> parsedTransactions)
    {
        var preparedTransactions = await PrepareAsync(userId, parsedTransactions);
        var fingerprints = preparedTransactions
            .Select(item => item.Transaction.ImportFingerprint!)
            .Distinct(StringComparer.Ordinal)
            .ToList();
        var existingFingerprints = await _transactionRepository
            .GetExistingImportFingerprintsAsync(userId, fingerprints);
        var seenFileFingerprints = new HashSet<string>(StringComparer.Ordinal);
        var previewItems = new List<TransactionImportPreviewItem>(preparedTransactions.Count);
        var existingDuplicates = 0;
        var fileDuplicates = 0;

        foreach (var preparedTransaction in preparedTransactions)
        {
            var fingerprint = preparedTransaction.Transaction.ImportFingerprint!;
            TransactionImportDuplicateReason? duplicateReason = null;

            if (existingFingerprints.Contains(fingerprint))
            {
                duplicateReason = TransactionImportDuplicateReason.ExistingDuplicate;
                existingDuplicates++;
            }
            else if (!seenFileFingerprints.Add(fingerprint))
            {
                duplicateReason = TransactionImportDuplicateReason.FileDuplicate;
                fileDuplicates++;
            }

            previewItems.Add(new TransactionImportPreviewItem(
                preparedTransaction.Transaction,
                preparedTransaction.DescriptionRedacted,
                duplicateReason));
        }

        return new TransactionImportPreviewResult(
            previewItems.Count,
            previewItems.Count - existingDuplicates - fileDuplicates,
            existingDuplicates,
            fileDuplicates,
            previewItems.Count(item => item.DescriptionRedacted),
            previewItems);
    }

    public async Task<TransactionImportResult> ImportAsync(
        string userId,
        IEnumerable<Transaction> parsedTransactions)
    {
        var preparedTransactions = await PrepareAsync(userId, parsedTransactions);
        var importedCount = await _transactionRepository.AddImportedTransactionsAsync(
            preparedTransactions.Select(item => item.Transaction));

        return new TransactionImportResult(
            preparedTransactions.Count,
            importedCount,
            preparedTransactions.Count - importedCount,
            preparedTransactions.Count(item => item.DescriptionRedacted));
    }

    private async Task<List<PreparedTransaction>> PrepareAsync(
        string userId,
        IEnumerable<Transaction> parsedTransactions)
    {
        var preferences = await _userPreferencesRepository.GetAsync(userId);
        var importBlacklistRules = preferences?.TransactionImportBlacklistRules ?? [];
        var preparedTransactions = new List<PreparedTransaction>();

        foreach (var transaction in parsedTransactions)
        {
            if (preparedTransactions.Count >= TransactionImportLimits.MaxRowCount)
            {
                throw new InvalidInputException(
                    TransactionImportLimits.RowLimitExceededMessage);
            }

            var financialValueValidation = FinancialValueValidator.Validate(
                transaction.Amount,
                transaction.Date);

            if (!financialValueValidation.IsValid)
            {
                var validationErrors = financialValueValidation.DateErrors
                    .Concat(financialValueValidation.AmountErrors);
                throw new InvalidInputException(
                    $"Import row {preparedTransactions.Count + 1} is invalid: " +
                    string.Join(" ", validationErrors));
            }

            var redactionResult = _descriptionRedactionService.Redact(
                transaction.Metadata.RawDescription,
                importBlacklistRules);

            transaction.Metadata.RawDescription = redactionResult.Description;
            transaction.UserId = userId;
            transaction.ImportFingerprint = TransactionImportFingerprint.Create(transaction);
            transaction.Treatment = TransactionTreatment.GetDefault(
                transaction.Amount,
                transaction.Category);

            preparedTransactions.Add(new PreparedTransaction(
                transaction,
                redactionResult.WasRedacted));
        }

        return preparedTransactions;
    }

    private sealed record PreparedTransaction(
        Transaction Transaction,
        bool DescriptionRedacted);
}
