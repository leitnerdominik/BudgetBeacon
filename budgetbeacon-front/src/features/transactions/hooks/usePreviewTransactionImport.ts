import { useMutation } from "@tanstack/react-query";

import {
  previewTransactionImport,
  type TransactionImportMappingRequest,
} from "../../../api/transactionsApi";

type PreviewTransactionImportInput = {
  file: File;
  delimiter: string;
  mapping?: TransactionImportMappingRequest;
};

export const usePreviewTransactionImport = () =>
  useMutation({
    mutationFn: ({ file, delimiter, mapping }: PreviewTransactionImportInput) =>
      previewTransactionImport(file, delimiter, mapping),
  });
