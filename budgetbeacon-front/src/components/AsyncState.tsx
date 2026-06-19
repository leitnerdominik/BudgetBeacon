import { Box, Button, CircularProgress, Stack, Typography } from "@mui/material";

type BaseStateProps = {
  inverted?: boolean;
  minHeight?: number | string;
};

type LoadingStateProps = BaseStateProps & {
  isOffline?: boolean;
  isSlow?: boolean;
  label: string;
};

type StatusMessageProps = BaseStateProps & {
  actionLabel?: string;
  description: string;
  onAction?: () => void;
  title: string;
};

const getSurfaceStyles = (inverted?: boolean) =>
  inverted
    ? {
        backgroundColor: "rgba(255,255,255,0.08)",
        borderColor: "rgba(255,255,255,0.24)",
        color: "inherit",
      }
    : {
        backgroundColor: "background.paper",
        borderColor: "divider",
        color: "text.primary",
      };

export const LoadingState = ({
  inverted,
  isOffline,
  isSlow,
  label,
  minHeight = 220,
}: LoadingStateProps) => {
  const helperText = isOffline
    ? "You appear to be offline. We'll continue once the connection is back."
    : isSlow
      ? "This is taking longer than usual. Your network or the API may be slow."
      : null;

  const surfaceStyles = getSurfaceStyles(inverted);

  return (
    <Box
      sx={{
        minHeight,
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Stack
        spacing={1.25}
        alignItems="center"
        sx={{
          width: "100%",
          maxWidth: 420,
          px: 2.5,
          py: 3,
          borderRadius: 1,
          border: "1px solid",
          ...surfaceStyles,
        }}
      >
        <CircularProgress
          size={28}
          color={inverted ? "inherit" : "primary"}
        />
        <Typography variant="subtitle2" align="center" color="inherit">
          {label}
        </Typography>
        {helperText ? (
          <Typography
            variant="body2"
            align="center"
            sx={{
              color: inverted ? "inherit" : "text.secondary",
              opacity: inverted ? 0.84 : 1,
            }}
          >
            {helperText}
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
};

export const StatusMessage = ({
  actionLabel,
  description,
  inverted,
  minHeight = 220,
  onAction,
  title,
}: StatusMessageProps) => {
  const surfaceStyles = getSurfaceStyles(inverted);

  return (
    <Box
      sx={{
        minHeight,
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Stack
        spacing={1.25}
        alignItems="center"
        sx={{
          width: "100%",
          maxWidth: 460,
          px: 2.5,
          py: 3,
          borderRadius: 1,
          border: "1px solid",
          ...surfaceStyles,
        }}
      >
        <Typography variant="subtitle1" fontWeight={700} align="center" color="inherit">
          {title}
        </Typography>
        <Typography
          variant="body2"
          align="center"
          sx={{
            color: inverted ? "inherit" : "text.secondary",
            opacity: inverted ? 0.84 : 1,
          }}
        >
          {description}
        </Typography>
        {actionLabel && onAction ? (
          <Button
            variant={inverted ? "outlined" : "contained"}
            onClick={onAction}
            sx={
              inverted
                ? {
                    color: "inherit",
                    borderColor: "rgba(255,255,255,0.38)",
                    "&:hover": {
                      borderColor: "rgba(255,255,255,0.6)",
                      backgroundColor: "rgba(255,255,255,0.08)",
                    },
                  }
                : undefined
            }
          >
            {actionLabel}
          </Button>
        ) : null}
      </Stack>
    </Box>
  );
};
