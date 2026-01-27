import { api } from "./client";

export interface HealthStatus {
  status: "healthy" | "unhealthy" | "unreachable";
  timestamp: string;
  service: string;
  database: "connected" | "disconnected";
}

export const healthApi = {
  /**
   * Check API health status
   */
  check: async (): Promise<HealthStatus> => {
    try {
      return await api.get<HealthStatus>("/health");
    } catch {
      return {
        status: "unreachable",
        timestamp: new Date().toISOString(),
        service: "clusters-control-plane",
        database: "disconnected",
      };
    }
  },
};
