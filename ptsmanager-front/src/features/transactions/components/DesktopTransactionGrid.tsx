import { Box, Typography } from "@mui/material";
import {
  DataGrid,
  type GridColDef,
  type GridPaginationModel,
} from "@mui/x-data-grid";

import type { PaginatedTransactions } from "../types";

const currencyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  year: "numeric",
  month: "short",
  day: "2-digit",
});

const columns: GridColDef[] = [
  { field: "id", headerName: "ID", width: 90 },
  {
    field: "date",
    headerName: "Date",
    width: 150,
    valueFormatter: (value) => dateFormatter.format(new Date(value)),
  },
  { field: "description", headerName: "Description", flex: 1 },
  { field: "category", headerName: "Category", width: 150 },
  {
    field: "amount",
    headerName: "Amount",
    width: 140,
    type: "number",
    renderCell: (params) => {
      const amount = params.value as number;
      const color = amount < 0 ? "error.main" : "success.main";
      return (
        <Typography sx={{ color, fontWeight: "bold" }}>
          {currencyFormatter.format(amount)}
        </Typography>
      );
    },
  },
];

type DesktopTransactionGridProps = {
  isLoading: boolean;
  paginationModel: GridPaginationModel;
  setPaginationModel: (model: GridPaginationModel) => void;
  totalCount: number;
  transactions: PaginatedTransactions["data"];
};

export const DesktopTransactionGrid = ({
  isLoading,
  paginationModel,
  setPaginationModel,
  totalCount,
  transactions,
}: DesktopTransactionGridProps) => (
  <Box sx={{ width: "100%", height: 560 }}>
    <DataGrid
      rows={transactions}
      columns={columns}
      rowCount={totalCount}
      loading={isLoading}
      pageSizeOptions={[5, 10, 25]}
      paginationModel={paginationModel}
      paginationMode="server"
      onPaginationModelChange={setPaginationModel}
      disableRowSelectionOnClick
      sx={{
        borderRadius: 3,
        "& .MuiDataGrid-cell": {
          alignItems: "center",
        },
      }}
    />
  </Box>
);
