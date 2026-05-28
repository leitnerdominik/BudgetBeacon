import { useMutation } from "@tanstack/react-query";
import { loginWithEmailAndPassword } from "../../api/authApi";
import { useNotification } from "../../components/NotificationProvider";
import { useAuth } from "../../hooks/useAuth";
import type { LoginCredentials } from "./types";

export const useLogin = () => {
  const { login } = useAuth();
  const { showNotification } = useNotification();

  return useMutation({
    mutationFn: (credentials: LoginCredentials) =>
      loginWithEmailAndPassword(credentials),
    onSuccess: (data) => {
      login(data.user);
      showNotification({
        severity: "success",
        message: `Welcome back, ${data.user.firstName}!`,
      });
    },
    onError: (error) => {
      console.error("Login failed:", error);
      showNotification({
        severity: "error",
        message: error instanceof Error ? error.message : "Login failed.",
      });
    },
  });
};
