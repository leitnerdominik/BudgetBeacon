import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { notifyUnauthorized } from "../features/auth/auth-events";

const backendUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const apiBaseUrl = backendUrl
  ? `${backendUrl.replace(/\/+$/, "")}/api`
  : "http://localhost:5078/api";

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  return config;
});

// Response Interceptor: Useful for global error handling
apiClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error instanceof AxiosError) {
      if (error.response?.status === 401) {
        notifyUnauthorized();
      }

      const validationErrors = error.response?.data?.errors;
      const validationMessage =
        validationErrors && typeof validationErrors === "object"
          ? Object.values(validationErrors)
              .flatMap((value) => (Array.isArray(value) ? value : [String(value)]))
              .find(Boolean)
          : undefined;
      const message =
        validationMessage ??
        error.response?.data?.detail ??
        error.response?.data?.title ??
        error.response?.data?.message ??
        error.response?.data?.Message ??
        error.message;

      return Promise.reject(new Error(message));
    }

    return Promise.reject(error);
  },
);
