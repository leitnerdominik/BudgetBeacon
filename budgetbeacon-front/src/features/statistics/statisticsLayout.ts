import type { SxProps, Theme } from "@mui/material/styles";

export const statisticsSurfaceSx = {
  minWidth: 0,
  maxWidth: "100%",
  borderRadius: 1,
  border: "1px solid",
  borderColor: "divider",
  bgcolor: "background.paper",
  boxShadow: "none",
  overflow: "visible",
} satisfies SxProps<Theme>;

export const statisticsContentSx = {
  p: { xs: 2, sm: 2.5 },
  minWidth: 0,
  overflowWrap: "anywhere",
  "&:last-child": { pb: { xs: 2, sm: 2.5 } },
} satisfies SxProps<Theme>;
