import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import {
  DataGrid,
  type GridColDef,
  type GridPaginationModel,
} from "@mui/x-data-grid";

import { formatCurrency, formatDate } from "../../../utils/formatDate";
import { TransactionCategoryIcon } from "./TransactionCategoryIcon";
import type { PaginatedTransactions } from "../types";

const formatConfidenceScore = (value: number | null | undefined) =>
  typeof value === "number" ? `${Math.round(value * 100)}%` : "N/A";

type DesktopTransactionGridProps = {
  isLoading: boolean;
  onDeleteRequest: (transactionId: string) => void;
  onEditRequest: (transactionId: string) => void;
  onRegenerateCategory: (transactionId: string) => void;
  paginationModel: GridPaginationModel;
  setPaginationModel: (model: GridPaginationModel) => void;
  totalCount: number;
  transactions: PaginatedTransactions["data"];
  deletingTransactionId?: string;
  regeneratingCategoryId?: string;
};

export const DesktopTransactionGrid = ({
  isLoading,
  onDeleteRequest,
  onEditRequest,
  onRegenerateCategory,
  paginationModel,
  setPaginationModel,
  totalCount,
  transactions,
  deletingTransactionId,
  regeneratingCategoryId,
}: DesktopTransactionGridProps) => {
  const columns: GridColDef[] = [
    {
      field: "date",
      headerName: "Date",
      width: 150,
      valueFormatter: (value) => formatDate(value),
    },
    { field: "description", headerName: "Description", flex: 1, minWidth: 170 },
    {
      field: "notes",
      headerName: "Notes",
      flex: 1,
      minWidth: 180,
      valueFormatter: (value: string | null | undefined) =>
        value && value.length > 0 ? value : "-",
    },
    {
      field: "category",
      headerName: "Category",
      width: 190,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", height: "100%", gap: 1 }}>
          <TransactionCategoryIcon
            category={params.row.category}
            fontSize="small"
            color="action"
          />
          <Typography variant="body2">{params.row.category}</Typography>
        </Box>
      ),
    },
    {
      field: "aiConfidenceScore",
      headerName: "Confidence",
      width: 130,
      align: "right",
      headerAlign: "right",
      valueFormatter: (value) => formatConfidenceScore(value as number | null),
    },
    {
      field: "amount",
      headerName: "Amount",
      width: 140,
      type: "number",
      renderCell: (params) => {
        const amount = params.value as number;
        const color = amount < 0 ? "error.main" : "success.main";
        return (
          <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
            <Typography sx={{ color, fontWeight: "bold" }}>
              {formatCurrency(amount)}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: "actions",
      headerName: "",
      width: 132,
      align: "center",
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", height: "100%", gap: 0.5 }}>
          <Tooltip title="Regenerate category">
            <span>
              <IconButton
                aria-label="Regenerate transaction category"
                color="secondary"
                size="small"
                disabled={
                  Boolean(deletingTransactionId) ||
                  Boolean(regeneratingCategoryId)
                }
                onClick={() => onRegenerateCategory(params.row.id)}
              >
                <AutoAwesomeIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Edit transaction">
            <span>
              <IconButton
                aria-label="Edit transaction"
                size="small"
                disabled={
                  Boolean(deletingTransactionId) ||
                  Boolean(regeneratingCategoryId)
                }
                onClick={() => onEditRequest(params.row.id)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Delete transaction">
            <span>
              <IconButton
                aria-label="Delete transaction"
                color="error"
                size="small"
                disabled={
                  Boolean(deletingTransactionId) ||
                  Boolean(regeneratingCategoryId)
                }
                onClick={() => onDeleteRequest(params.row.id)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
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
          borderRadius: 1,
          "& .MuiDataGrid-cell": {
            alignItems: "center",
          },
        }}
      />
    </Box>
  );
};
