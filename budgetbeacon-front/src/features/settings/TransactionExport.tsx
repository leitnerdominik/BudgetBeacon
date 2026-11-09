import { useState } from "react";
import { Alert, Box, Button, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import { exportTransactions } from "../../api/transactionsApi";

export const TransactionExport = ({ isOnline }: { isOnline: boolean }) => {
  const [period, setPeriod] = useState<"all" | "range">("all");
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const invalidRange = period === "range" && !!startDate && !!endDate && startDate > endDate;

  const download = async () => {
    if (pending || invalidRange || !isOnline) return;
    setPending(true);
    setError("");
    try {
      const blob = await exportTransactions(format, period === "range" ? startDate : "", period === "range" ? endDate : "");
      const range = period === "range" ? `${startDate || "start"}_to_${endDate || "end"}` : "all";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `budgetbeacon-transactions-${range}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Transactions couldn't be exported. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography variant="subtitle1" fontWeight={700}>Export transactions</Typography>
        <Typography variant="body2" color="text.secondary">Download your transactions as a CSV or JSON file.</Typography>
      </Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel id="export-period-label">Period</InputLabel>
          <Select labelId="export-period-label" label="Period" value={period} onChange={(event) => setPeriod(event.target.value as "all" | "range") }>
            <MenuItem value="all">All transactions</MenuItem>
            <MenuItem value="range">Date range</MenuItem>
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 130 }}>
          <InputLabel id="export-format-label">Format</InputLabel>
          <Select labelId="export-format-label" label="Format" value={format} onChange={(event) => setFormat(event.target.value as "csv" | "json") }>
            <MenuItem value="csv">CSV</MenuItem>
            <MenuItem value="json">JSON</MenuItem>
          </Select>
        </FormControl>
      </Stack>
      {period === "range" ? (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField label="Start date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
          <TextField label="End date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} InputLabelProps={{ shrink: true }} error={invalidRange} helperText={invalidRange ? "End date must not be before start date." : undefined} fullWidth />
        </Stack>
      ) : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Button type="button" variant="outlined" disabled={!isOnline || pending || invalidRange} onClick={() => { void download(); }} sx={{ alignSelf: "flex-start" }}>
        {pending ? "Preparing export..." : "Download transactions"}
      </Button>
    </Stack>
  );
};
