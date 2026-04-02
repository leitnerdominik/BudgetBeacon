import { useMutation } from "@tanstack/react-query";
import { useNotification } from "../../../components/notifications/NotificationProvider";
import { loginWithEmailAndPassword } from "../api/login";
import { useAuth } from "../contexts/AuthContext";
import type { LoginCredentials } from "../types";

export const useLogin = () => {
  const { login } = useAuth();
  const { showNotification } = useNotification();

  return useMutation({
    mutationFn: (credentials: LoginCredentials) =>
      loginWithEmailAndPassword(credentials),
    onSuccess: (data) => {
      // The API returned the token and user, now we store it globally
      login(data.token, data.user);
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
