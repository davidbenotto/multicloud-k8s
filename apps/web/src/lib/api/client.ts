/**
 * API Client - Base configuration and fetch wrapper
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
  skipOrgHeader?: boolean;
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

// Organization context getter - will be set by OrgProvider
let getOrgContext: () => { orgId: string | null; isAdmin: boolean } = () => ({
  orgId: null,
  isAdmin: false,
});

export const setOrgContextGetter = (
  getter: () => { orgId: string | null; isAdmin: boolean },
) => {
  getOrgContext = getter;
};

/**
 * Base fetch wrapper with error handling
 */
async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { params, skipOrgHeader, ...init } = options;

  // Build URL with query params
  let url = `${API_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  // Get org context and build headers
  const orgContext = getOrgContext();
  const orgHeaders: HeadersInit = {};

  if (!skipOrgHeader) {
    if (orgContext.orgId) {
      orgHeaders["X-Organization-ID"] = orgContext.orgId;
    }
    if (orgContext.isAdmin) {
      orgHeaders["X-Admin-Mode"] = "true";
    }
  }

  // Default headers
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...orgHeaders,
    ...init.headers,
  };

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

  post: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
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
