import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText,
  DialogTitle, LinearProgress, Stack, Typography,
} from "@mui/material";
import {
  getSpendingFlexibilityReviewCandidates,
  reviewSpendingFlexibilityBatch,
} from "../../../api/transactionsApi";
import {
  emptySpendingFlexibilityReviewProgress,
  runSpendingFlexibilityReview,
} from "../spendingFlexibilityReviewRunner";

export const SpendingFlexibilityReviewButton = ({ isOnline }: { isOnline: boolean }) => {
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  const [open, setOpen] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [progress, setProgress] = useState(emptySpendingFlexibilityReviewProgress);

  useEffect(() => () => abortRef.current?.abort(), []);

  const review = useMutation({
    networkMode: "always",
    mutationFn: async (controller: AbortController) => {
      try {
        return await runSpendingFlexibilityReview({
          getCandidates: getSpendingFlexibilityReviewCandidates,
          reviewBatch: reviewSpendingFlexibilityBatch,
          onProgress: setProgress,
        }, controller.signal);
      } finally {
        abortRef.current = null;
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  const start = () => {
    if (abortRef.current || review.isPending || !isOnline)
      return;

    const controller = new AbortController();
    abortRef.current = controller;
    setStopping(false);
    setProgress(emptySpendingFlexibilityReviewProgress);
    review.mutate(controller);
  };

  const close = () => {
    if (review.isPending)
      return;

    setOpen(false);
    review.reset();
    setProgress(emptySpendingFlexibilityReviewProgress);
  };

  const stop = () => {
    setStopping(true);
    abortRef.current?.abort();
  };

  const outcome = review.data;
  const isComplete = outcome?.status === "completed";
  const canRetry = outcome?.status === "cancelled" || outcome?.status === "stopped" || progress.failedCount > 0;

  return (
    <>
      <Button variant="outlined" onClick={() => setOpen(true)} disabled={!isOnline}>
        Review spending flexibility
      </Button>
      <Dialog open={open} onClose={close} fullWidth maxWidth="sm" aria-labelledby="flexibility-review-title">
        <DialogTitle id="flexibility-review-title">Review spending flexibility</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <DialogContentText>
              Use AI to check categorized expenses across all dates that still need a flexibility rating.
            </DialogContentText>
            {(review.isPending || progress.totalCount > 0) && (
              <>
                <Typography variant="body2" role="status">
                  {review.isPending && stopping ? "Stopping review…" : progress.totalCount === 0
                    ? "Checking for eligible expenses…"
                    : `${progress.completedCount} of ${progress.totalCount} handled`}
                </Typography>
                {review.isPending && (
                  <LinearProgress
                    aria-label="Spending flexibility review progress"
                    variant={progress.totalCount > 0 ? "determinate" : "indeterminate"}
                    value={progress.totalCount > 0 ? progress.completedCount * 100 / progress.totalCount : undefined}
                  />
                )}
              </>
            )}
            {isComplete && progress.totalCount === 0 && (
              <Alert severity="info">No categorized expenses need a review.</Alert>
            )}
            {isComplete && progress.totalCount > 0 && (
              <Alert severity={progress.failedCount > 0 ? "warning" : "success"}>
                {progress.failedCount > 0 ? "Review completed with errors. You can retry the failed expenses." : "Review completed."}
              </Alert>
            )}
            {outcome?.status === "cancelled" && (
              <Alert severity="info">Review stopped. Completed results are saved.</Alert>
            )}
            {outcome?.status === "stopped" && <Alert severity="warning">{outcome.message}</Alert>}
            {progress.totalCount > 0 && (
              <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
                <Chip label={`${progress.classifiedCount} classified`} />
                <Chip label={`${progress.unclassifiedCount} checked and left unclassified`} />
                <Chip label={`${progress.failedCount} failed`} />
                {progress.skippedCount > 0 && <Chip label={`${progress.skippedCount} skipped`} />}
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          {review.isPending ? (
            <Button onClick={stop} disabled={stopping}>Stop review</Button>
          ) : (
            <Button onClick={close}>Close</Button>
          )}
          {!review.isPending && (!outcome || canRetry) && (
            <Button variant="contained" onClick={start} disabled={!isOnline}>
              {canRetry ? "Run again" : "Start review"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};
