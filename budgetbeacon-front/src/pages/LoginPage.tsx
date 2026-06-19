import {
  Box,
  Button,
  Checkbox,
  Container,
  TextField,
  Typography,
  Paper,
  Alert,
  FormControlLabel,
} from "@mui/material";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useLocation } from "react-router-dom";

import { useLogin } from "../features/auth/useLogin";
import { useRegister } from "../features/auth/useRegister";
import type {
  LoginCredentials,
  RegisterCredentials,
} from "../features/auth/types";

type AuthFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  rememberMe: boolean;
};

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const {
    mutate: login,
    isPending: isLoginPending,
    isError: isLoginError,
    error: loginError,
  } = useLogin();
  const {
    mutate: registerAccount,
    isPending: isRegisterPending,
    isError: isRegisterError,
    error: registerError,
  } = useRegister();

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<AuthFormValues>({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      rememberMe: false,
    },
  });

  const from = location.state?.from?.pathname || "/";
  const isRegisterMode = mode === "register";
  const isPending = isLoginPending || isRegisterPending;
  const error = loginError ?? registerError;
  const isError = isLoginError || isRegisterError;

  const onSubmit = (data: AuthFormValues) => {
    clearErrors("confirmPassword");

    if (isRegisterMode) {
      if (data.password !== data.confirmPassword) {
        setError("confirmPassword", {
          type: "validate",
          message: "Passwords do not match",
        });
        return;
      }

      const payload: RegisterCredentials = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
      };

      registerAccount(payload, {
        onSuccess: () => {
          navigate(from, { replace: true });
        },
      });
      return;
    }

    const payload: LoginCredentials = {
      email: data.email,
      password: data.password,
      rememberMe: data.rememberMe,
    };

    login(payload, {
      onSuccess: () => {
        navigate(from, { replace: true });
      },
    });
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          py: 4,
        }}
      >
        <Typography component="h1" variant="h4" gutterBottom>
          Finance Manager
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center">
          Secure access to your personal finance workspace.
        </Typography>

        <Paper
          sx={{
            p: 4,
            width: "100%",
            mt: 3,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography component="h2" variant="h5" align="center" gutterBottom>
            {isRegisterMode ? "Create Account" : "Sign In"}
          </Typography>

          {isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error instanceof Error ? error.message : "Authentication failed"}
            </Alert>
          )}

          <Box
            component="form"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            sx={{ mt: 1 }}
          >
            {isRegisterMode && (
              <>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  label="First Name"
                  autoComplete="given-name"
                  autoFocus
                  {...register("firstName", {
                    required: "First name is required",
                  })}
                  error={!!errors.firstName}
                  helperText={errors.firstName?.message}
                />
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  label="Last Name"
                  autoComplete="family-name"
                  {...register("lastName", {
                    required: "Last name is required",
                  })}
                  error={!!errors.lastName}
                  helperText={errors.lastName?.message}
                />
              </>
            )}
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              autoComplete="email"
              autoFocus={!isRegisterMode}
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

            {isRegisterMode && (
              <TextField
                margin="normal"
                required
                fullWidth
                label="Confirm Password"
                type="password"
                autoComplete="new-password"
                {...register("confirmPassword", {
                  required: "Please confirm your password",
                })}
                error={!!errors.confirmPassword}
                helperText={errors.confirmPassword?.message}
              />
            )}

            {!isRegisterMode && (
              <FormControlLabel
                control={<Checkbox {...register("rememberMe")} color="primary" />}
                label="Keep me signed in"
                sx={{ mt: 1 }}
              />
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={isPending}
            >
              {isPending
                ? isRegisterMode
                  ? "Creating account..."
                  : "Signing in..."
                : isRegisterMode
                  ? "Create Account"
                  : "Sign In"}
            </Button>

            <Button
              type="button"
              fullWidth
              variant="text"
              onClick={() => setMode(isRegisterMode ? "login" : "register")}
              disabled={isPending}
            >
              {isRegisterMode
                ? "Already have an account? Sign in"
                : "Need an account? Create one"}
            </Button>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 1 }}
            >
              {isRegisterMode
                ? "Create the first account directly in the app."
                : "Sign in with your existing account."}
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};
