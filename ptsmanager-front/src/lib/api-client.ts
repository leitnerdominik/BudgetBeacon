import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { notifyUnauthorized } from "../features/auth/contexts/AuthContext";

export const apiClient = axios.create({
  // This can later be replaced with an environment variable (e.g., import.meta.env.VITE_API_URL)
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem("token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

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
