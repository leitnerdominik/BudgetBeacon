import assert from "node:assert/strict";
import test from "node:test";

import {
  runTransactionCategorization,
  type CategorizationProgress,
} from "../src/features/transactions/categorizationRunner.ts";
import type { CategorizeTransactionsBatchResponse } from "../src/api/transactionsApi.ts";

const buildBatchResult = (
  requestedCount: number,
  changedCount = requestedCount,
  failedCount = 0,
  skippedCount = 0,
  remainingCount = 0,
): CategorizeTransactionsBatchResponse => ({
  message: "Categorization successful.",
  requestedCount,
  processedCount: changedCount + failedCount,
  changedCount,
  failedCount,
  skippedCount,
  remainingCount,
  categorizedCount: changedCount,
});

test("categorizes 25 candidates sequentially in batches of 10, 10, and 5", async () => {
  const transactionIds = Array.from({ length: 25 }, (_, index) => `id-${index}`);
  const batches: string[][] = [];
  const progressUpdates: CategorizationProgress[] = [];

  const result = await runTransactionCategorization(
    {
      getCandidates: async () => ({ transactionIds }),
      categorizeBatch: async (batch) => {
        batches.push(batch);
        return buildBatchResult(batch.length, batch.length, 0, 0, 25 - batches.flat().length);
      },
      onProgress: (progress) => progressUpdates.push(progress),
    },
    new AbortController().signal,
  );

  assert.deepEqual(batches.map((batch) => batch.length), [10, 10, 5]);
  assert.equal(result.outcome, "completed");
  assert.equal(result.completedCount, 25);
  assert.equal(result.changedCount, 25);
  assert.equal(result.remainingCount, 0);
  assert.deepEqual(
    progressUpdates.map((progress) => progress.completedCount),
    [0, 10, 20, 25],
  );
});

test("returns a completed no-op without sending a categorization batch", async () => {
  let categorizeCalls = 0;

  const result = await runTransactionCategorization(
    {
      getCandidates: async () => ({ transactionIds: [] }),
      categorizeBatch: async () => {
        categorizeCalls += 1;
        return buildBatchResult(0);
      },
    },
    new AbortController().signal,
  );

  assert.equal(categorizeCalls, 0);
  assert.equal(result.outcome, "completed");
  assert.equal(result.totalCount, 0);
});

test("continues after a partial batch result and aggregates failed and skipped counts", async () => {
  const transactionIds = Array.from({ length: 12 }, (_, index) => `id-${index}`);
  let categorizeCalls = 0;

  const result = await runTransactionCategorization(
    {
      getCandidates: async () => ({ transactionIds }),
      categorizeBatch: async (batch) => {
        categorizeCalls += 1;
        return categorizeCalls === 1
          ? buildBatchResult(batch.length, 7, 2, 1, 4)
          : buildBatchResult(batch.length, 2, 0, 0, 2);
      },
    },
    new AbortController().signal,
  );

  assert.equal(categorizeCalls, 2);
  assert.equal(result.outcome, "partial");
  assert.equal(result.changedCount, 9);
  assert.equal(result.failedCount, 2);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.remainingCount, 2);
});

test("stops after a provider batch failure and preserves completed batch progress", async () => {
  const initialIds = Array.from({ length: 25 }, (_, index) => `id-${index}`);
  let candidateCalls = 0;
  let categorizeCalls = 0;

  const result = await runTransactionCategorization(
    {
      getCandidates: async () => {
        candidateCalls += 1;
        return {
          transactionIds:
            candidateCalls === 1 ? initialIds : initialIds.slice(10),
        };
      },
      categorizeBatch: async (batch) => {
        categorizeCalls += 1;
        if (categorizeCalls === 1) {
          return buildBatchResult(batch.length, 10, 0, 0, 15);
        }

        throw Object.assign(new Error("The AI provider is unavailable."), {
          batchResult: buildBatchResult(batch.length, 0, 10, 0, 15),
        });
      },
    },
    new AbortController().signal,
  );

  assert.equal(categorizeCalls, 2);
  assert.equal(candidateCalls, 2);
  assert.equal(result.outcome, "partial");
  assert.equal(result.completedCount, 20);
  assert.equal(result.changedCount, 10);
  assert.equal(result.failedCount, 10);
  assert.equal(result.remainingCount, 15);
});

test("reconciles a saved batch when the response is lost", async () => {
  const initialIds = Array.from({ length: 15 }, (_, index) => `id-${index}`);
  let candidateCalls = 0;
  let categorizeCalls = 0;

  const result = await runTransactionCategorization(
    {
      getCandidates: async () => {
        candidateCalls += 1;
        return {
          transactionIds:
            candidateCalls === 1 ? initialIds : initialIds.slice(10),
        };
      },
      categorizeBatch: async () => {
        categorizeCalls += 1;
        throw new Error("Gateway timeout");
      },
    },
    new AbortController().signal,
  );

  assert.equal(categorizeCalls, 1);
  assert.equal(result.outcome, "partial");
  assert.equal(result.completedCount, 10);
  assert.equal(result.changedCount, 10);
  assert.equal(result.remainingCount, 5);
  assert.match(result.message, /before processing stopped/);
});

test("aborts the active batch and does not start another one", async () => {
  const abortController = new AbortController();
  let categorizeCalls = 0;

  const run = runTransactionCategorization(
    {
      getCandidates: async () => ({ transactionIds: ["id-1", "id-2"] }),
      categorizeBatch: async (_batch, signal) => {
        categorizeCalls += 1;
        return new Promise((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        });
      },
    },
    abortController.signal,
  );

  await Promise.resolve();
  abortController.abort();

  await assert.rejects(run, { name: "AbortError" });
  assert.equal(categorizeCalls, 1);
});
