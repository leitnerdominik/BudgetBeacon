import { useMutation, useQueryClient } from "@tanstack/react-query";
import { uploadCsv } from "../../api/transactionsApi";
import { useNotification } from "../../components/NotificationProvider";

export const useUploadCsv = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();

  return useMutation({
    mutationFn: (file: File) => uploadCsv(file),
    onSuccess: (data) => {
      // Magic happens here: Invalidate the transactions cache.
      // This tells React Query to immediately refetch any active queries
      // that start with the ['transactions'] key.
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["tips"] });
      showNotification({
        severity: "success",
        message: `${data.imported} transaction(s) imported, ${data.duplicatesSkipped} duplicate(s) skipped.`,
      });
    },
    onError: (error) => {
      console.error("Failed to upload CSV:", error);
      showNotification({
        severity: "error",
        message:
          error instanceof Error ? error.message : "Failed to upload CSV.",
      });
    },
  });
};
