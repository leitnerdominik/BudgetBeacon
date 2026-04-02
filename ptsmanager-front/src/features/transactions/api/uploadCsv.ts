import { apiClient } from "../../../lib/api-client";

export interface CsvUploadResponse {
  message: string;
  totalParsed: number;
  imported: number;
  duplicatesSkipped: number;
}

export const uploadCsv = async (file: File): Promise<CsvUploadResponse> => {
  const formData = new FormData();
  formData.append("file", file);

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
