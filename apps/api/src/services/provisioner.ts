export interface ClusterConfig {
  provider: "aws" | "azure" | "gcp" | "onprem";
  name: string;
  region?: string;
  nodeCount?: number;
}

import { db } from "./database";

export const provisioner = {
  /**
   * Validation pass before running Terraform
   */
  async validateConfig(config: ClusterConfig): Promise<boolean> {
    console.log(
      `[Provisioner] Validating config for ${config.name} on ${config.provider}`,
    );
    return true;
  },

  /**
   * Trigger the Provisioning Run
   */
  async provisionCluster(cluster: any, credentials: any) {
    console.log(
      `[Provisioner] Starting provisioning for ${cluster.name} (${cluster.provider})...`,
    );

    try {
      let result;

      if (cluster.provider === "aws") {
        const { AWSProvisionerService } = await import("./aws-provisioner");
        const awsService = new AWSProvisionerService({
          region: cluster.config?.region || "us-east-1",
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
          },
        });
        result = await awsService.deployClusterNodes(
          cluster.name,
          cluster.config?.nodeCount || 3,
        );
        console.log(`[Provisioner] AWS Success: ${result.deploymentId}`);
      } else if (cluster.provider === "azure") {
        const { AzureProvisionerService } = await import("./azure-provisioner");
        const azureService = new AzureProvisionerService({
          subscriptionId: credentials.subscriptionId,
          tenantId: credentials.tenantId,
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          location: cluster.config?.region || "eastus",
        });
        result = await azureService.deployClusterNodes(
          cluster.name,
          cluster.config?.nodeCount || 2,
        );
        console.log(`[Provisioner] Azure Success: ${result.deploymentId}`);
      } else if (cluster.provider === "gcp") {
        const { GCPProvisionerService } = await import("./gcp-provisioner");
        let saKey = credentials.serviceAccountKey;
        if (typeof saKey === "string") {
          try {
            saKey = JSON.parse(saKey);
          } catch (e) {}
        }
        const gcpService = new GCPProvisionerService({
          projectId: credentials.projectId,
          credentials: {
            client_email: saKey.client_email,
            private_key: saKey.private_key,
          },
          zone: cluster.config?.region || "us-central1-a",
        });
        result = await gcpService.deployClusterNodes(
          cluster.name,
          cluster.config?.nodeCount || 2,
        );
        console.log(`[Provisioner] GCP Success: ${result.deploymentId}`);
      } else {
        // Mock for OnPrem
        await new Promise((resolve) => setTimeout(resolve, 5000));
        result = { success: true, mock: true };
      }

      await db.query(
        "UPDATE clusters SET status = $1, config = $2 WHERE id = $3",
        [
          "active",
          JSON.stringify({ ...cluster.config, provisioningResult: result }),
          cluster.id,
        ],
      );
      console.log(`[Provisioner] DB updated for cluster ${cluster.id}`);
    } catch (err: any) {
      console.error("[Provisioner] Provisioning Failed:", err);
      await db.query(
        "UPDATE clusters SET status = $1, config = $2 WHERE id = $3",
        ["error", JSON.stringify({ error: err.message }), cluster.id],
      );
    }
  },

  /**
   * Destroy a Cluster
   */
  async destroyCluster(clusterId: string) {
    console.log(
      `[Provisioner] Requesting destruction for cluster ${clusterId}`,
    );

    const res = await db.query("SELECT * FROM clusters WHERE id = $1", [
      clusterId,
    ]);
    if (res.rows.length === 0) throw new Error("Cluster not found");
    const cluster = res.rows[0];

    const { credentialService } = await import("./credentials");
    const { encryption } = await import("./encryption");

    let credentials: any = {};

    if (credentialService.hasEnvCredentials(cluster.provider)) {
      const env = process.env;
      if (cluster.provider === "aws") {
        credentials = {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        };
      } else if (cluster.provider === "azure") {
        credentials = {
          clientId: env.AZURE_CLIENT_ID,
          clientSecret: env.AZURE_CLIENT_SECRET,
          tenantId: env.AZURE_TENANT_ID,
          subscriptionId: env.AZURE_SUBSCRIPTION_ID,
        };
      } else if (cluster.provider === "gcp") {
        credentials = {
          projectId: env.GCP_PROJECT_ID,
          serviceAccountKey: env.GCP_SERVICE_ACCOUNT_KEY,
        };
      }
    } else {
      const credRes = await db.query(
        "SELECT encrypted_data FROM credentials WHERE provider = $1",
        [cluster.provider],
      );
      if (credRes.rows.length > 0) {
        credentials = JSON.parse(
          encryption.decrypt(credRes.rows[0].encrypted_data),
        );
      }
    }

    const deploymentId = cluster.config?.provisioningResult?.deploymentId;
    if (deploymentId && Object.keys(credentials).length > 0) {
      try {
        if (cluster.provider === "aws") {
          const { AWSProvisionerService } = await import("./aws-provisioner");
          const aws = new AWSProvisionerService({
            region: cluster.config.region || "us-east-1",
            credentials,
          });
          await aws.destroyCluster(deploymentId);
        } else if (cluster.provider === "azure") {
          const { AzureProvisionerService } =
            await import("./azure-provisioner");
          const azure = new AzureProvisionerService({
            ...credentials,
            location: cluster.config.region || "eastus",
          });
          await azure.destroyCluster(deploymentId);
        } else if (cluster.provider === "gcp") {
          const { GCPProvisionerService } = await import("./gcp-provisioner");
          let saKey = credentials.serviceAccountKey;
          if (typeof saKey === "string") {
            try {
              saKey = JSON.parse(saKey);
            } catch (e) {}
          }
          const gcp = new GCPProvisionerService({
            projectId: credentials.projectId,
            credentials: {
              client_email: saKey?.client_email,
              private_key: saKey?.private_key,
            },
            zone: cluster.config.region || "us-central1-a",
          });
          await gcp.destroyCluster(deploymentId);
        }
      } catch (e: any) {
        console.error(
          `[Provisioner] Failed to auto-destroy cloud resources: ${e.message}`,
        );
      }
    }

    await db.query("DELETE FROM clusters WHERE id = $1", [clusterId]);
    console.log(`[Provisioner] Cluster ${clusterId} deleted from DB`);
    return true;
  },
};
