import { useMutation } from "@tanstack/react-query";
import { useNotification } from "../../../components/notifications/NotificationProvider";
import { registerWithEmailAndPassword } from "../api/session";
import { useAuth } from "../contexts/AuthContext";
import type { RegisterCredentials } from "../types";

export const useRegister = () => {
  const { login } = useAuth();
  const { showNotification } = useNotification();

  return useMutation({
    mutationFn: (credentials: RegisterCredentials) =>
      registerWithEmailAndPassword(credentials),
    onSuccess: (data) => {
      login(data.user);
      showNotification({
        severity: "success",
        message: `Welcome, ${data.user.firstName}!`,
      });
    },
    onError: (error) => {
      console.error("Registration failed:", error);
      showNotification({
        severity: "error",
        message:
          error instanceof Error ? error.message : "Registration failed.",
      });
    },
  });
};
