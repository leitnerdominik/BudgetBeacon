import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  uploadTransactions,
  type TransactionImportMappingRequest,
} from "../../../api/transactionsApi";
import { useNotification } from "../../../components/NotificationProvider";

type UploadTransactionsInput = {
  file: File;
  delimiter: string;
  mapping?: TransactionImportMappingRequest;
};

export const useUploadTransactions = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();

  return useMutation({
    mutationFn: ({ file, delimiter, mapping }: UploadTransactionsInput) =>
      uploadTransactions(file, delimiter, mapping),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["tips"] });
      const redactionMessage =
        data.redactedTransactions > 0
          ? ` ${data.redactedTransactions} transaction description(s) redacted.`
          : "";

      showNotification({
        severity: "success",
        message: `${data.imported} transaction(s) imported, ${data.duplicatesSkipped} duplicate(s) skipped.${redactionMessage}`,
      });
    },
    onError: (error) => {
      console.error("Failed to upload transactions:", error);
      showNotification({
        severity: "error",
        message:
          error instanceof Error ? error.message : "Failed to upload transactions.",
      });
    },
  });
};
