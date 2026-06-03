import { Box, Typography, Button, Container, Paper } from "@mui/material";
import { useRouteError, isRouteErrorResponse } from "react-router-dom";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

export const GlobalError = () => {
  const error = useRouteError();

  let errorMessage = "An unexpected error occurred.";
  if (isRouteErrorResponse(error)) {
    errorMessage = error.data?.message || error.statusText;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          textAlign: "center",
          gap: 2,
        }}
      >
        <WarningAmberIcon sx={{ fontSize: 80, color: "error.main" }} />
        <Typography variant="h3" gutterBottom>
          Something went wrong!
        </Typography>

        <Paper
          elevation={0}
          sx={{
            p: 3,
            backgroundColor: "error.light",
            color: "error.contrastText",
            borderRadius: 1,
            maxWidth: "100%",
          }}
        >
          <Typography variant="body1" sx={{ fontFamily: "monospace" }}>
            {errorMessage}
          </Typography>
        </Paper>

        <Button
          variant="outlined"
          size="large"
          onClick={() => window.location.assign("/")}
          sx={{ mt: 4 }}
        >
          Reload Application
        </Button>
      </Box>
    </Container>
  );
};
