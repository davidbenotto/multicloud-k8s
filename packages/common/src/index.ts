export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Cluster {
  id: string;
  name: string;
  provider: "aws" | "azure" | "gcp" | "onprem";
  status: "active" | "pending" | "provisioning" | "error" | "offline";
  region?: string;
  nodeCount?: number;
  config?: any;
  organization_id?: string;
  organization?: Organization;
  created_at: Date;
}

export type ProviderType = Cluster["provider"];

export interface CredentialStatus {
  connected: boolean;
  source?: "env" | "db";
  identity?: string;
  connection_name?: string;
  organization_id?: string;
}

export const PROVIDER_LABELS: Record<ProviderType, string> = {
  aws: "Amazon Web Services",
  azure: "Microsoft Azure",
  gcp: "Google Cloud",
  onprem: "On-Premises",
};
