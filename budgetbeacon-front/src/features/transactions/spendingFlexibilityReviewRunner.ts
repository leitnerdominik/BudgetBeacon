import type {
  CategorizationCandidatesResponse,
  SpendingFlexibilityReviewBatchResponse,
} from "../../api/transactionsApi";
import { categorizationBatchSize } from "./categorizationRunner.ts";

export interface SpendingFlexibilityReviewProgress extends SpendingFlexibilityReviewBatchResponse {
  totalCount: number;
  completedCount: number;
}

interface ReviewDependencies {
  getCandidates: (signal: AbortSignal) => Promise<CategorizationCandidatesResponse>;
  reviewBatch: (ids: string[], signal: AbortSignal) => Promise<SpendingFlexibilityReviewBatchResponse>;
  onProgress: (progress: SpendingFlexibilityReviewProgress) => void;
}

export const emptySpendingFlexibilityReviewProgress: SpendingFlexibilityReviewProgress = {
  totalCount: 0,
  completedCount: 0,
  classifiedCount: 0,
  unclassifiedCount: 0,
  failedCount: 0,
  skippedCount: 0,
};

export type SpendingFlexibilityReviewOutcome =
  | { status: "completed" | "cancelled" }
  | { status: "stopped"; message: string };

export const runSpendingFlexibilityReview = async (
  dependencies: ReviewDependencies,
  signal: AbortSignal,
): Promise<SpendingFlexibilityReviewOutcome> => {
  try {
    signal.throwIfAborted();
    const { transactionIds } = await dependencies.getCandidates(signal);
    signal.throwIfAborted();
    let progress = {
      ...emptySpendingFlexibilityReviewProgress,
      totalCount: transactionIds.length,
    };
    dependencies.onProgress(progress);

    for (let index = 0; index < transactionIds.length; index += categorizationBatchSize) {
      signal.throwIfAborted();
      const ids = transactionIds.slice(index, index + categorizationBatchSize);
      const batch = await dependencies.reviewBatch(ids, signal);
      progress = {
        totalCount: progress.totalCount,
        completedCount: progress.completedCount + ids.length,
        classifiedCount: progress.classifiedCount + batch.classifiedCount,
        unclassifiedCount: progress.unclassifiedCount + batch.unclassifiedCount,
        failedCount: progress.failedCount + batch.failedCount,
        skippedCount: progress.skippedCount + batch.skippedCount,
      };
      dependencies.onProgress(progress);
      signal.throwIfAborted();

      if (batch.failedCount > 0 && batch.classifiedCount + batch.unclassifiedCount === 0) {
        return { status: "stopped", message: "AI returned no usable results for this batch. You can run the review again." };
      }
    }

    return { status: "completed" };
  } catch (error) {
    return signal.aborted
      ? { status: "cancelled" }
      : {
        status: "stopped",
        message: error instanceof Error ? error.message : "The flexibility review could not continue.",
      };
  }
};
