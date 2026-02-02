/**
 * API Client - Base configuration and fetch wrapper
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
  skipAuth?: boolean;
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Base fetch wrapper with error handling
 */
async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { params, skipAuth, ...init } = options;

  // Build URL with query params
  let url = `${API_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  // Build headers with session token
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Merge init headers
  if (init.headers) {
    Object.entries(init.headers as Record<string, string>).forEach(
      ([key, value]) => {
        headers[key] = value;
      },
    );
  }

  // Add session token if available and not skipped
  if (!skipAuth && typeof window !== "undefined") {
    const sessionToken = localStorage.getItem("cloud_session_token");
    if (sessionToken) {
      headers["Authorization"] = `Bearer ${sessionToken}`;
    }
  }

  try {
    const response = await fetch(url, {
      ...init,
      headers,
    });

    // Handle non-OK responses
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new ApiError(
        errorBody.error ||
          errorBody.message ||
          `Request failed with status ${response.status}`,
        response.status,
        errorBody.code,
      );
    }

    // Handle empty responses
    const text = await response.text();
    if (!text) return {} as T;

    return JSON.parse(text) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    // Network or parsing errors
    throw new ApiError(
      error instanceof Error ? error.message : "Network error",
      0,
      "NETWORK_ERROR",
    );
  }
}

// HTTP method helpers
export const api = {
  get: <T>(endpoint: string, params?: Record<string, string>) =>
    request<T>(endpoint, { method: "GET", params }),

  post: <T>(endpoint: string, data?: unknown, skipAuth?: boolean) =>
    request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
      skipAuth,
    }),

  put: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string) => request<T>(endpoint, { method: "DELETE" }),
};

export { ApiError, API_URL };
