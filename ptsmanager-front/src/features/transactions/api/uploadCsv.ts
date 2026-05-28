import { apiClient } from "../../../lib/api-client";

export interface CsvUploadResponse {
  message: string;
  totalParsed: number;
  imported: number;
  duplicatesSkipped: number;
}

export const uploadCsv = async (
  file: File,
  delimiter = "auto",
): Promise<CsvUploadResponse> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("delimiter", delimiter);

  return apiClient.post<CsvUploadResponse, CsvUploadResponse>(
    "/transactions/import",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );
};
