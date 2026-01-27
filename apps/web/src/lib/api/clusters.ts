import { api } from "./client";
import type { Cluster } from "@clusters/common";

export type { Cluster };

export interface CreateClusterInput {
  name: string;
  provider: string;
  region: string;
  nodeCount: number;
}

export const clusterApi = {
  /**
   * Get all clusters
   */
  getAll: () => api.get<Cluster[]>("/clusters"),

  /**
   * Get a single cluster by ID
   */
  getById: (id: string) => api.get<Cluster>(`/clusters/${id}`),

  /**
   * Create a new cluster
   */
  create: (input: CreateClusterInput) => api.post<Cluster>("/clusters", input),

  /**
   * Delete a cluster
   */
  delete: (id: string) => api.delete<{ success: boolean }>(`/clusters/${id}`),
};
