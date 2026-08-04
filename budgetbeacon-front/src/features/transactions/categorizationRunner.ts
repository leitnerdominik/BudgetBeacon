import type {
  CategorizationCandidatesResponse,
  CategorizeTransactionsBatchResponse,
} from "../../api/transactionsApi";

export const categorizationBatchSize = 10;

export type CategorizationRunOutcome = "completed" | "partial" | "failed";

export interface CategorizationProgress {
  totalCount: number;
  completedCount: number;
  processedCount: number;
  changedCount: number;
  failedCount: number;
  skippedCount: number;
  remainingCount: number;
}

export interface CategorizationRunResult extends CategorizationProgress {
  outcome: CategorizationRunOutcome;
  message: string;
  errorMessage?: string;
}

interface CategorizationRunnerDependencies {
  getCandidates: (signal: AbortSignal) => Promise<CategorizationCandidatesResponse>;
  categorizeBatch: (
    transactionIds: string[],
    signal: AbortSignal,
  ) => Promise<CategorizeTransactionsBatchResponse>;
  onProgress?: (progress: CategorizationProgress) => void;
}

type BatchFailure = Error & {
  batchResult: CategorizeTransactionsBatchResponse;
};

export const emptyCategorizationProgress: CategorizationProgress = {
  totalCount: 0,
  completedCount: 0,
  processedCount: 0,
  changedCount: 0,
  failedCount: 0,
  skippedCount: 0,
  remainingCount: 0,
};

const isBatchFailure = (error: unknown): error is BatchFailure =>
  error instanceof Error &&
  "batchResult" in error &&
  typeof error.batchResult === "object" &&
  error.batchResult !== null;

const getErrorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Transactions could not be categorized.";

const buildResult = (
  progress: CategorizationProgress,
  errorMessage?: string,
): CategorizationRunResult => {
  const outcome: CategorizationRunOutcome = errorMessage
    ? progress.changedCount > 0
      ? "partial"
      : "failed"
    : progress.failedCount > 0
      ? progress.changedCount > 0
        ? "partial"
        : "failed"
      : "completed";

  const message =
    outcome === "partial"
      ? errorMessage
        ? `${progress.changedCount} transaction(s) categorized before processing stopped; ${progress.remainingCount} remain uncategorized.`
        : `${progress.changedCount} transaction(s) categorized; ${progress.failedCount} could not be categorized.`
      : outcome === "failed"
        ? errorMessage ?? "No transactions could be categorized."
        : progress.changedCount > 0
          ? `${progress.changedCount} uncategorized transaction(s) categorized.`
          : "All transactions are already categorized.";

  return {
    ...progress,
    outcome,
    message,
    ...(errorMessage ? { errorMessage } : {}),
  };
};

export const runTransactionCategorization = async (
  dependencies: CategorizationRunnerDependencies,
  signal: AbortSignal,
): Promise<CategorizationRunResult> => {
  signal.throwIfAborted();
  const candidates = await dependencies.getCandidates(signal);
  signal.throwIfAborted();

  let progress: CategorizationProgress = {
    ...emptyCategorizationProgress,
    totalCount: candidates.transactionIds.length,
    remainingCount: candidates.transactionIds.length,
  };
  dependencies.onProgress?.({ ...progress });

  const refreshCandidates = async (): Promise<string[] | null> => {
    try {
      const refreshedCandidates = await dependencies.getCandidates(signal);
      progress = {
        ...progress,
        remainingCount: refreshedCandidates.transactionIds.length,
      };
      dependencies.onProgress?.({ ...progress });
      return refreshedCandidates.transactionIds;
    } catch (error) {
      if (signal.aborted) {
        throw error;
      }

      return null;
    }
  };

  for (
    let index = 0;
    index < candidates.transactionIds.length;
    index += categorizationBatchSize
  ) {
    signal.throwIfAborted();
    const transactionIds = candidates.transactionIds.slice(
      index,
      index + categorizationBatchSize,
    );

    try {
      const batchResult = await dependencies.categorizeBatch(transactionIds, signal);
      progress = {
        ...progress,
        completedCount: progress.completedCount + transactionIds.length,
        processedCount: progress.processedCount + batchResult.processedCount,
        changedCount: progress.changedCount + batchResult.changedCount,
        failedCount: progress.failedCount + batchResult.failedCount,
        skippedCount: progress.skippedCount + batchResult.skippedCount,
        remainingCount: batchResult.remainingCount,
      };
      dependencies.onProgress?.({ ...progress });
    } catch (error) {
      if (signal.aborted) {
        throw error;
      }

      const batchFailure = isBatchFailure(error);
      if (batchFailure) {
        progress = {
          ...progress,
          completedCount: progress.completedCount + transactionIds.length,
          processedCount: progress.processedCount + error.batchResult.processedCount,
          changedCount: progress.changedCount + error.batchResult.changedCount,
          failedCount: progress.failedCount + error.batchResult.failedCount,
          skippedCount: progress.skippedCount + error.batchResult.skippedCount,
          remainingCount: error.batchResult.remainingCount,
        };
        dependencies.onProgress?.({ ...progress });
      }

      const refreshedTransactionIds = await refreshCandidates();
      if (!batchFailure && refreshedTransactionIds) {
        const remainingTransactionIds = new Set(refreshedTransactionIds);
        const recoveredChangedCount = transactionIds.filter(
          (transactionId) => !remainingTransactionIds.has(transactionId),
        ).length;

        if (recoveredChangedCount > 0) {
          progress = {
            ...progress,
            completedCount: progress.completedCount + transactionIds.length,
            processedCount: progress.processedCount + recoveredChangedCount,
            changedCount: progress.changedCount + recoveredChangedCount,
          };
          dependencies.onProgress?.({ ...progress });
        }
      }

      return buildResult(progress, getErrorMessage(error));
    }
  }

  return buildResult(progress);
};
