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

const csrfClient = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

type CsrfResponse = {
  token: string;
};

let csrfToken: string | null = null;
let csrfTokenRequest: Promise<string> | null = null;

const isMutationRequest = (method?: string) => {
  const normalizedMethod = method?.toLowerCase();
  return ["post", "put", "patch", "delete"].includes(normalizedMethod ?? "");
};

export const refreshCsrfToken = async () => {
  const response = await csrfClient.get<CsrfResponse>("/auth/csrf");
  csrfToken = response.data.token;
  return csrfToken;
};

const ensureCsrfToken = async () => {
  if (csrfToken) {
    return csrfToken;
  }

  if (!csrfTokenRequest) {
    csrfTokenRequest = refreshCsrfToken().finally(() => {
      csrfTokenRequest = null;
    });
  }

  return csrfTokenRequest;
};

const clearCsrfToken = () => {
  csrfToken = null;
  csrfTokenRequest = null;
};

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (isMutationRequest(config.method) && config.headers) {
      const token = await ensureCsrfToken();
      config.headers["X-CSRF-TOKEN"] = token;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// Response Interceptor: Useful for global error handling
apiClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error instanceof AxiosError) {
      if (
        error.response?.status === 400 &&
        error.response?.data?.type === "urn:ptsmanager:invalid-csrf-token"
      ) {
        clearCsrfToken();
      }

      if (error.response?.status === 401) {
        clearCsrfToken();
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
