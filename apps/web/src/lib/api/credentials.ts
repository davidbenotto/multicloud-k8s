import { api } from "./client";
import type { CredentialStatus } from "@clusters/common";

export type { CredentialStatus };

export interface ConnectCredentialsInput {
  // Common
  connection_name?: string;
  region?: string;
  // AWS
  accessKeyId?: string;
  secretAccessKey?: string;
  // Azure
  clientId?: string;
  clientSecret?: string;
  tenantId?: string;
  subscriptionId?: string;
  // GCP
  serviceAccountKey?: string;
  projectId?: string;
}

export const credentialApi = {
  /**
   * Get credential status for a provider
   */
  getStatus: (provider: string) =>
    api.get<CredentialStatus>(`/credentials/${provider}`),

  /**
   * Connect credentials for a provider
   */
  connect: (provider: string, credentials: ConnectCredentialsInput) =>
    api.post<{ success: boolean }>(
      `/credentials/${provider}/connect`,
      credentials,
    ),

  /**
   * Disconnect credentials for a provider
   */
  disconnect: (provider: string) =>
    api.post<{ success: boolean }>(`/credentials/${provider}/disconnect`),
};
