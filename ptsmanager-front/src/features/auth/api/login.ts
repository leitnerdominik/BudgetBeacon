import { apiClient } from "../../../lib/api-client";
import type { LoginCredentials, AuthResponse } from "../types";

export const loginWithEmailAndPassword = async (
  credentials: LoginCredentials,
): Promise<AuthResponse> => {
  return apiClient.post<AuthResponse, AuthResponse>("/auth/login", credentials);
};
