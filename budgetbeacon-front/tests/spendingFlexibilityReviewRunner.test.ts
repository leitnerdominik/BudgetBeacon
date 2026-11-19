import assert from "node:assert/strict";
import test from "node:test";
import {
  runSpendingFlexibilityReview,
  type SpendingFlexibilityReviewProgress,
} from "../src/features/transactions/spendingFlexibilityReviewRunner.ts";

test("processes sequential batches, counting classifications, abstentions, errors and skipped expenses", async () => {
  const candidates = Array.from({ length: 12 }, (_, index) => String(index));
  const signal = new AbortController().signal;
  const progress: SpendingFlexibilityReviewProgress[] = [];
  const batches: string[][] = [];

  const result = await runSpendingFlexibilityReview({
    getCandidates: async () => ({ transactionIds: candidates }),
    reviewBatch: async (ids, batchSignal) => {
      assert.equal(batchSignal, signal);
      batches.push(ids);
      return batches.length === 1
        ? { classifiedCount: 6, unclassifiedCount: 2, failedCount: 1, skippedCount: 1 }
        : { classifiedCount: 0, unclassifiedCount: 2, failedCount: 0, skippedCount: 0 };
    },
    onProgress: (next) => progress.push(next),
  }, signal);

  assert.deepEqual(result, { status: "completed" });
  assert.deepEqual(batches, [candidates.slice(0, 10), candidates.slice(10)]);
  assert.deepEqual(progress.at(-1), {
    totalCount: 12, completedCount: 12,
    classifiedCount: 6, unclassifiedCount: 4, failedCount: 1, skippedCount: 1,
  });
});

test("does not send a batch on an empty repeat run", async () => {
  const result = await runSpendingFlexibilityReview({
    getCandidates: async () => ({ transactionIds: [] }),
    reviewBatch: async () => assert.fail("empty runs must not call the batch endpoint"),
    onProgress: () => {},
  }, new AbortController().signal);

  assert.deepEqual(result, { status: "completed" });
});

test("stops after a failed batch and retains confirmed results", async () => {
  const progress: SpendingFlexibilityReviewProgress[] = [];
  let calls = 0;
  const result = await runSpendingFlexibilityReview({
    getCandidates: async () => ({ transactionIds: Array.from({ length: 26 }, (_, index) => String(index)) }),
    reviewBatch: async () => {
      calls++;
      return calls === 1
        ? { classifiedCount: 0, unclassifiedCount: 10, failedCount: 0, skippedCount: 0 }
        : { classifiedCount: 0, unclassifiedCount: 0, failedCount: 10, skippedCount: 0 };
    },
    onProgress: (next) => progress.push(next),
  }, new AbortController().signal);

  assert.equal(result.status, "stopped");
  assert.equal(calls, 2);
  assert.equal(progress.at(-1)?.unclassifiedCount, 10);
  assert.equal(progress.at(-1)?.failedCount, 10);
  assert.equal(progress.at(-1)?.completedCount, 20);
});

test("cancels an active request, keeps previous confirmations and sends no further batches", async () => {
  const controller = new AbortController();
  let calls = 0;
  const progress: SpendingFlexibilityReviewProgress[] = [];
  const result = await runSpendingFlexibilityReview({
    getCandidates: async () => ({ transactionIds: Array.from({ length: 21 }, (_, index) => String(index)) }),
    reviewBatch: async (_, signal) => {
      if (calls++ === 0)
        return { classifiedCount: 10, unclassifiedCount: 0, failedCount: 0, skippedCount: 0 };

      controller.abort();
      signal.throwIfAborted();
      throw new Error("Expected cancellation");
    },
    onProgress: (next) => progress.push(next),
  }, controller.signal);

  assert.deepEqual(result, { status: "cancelled" });
  assert.equal(calls, 2);
  assert.equal(progress.at(-1)?.classifiedCount, 10);
  assert.equal(progress.at(-1)?.completedCount, 10);
});
