import { ClusterConfig } from "../provisioner";

export interface ProvisioningResult {
  success: boolean;
  deploymentId?: string;
  resourceType?: string;
  instances?: Array<{
    instanceId: string;
    privateIp?: string;
    publicIp?: string;
    state?: string;
  }>;
  nodes?: Array<any>; // For Azure/GCP generic nodes
  details?: Record<string, any>; // Provider specific details (e.g. keyMaterial)
  error?: string;
}

export interface ClusterProvider {
  /**
   * Provision a new cluster based on configuration
   */
  deploy(config: ClusterConfig & { name: string }): Promise<ProvisioningResult>;

  /**
   * Destroy an existing cluster
   */
  destroy(
    deploymentId: string,
  ): Promise<{ success: boolean; count?: number; error?: string }>;

  /**
   * Retrieve Kubeconfig for the cluster
   * @param provisioningResult The result object stored in DB from provision step
   */
  getKubeconfig(provisioningResult: ProvisioningResult): Promise<string>;
}
