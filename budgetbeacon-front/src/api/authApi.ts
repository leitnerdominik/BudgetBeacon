import {
  ApiError,
  INVALID_CSRF_TOKEN_TYPE,
  apiClient,
  refreshCsrfToken,
} from "./httpClient";
import type {
  AuthResponse,
  LoginCredentials,
  RegisterCredentials,
} from "../types/api";

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
  try {
    await apiClient.post("/auth/logout", {});
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 400 &&
      error.type === INVALID_CSRF_TOKEN_TYPE
    ) {
      await refreshCsrfToken();
      await apiClient.post("/auth/logout", {});
    } else {
      throw error;
    }
  }

  await refreshCsrfToken().catch(() => undefined);
};
