import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import {
  DataGrid,
  type GridColDef,
  type GridPaginationModel,
} from "@mui/x-data-grid";

import { TransactionCategorySelect } from "../TransactionCategorySelect";
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

const formatConfidenceScore = (value: number | null | undefined) =>
  typeof value === "number" ? `${Math.round(value * 100)}%` : "N/A";

type DesktopTransactionGridProps = {
  draftCategory?: string;
  editingCategoryId?: string;
  isLoading: boolean;
  onCategoryCancel: () => void;
  onCategoryDraftChange: (category: string) => void;
  onCategoryEditStart: (transactionId: string) => void;
  onCategorySave: (transactionId: string) => void;
  onDeleteRequest: (transactionId: string) => void;
  onRegenerateCategory: (transactionId: string) => void;
  paginationModel: GridPaginationModel;
  setPaginationModel: (model: GridPaginationModel) => void;
  totalCount: number;
  transactions: PaginatedTransactions["data"];
  deletingTransactionId?: string;
  regeneratingCategoryId?: string;
  updatingCategoryId?: string;
};

export const DesktopTransactionGrid = ({
  draftCategory,
  editingCategoryId,
  isLoading,
  onCategoryCancel,
  onCategoryDraftChange,
  onCategoryEditStart,
  onCategorySave,
  onDeleteRequest,
  onRegenerateCategory,
  paginationModel,
  setPaginationModel,
  totalCount,
  transactions,
  deletingTransactionId,
  regeneratingCategoryId,
  updatingCategoryId,
}: DesktopTransactionGridProps) => {
  const columns: GridColDef[] = [
    {
      field: "date",
      headerName: "Date",
      width: 150,
      valueFormatter: (value) => dateFormatter.format(new Date(value)),
    },
    { field: "description", headerName: "Description", flex: 1 },
    {
      field: "category",
      headerName: "Category",
      width: 190,
      renderCell: (params) =>
        editingCategoryId === params.row.id ? (
          <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
            <TransactionCategorySelect
              autoFocus
              category={draftCategory ?? params.row.category}
              disabled={updatingCategoryId === params.row.id}
              onChange={onCategoryDraftChange}
            />
          </Box>
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
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
              {currencyFormatter.format(amount)}
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
        editingCategoryId === params.row.id ? (
          <Box sx={{ display: "flex", alignItems: "center", height: "100%", gap: 0.5 }}>
            <Tooltip title="Save category">
              <span>
                <IconButton
                  aria-label="Save transaction category"
                  color="primary"
                  size="small"
                  disabled={updatingCategoryId === params.row.id}
                  onClick={() => onCategorySave(params.row.id)}
                >
                  <CheckIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Cancel category edit">
              <span>
                <IconButton
                  aria-label="Cancel category edit"
                  size="small"
                  disabled={updatingCategoryId === params.row.id}
                  onClick={onCategoryCancel}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", height: "100%", gap: 0.5 }}>
            <Tooltip title="Regenerate category">
              <span>
                <IconButton
                  aria-label="Regenerate transaction category"
                  color="secondary"
                  size="small"
                  disabled={
                    Boolean(updatingCategoryId) ||
                    Boolean(deletingTransactionId) ||
                    Boolean(regeneratingCategoryId)
                  }
                  onClick={() => onRegenerateCategory(params.row.id)}
                >
                  <AutoAwesomeIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Edit category">
              <span>
                <IconButton
                  aria-label="Edit transaction category"
                  size="small"
                  disabled={
                    Boolean(updatingCategoryId) ||
                    Boolean(deletingTransactionId) ||
                    Boolean(regeneratingCategoryId)
                  }
                  onClick={() => onCategoryEditStart(params.row.id)}
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
                    Boolean(updatingCategoryId) ||
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
        )
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
          borderRadius: 3,
          "& .MuiDataGrid-cell": {
            alignItems: "center",
          },
        }}
      />
    </Box>
  );
};
