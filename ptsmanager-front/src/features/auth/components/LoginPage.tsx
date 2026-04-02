import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Paper,
  Alert,
} from "@mui/material";
import { useForm } from "react-hook-form";
import { useNavigate, useLocation } from "react-router-dom";

import { useLogin } from "../hooks/useLogin";
import type { LoginCredentials } from "../types";

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { mutate: login, isPending, isError, error } = useLogin();

  // Initialize React Hook Form
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginCredentials>();

  // Where should we redirect after login? (Default to dashboard)
  const from = location.state?.from?.pathname || "/";

  const onSubmit = (data: LoginCredentials) => {
    login(data, {
      onSuccess: () => {
        // Navigate back to the page the user tried to access
        navigate(from, { replace: true });
      },
    });
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Typography component="h1" variant="h4" gutterBottom>
          Finance Manager
        </Typography>

        <Paper elevation={3} sx={{ p: 4, width: "100%", mt: 2 }}>
          <Typography component="h2" variant="h5" align="center" gutterBottom>
            Sign In
          </Typography>

          {isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error instanceof Error ? error.message : "Login failed"}
            </Alert>
          )}

          <Box
            component="form"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            sx={{ mt: 1 }}
          >
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              autoComplete="email"
              autoFocus
              {...register("email", { required: "Email is required" })}
              error={!!errors.email}
              helperText={errors.email?.message}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label="Password"
              type="password"
              id="password"
              autoComplete="current-password"
              {...register("password", { required: "Password is required" })}
              error={!!errors.password}
              helperText={errors.password?.message}
            />

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 1 }}
            >
              Demo credentials: admin@finance.com / password123
            </Typography>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={isPending}
            >
              {isPending ? "Signing in..." : "Sign In"}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};
