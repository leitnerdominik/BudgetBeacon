import { Box, Typography, Button, Container } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

export const NotFound = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "80vh",
          textAlign: "center",
          gap: 2,
        }}
      >
        <ErrorOutlineIcon sx={{ fontSize: 100, color: "text.secondary" }} />
        <Typography variant="h1" color="text.primary" fontWeight="bold">
          404
        </Typography>
        <Typography variant="h5" color="text.secondary" gutterBottom>
          Oops! The page you are looking for does not exist.
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={() => navigate("/")}
          sx={{ mt: 2 }}
        >
          Back to Dashboard
        </Button>
      </Box>
    </Container>
  );
};
