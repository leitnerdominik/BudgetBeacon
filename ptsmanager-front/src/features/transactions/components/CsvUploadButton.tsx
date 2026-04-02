import { useRef } from "react";
import { Button, CircularProgress } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";

import { useUploadCsv } from "../hooks/useUploadCsv";

export const CsvUploadButton = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Destructure our mutation function (mutate) and the loading state (isPending)
  const { mutate, isPending } = useUploadCsv();

  const handleButtonClick = () => {
    // Programmatically click the hidden file input
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Trigger the React Query mutation
      mutate(file);
    }

    // Reset the input value so the same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <Button
        component="label"
        variant="contained"
        startIcon={
          isPending ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            <CloudUploadIcon />
          )
        }
        onClick={handleButtonClick}
        disabled={isPending}
      >
        {isPending ? "Uploading..." : "Upload CSV"}
      </Button>

      {/* The hidden native file input */}
      <input
        type="file"
        accept=".csv"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
    </>
  );
};
