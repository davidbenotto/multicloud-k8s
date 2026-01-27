import { InstancesClient } from "@google-cloud/compute";
import { v4 as uuidv4 } from "uuid";

interface GCPConfig {
  projectId: string;
  credentials: {
    client_email: string;
    private_key: string;
  };
  zone?: string;
}

export class GCPProvisionerService {
  private instancesClient: InstancesClient;
  private projectId: string;
  private zone: string;

  constructor(config: GCPConfig) {
    this.projectId = config.projectId;
    this.zone = config.zone || "us-central1-a";
    this.instancesClient = new InstancesClient({
      projectId: this.projectId,
      credentials: config.credentials,
    });
  }

  async deployClusterNodes(name: string, nodeCount: number = 2) {
    const deploymentId = uuidv4();
    const machineType = `zones/${this.zone}/machineTypes/e2-micro`;
    const sourceImage = "projects/debian-cloud/global/images/family/debian-11";

    console.log(`[GCP] Deploying ${nodeCount} nodes to ${this.zone}...`);

    try {
      const promises = Array.from({ length: nodeCount }).map(async (_, i) => {
        const instanceName = `${name}-node-${i + 1}`;

        const [response, operation] = await this.instancesClient.insert({
          project: this.projectId,
          zone: this.zone,
          instanceResource: {
            name: instanceName,
            machineType,
            disks: [{ boot: true, initializeParams: { sourceImage } }],
            networkInterfaces: [
              {
                name: "global/networks/default",
                accessConfigs: [
                  { name: "External NAT", type: "ONE_TO_ONE_NAT" },
                ],
              },
            ],
            labels: {
              deployment_id: deploymentId,
              managed_by: "clusters-control-plane",
            },
          },
        });

        return {
          name: instanceName,
          status: "PROVISIONING",
          operation: operation?.name,
        };
      });

      const nodes = await Promise.all(promises);

      return {
        success: true,
        deploymentId,
        resourceType: "gce-cluster",
        nodes,
        details: { zone: this.zone, machineType: "e2-micro" },
      };
    } catch (error: any) {
      console.error("[GCP] Provisioning failed:", error);
      throw new Error(`GCP Provisioning Failed: ${error.message}`);
    }
  }

  async destroyCluster(deploymentId: string) {
    if (!deploymentId) return;
    console.log(`[GCP] Destroying resources for ${deploymentId}...`);

    try {
      const [instances] = await this.instancesClient.list({
        project: this.projectId,
        zone: this.zone,
        filter: `labels.deployment_id = "${deploymentId}"`,
      });

      const deletePromises = (instances || []).map(async (inst) => {
        if (inst.name) {
          console.log(`[GCP] Deleting instance ${inst.name}`);
          await this.instancesClient.delete({
            project: this.projectId,
            zone: this.zone,
            instance: inst.name,
          });
        }
      });

      await Promise.all(deletePromises);
      return { success: true, count: instances?.length || 0 };
    } catch (error: any) {
      console.error("[GCP] Destroy failed:", error);
      throw new Error(`GCP Destroy Failed: ${error.message}`);
    }
  }
}
