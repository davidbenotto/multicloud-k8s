import { ComputeManagementClient } from "@azure/arm-compute";
import { NetworkManagementClient } from "@azure/arm-network";
import { ResourceManagementClient } from "@azure/arm-resources";
import { ClientSecretCredential } from "@azure/identity";
import { v4 as uuidv4 } from "uuid";
import { ClusterProvider, ProvisioningResult } from "./cluster-provider";
import { ClusterConfig } from "../provisioner";

interface AzureConfig {
  subscriptionId: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  location?: string;
}

export class AzureProvider implements ClusterProvider {
  private credential: ClientSecretCredential;
  private subscriptionId: string;
  private location: string;
  private resourceGroup: string;

  constructor(config: AzureConfig) {
    this.credential = new ClientSecretCredential(
      config.tenantId,
      config.clientId,
      config.clientSecret,
    );
    this.subscriptionId = config.subscriptionId;
    this.location = config.location || "eastus";
    this.resourceGroup = "clusters-auto-deploy-rg";
  }

  async ensureResourceGroup() {
    const client = new ResourceManagementClient(
      this.credential,
      this.subscriptionId,
    );
    await client.resourceGroups.createOrUpdate(this.resourceGroup, {
      location: this.location,
      tags: { ManagedBy: "clusters-control-plane" },
    });
  }

  async deploy(
    config: ClusterConfig & { name: string },
  ): Promise<ProvisioningResult> {
    const {
      name,
      nodeCount = 2,
      instanceType: vmSize = "Standard_B1s",
      tags: customTags = {},
    } = config;
    const deploymentId = uuidv4();
    const networkClient = new NetworkManagementClient(
      this.credential,
      this.subscriptionId,
    );
    const computeClient = new ComputeManagementClient(
      this.credential,
      this.subscriptionId,
    );

    try {
      await this.ensureResourceGroup();

      const vnetName = `${name}-vnet`;
      console.log(`[Azure] Creating VNet ${vnetName}...`);
      await networkClient.virtualNetworks.beginCreateOrUpdateAndWait(
        this.resourceGroup,
        vnetName,
        {
          location: this.location,
          addressSpace: { addressPrefixes: ["10.0.0.0/16"] },
          subnets: [{ name: "default", addressPrefix: "10.0.0.0/24" }],
        },
      );

      const vmPromises = Array.from({ length: nodeCount }).map(async (_, i) => {
        const nodeName = `${name}-node-${i + 1}`;
        const nicName = `${nodeName}-nic`;

        const pip =
          await networkClient.publicIPAddresses.beginCreateOrUpdateAndWait(
            this.resourceGroup,
            `${nodeName}-pip`,
            { location: this.location, publicIPAllocationMethod: "Dynamic" },
          );

        const nic =
          await networkClient.networkInterfaces.beginCreateOrUpdateAndWait(
            this.resourceGroup,
            nicName,
            {
              location: this.location,
              ipConfigurations: [
                {
                  name: "ipconfig1",
                  subnet: {
                    id: `/subscriptions/${this.subscriptionId}/resourceGroups/${this.resourceGroup}/providers/Microsoft.Network/virtualNetworks/${vnetName}/subnets/default`,
                  },
                  publicIPAddress: { id: pip.id },
                },
              ],
            },
          );

        console.log(`[Azure] Creating VM ${nodeName} (${vmSize})...`);
        const vm =
          await computeClient.virtualMachines.beginCreateOrUpdateAndWait(
            this.resourceGroup,
            nodeName,
            {
              location: this.location,
              hardwareProfile: { vmSize },
              storageProfile: {
                imageReference: {
                  publisher: "Canonical",
                  offer: "ubuntu-24_04-lts",
                  sku: "server",
                  version: "latest",
                },
                osDisk: {
                  createOption: "FromImage",
                  managedDisk: { storageAccountType: "Standard_LRS" },
                },
              },
              osProfile: {
                computerName: nodeName,
                adminUsername: "azureuser",
                adminPassword: `Cluster${deploymentId.slice(0, 8)}!`,
                linuxConfiguration: { disablePasswordAuthentication: false },
              },
              networkProfile: {
                networkInterfaces: [{ id: nic.id }],
              },
              tags: {
                DeploymentId: deploymentId,
                ManagedBy: "clusters-control-plane",
                ...customTags,
              },
            },
          );

        return { name: vm.name, id: vm.id, publicIP: pip.ipAddress };
      });

      const nodes = await Promise.all(vmPromises);

      return {
        success: true,
        deploymentId,
        resourceType: "azure-vm-cluster",
        nodes,
        details: {
          resourceGroup: this.resourceGroup,
          adminUsername: "azureuser",
        },
      };
    } catch (error: any) {
      console.error("[Azure] Provisioning failed:", error);
      throw new Error(`Azure Provisioning Failed: ${error.message}`);
    }
  }

  async destroy(deploymentId: string) {
    if (!deploymentId) return { success: false, error: "No ID" };

    console.log(`[Azure] Destroying resources for ${deploymentId}...`);
    const resourceClient = new ResourceManagementClient(
      this.credential,
      this.subscriptionId,
    );

    try {
      const resources = resourceClient.resources.listByResourceGroup(
        this.resourceGroup,
        {
          filter: `tagName eq 'DeploymentId' and tagValue eq '${deploymentId}'`,
        },
      );

      const promises: Promise<void>[] = [];
      for await (const res of resources) {
        console.log(`[Azure] Deleting ${res.type}: ${res.name}`);
        if (res.id) {
          promises.push(
            resourceClient.resources
              .beginDeleteByIdAndWait(res.id, "2021-04-01")
              .catch((e: any) =>
                console.error(`Failed to delete ${res.name}: ${e.message}`),
              ),
          );
        }
      }

      await Promise.all(promises);
      return { success: true };
    } catch (error: any) {
      console.error("[Azure] Destroy failed:", error);
      throw new Error(`Azure Destroy Failed: ${error.message}`);
    }
  }

  async getKubeconfig(provisioningResult: ProvisioningResult): Promise<string> {
    throw new Error("Azure Kubeconfig retrieval not implemented in MVP yet.");
  }
}
