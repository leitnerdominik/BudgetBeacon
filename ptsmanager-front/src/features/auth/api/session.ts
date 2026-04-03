import { apiClient } from "../../../lib/api-client";
import type {
  AuthResponse,
  LoginCredentials,
  RegisterCredentials,
} from "../types";

export const loginWithEmailAndPassword = async (
  credentials: LoginCredentials,
): Promise<AuthResponse> => {
  return apiClient.post<AuthResponse, AuthResponse>("/auth/login", credentials);
};

export const registerWithEmailAndPassword = async (
  credentials: RegisterCredentials,
): Promise<AuthResponse> => {
  return apiClient.post<AuthResponse, AuthResponse>(
    "/auth/register",
    credentials,
  );
};

export const getCurrentSession = async (): Promise<AuthResponse> => {
  return apiClient.get<AuthResponse, AuthResponse>("/auth/me");
};

export const logoutCurrentSession = async (): Promise<void> => {
  await apiClient.post("/auth/logout", {});
};
