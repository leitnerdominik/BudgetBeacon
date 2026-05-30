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

type ApiErrorOptions = {
  data?: unknown;
  status?: number;
  type?: string;
};

export class ApiError extends Error {
  data?: unknown;
  status?: number;
  type?: string;

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = "ApiError";
    this.data = options.data;
    this.status = options.status;
    this.type = options.type;
  }
}

export const INVALID_CSRF_TOKEN_TYPE = "urn:ptsmanager:invalid-csrf-token";

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
      const responseData = error.response?.data;
      const responseType =
        responseData &&
        typeof responseData === "object" &&
        "type" in responseData &&
        typeof responseData.type === "string"
          ? responseData.type
          : undefined;

      if (
        error.response?.status === 400 &&
        responseType === INVALID_CSRF_TOKEN_TYPE
      ) {
        clearCsrfToken();
      }

      if (error.response?.status === 401) {
        clearCsrfToken();
        notifyUnauthorized();
      }

      const validationErrors =
        responseData && typeof responseData === "object" && "errors" in responseData
          ? responseData.errors
          : undefined;
      const validationMessage =
        validationErrors && typeof validationErrors === "object"
          ? Object.values(validationErrors)
              .flatMap((value) => (Array.isArray(value) ? value : [String(value)]))
              .find(Boolean)
          : undefined;
      const responseDetail =
        responseData && typeof responseData === "object" && "detail" in responseData
          ? responseData.detail
          : undefined;
      const responseTitle =
        responseData && typeof responseData === "object" && "title" in responseData
          ? responseData.title
          : undefined;
      const responseMessage =
        responseData && typeof responseData === "object" && "message" in responseData
          ? responseData.message
          : undefined;
      const legacyResponseMessage =
        responseData && typeof responseData === "object" && "Message" in responseData
          ? responseData.Message
          : undefined;
      const message =
        validationMessage ??
        responseDetail ??
        responseTitle ??
        responseMessage ??
        legacyResponseMessage ??
        error.message;

      return Promise.reject(
        new ApiError(String(message), {
          data: responseData,
          status: error.response?.status,
          type: responseType,
        }),
      );
    }

    return Promise.reject(error);
  },
);
