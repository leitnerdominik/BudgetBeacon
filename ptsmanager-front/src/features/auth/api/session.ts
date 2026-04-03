import { apiClient, refreshCsrfToken } from "../../../lib/api-client";
import type {
  AuthResponse,
  LoginCredentials,
  RegisterCredentials,
} from "../types";

export const loginWithEmailAndPassword = async (
  credentials: LoginCredentials,
): Promise<AuthResponse> => {
  const session = await apiClient.post<AuthResponse, AuthResponse>(
    "/auth/login",
    credentials,
  );
  await refreshCsrfToken().catch(() => undefined);
  return session;
};

export const registerWithEmailAndPassword = async (
  credentials: RegisterCredentials,
): Promise<AuthResponse> => {
  const session = await apiClient.post<AuthResponse, AuthResponse>(
    "/auth/register",
    credentials,
  );
  await refreshCsrfToken().catch(() => undefined);
  return session;
};

export const getCurrentSession = async (): Promise<AuthResponse> => {
  return apiClient.get<AuthResponse, AuthResponse>("/auth/me");
};

export const logoutCurrentSession = async (): Promise<void> => {
  await apiClient.post("/auth/logout", {});
  await refreshCsrfToken().catch(() => undefined);
};
