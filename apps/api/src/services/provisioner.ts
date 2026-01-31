export interface ClusterConfig {
  provider: "aws" | "azure" | "gcp" | "onprem";
  name: string;
  region?: string;
  nodeCount?: number;
  instanceType?: string;
  tags?: Record<string, string>;
}

import { db } from "./database";
import { ClusterProvider } from "./providers/cluster-provider";

export const provisioner = {
  /**
   * Factory to get the correct provider instance
   */
  async getProvider(
    providerName: string,
    credentials: any,
    region?: string,
  ): Promise<ClusterProvider> {
    if (providerName === "aws") {
      const { AWSProvider } = await import("./providers/aws-provider");
      return new AWSProvider({
        region: region || "us-east-1",
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
        },
      });
    } else if (providerName === "azure") {
      const { AzureProvider } = await import("./providers/azure-provider");
      return new AzureProvider({
        subscriptionId: credentials.subscriptionId,
        tenantId: credentials.tenantId,
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        location: region || "eastus",
      });
    } else if (providerName === "gcp") {
      const { GCPProvider } = await import("./providers/gcp-provider");
      let saKey = credentials.serviceAccountKey;
      if (typeof saKey === "string") {
        try {
          saKey = JSON.parse(saKey);
        } catch (e) {}
      }
      return new GCPProvider({
        projectId: credentials.projectId,
        credentials: {
          client_email: saKey?.client_email,
          private_key: saKey?.private_key,
        },
        zone: region || "us-central1-a",
      });
    } else if (providerName === "onprem") {
      const { OnPremProvider } = await import("./providers/onprem-provider");
      return new OnPremProvider({
        host: credentials.host,
        user: credentials.user,
        sshKey: credentials.sshKey,
      });
    }

    throw new Error(`Provider ${providerName} not supported`);
  },

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
      const provider = await this.getProvider(
        cluster.provider,
        credentials,
        cluster.config?.region,
      );

      const result = await provider.deploy({
        ...cluster.config,
        name: cluster.name,
      });

      console.log(
        `[Provisioner] ${cluster.provider} Success: ${result.deploymentId}`,
      );

      // SECURITY: Encrypt SSH Key Material before saving to DB
      if (result.details?.keyMaterial) {
        const { encryption } = await import("./encryption");
        const encryptedKey = encryption.encrypt(result.details.keyMaterial);
        result.details.keyMaterial = encryptedKey;
        result.details.isEncrypted = true;
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
   * Get Kubeconfig for a cluster
   */
  async getKubeconfig(clusterId: string) {
    const res = await db.query("SELECT * FROM clusters WHERE id = $1", [
      clusterId,
    ]);
    if (res.rows.length === 0) throw new Error("Cluster not found");
    const cluster = res.rows[0];

    // Load credentials
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
      }
      // ... other envs
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

    const provider = await this.getProvider(
      cluster.provider,
      credentials,
      cluster.config.region,
    );

    // SECURITY: Decrypt SSH Key if needed before passing to provider
    const provisioningResult = cluster.config?.provisioningResult || {};
    if (
      provisioningResult.details?.isEncrypted &&
      provisioningResult.details?.keyMaterial
    ) {
      // We need to decrypt it temporarily for the provider to use
      const decryptedKey = encryption.decrypt(
        provisioningResult.details.keyMaterial,
      );
      // We pass a clone with the decrypted key
      const decryptedResult = JSON.parse(JSON.stringify(provisioningResult));
      decryptedResult.details.keyMaterial = decryptedKey;
      return provider.getKubeconfig(decryptedResult);
    }

    return provider.getKubeconfig(provisioningResult);
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
    const deploymentId = cluster.config?.provisioningResult?.deploymentId;

    if (!deploymentId) {
      // Just delete from DB if no resources were created
      await db.query("DELETE FROM clusters WHERE id = $1", [clusterId]);
      return true;
    }

    // Load credentials
    const { credentialService } = await import("./credentials");
    const { encryption } = await import("./encryption");
    let credentials: any = {};

    if (credentialService.hasEnvCredentials(cluster.provider)) {
      credentials = credentialService.getEnvCredentials(cluster.provider);
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

    try {
      const provider = await this.getProvider(
        cluster.provider,
        credentials,
        cluster.config.region,
      );
      await provider.destroy(deploymentId);
    } catch (e: any) {
      console.error(
        `[Provisioner] Failed to auto-destroy resources: ${e.message}`,
      );
    }

    await db.query("DELETE FROM clusters WHERE id = $1", [clusterId]);
    console.log(`[Provisioner] Cluster ${clusterId} deleted from DB`);
    return true;
  },
};
