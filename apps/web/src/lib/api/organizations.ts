import { api } from "./client";
import type { Organization } from "@clusters/common";

export type { Organization };

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  description?: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  description?: string;
  is_active?: boolean;
}

export interface OrganizationWithCount extends Organization {
  cluster_count: number;
}

export const organizationApi = {
  /**
   * Get all organizations
   */
  getAll: () => api.get<OrganizationWithCount[]>("/organizations"),

  /**
   * Get a single organization by ID
   */
  getById: (id: string) => api.get<Organization>(`/organizations/${id}`),

  /**
   * Create a new organization
   */
  create: (input: CreateOrganizationInput) =>
    api.post<Organization>("/organizations", input),

  /**
   * Update an organization
   */
  update: (id: string, input: UpdateOrganizationInput) =>
    api.put<Organization>(`/organizations/${id}`, input),

  /**
   * Delete an organization
   */
  delete: (id: string) =>
    api.delete<{ success: boolean }>(`/organizations/${id}`),
};
