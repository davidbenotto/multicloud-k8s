import { db } from "./database";
import { encryption } from "./encryption";
import { validators } from "./validators";

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000000";

export interface CredentialStatus {
  connected: boolean;
  source?: "env" | "db";
  identity?: string;
  connection_name?: string;
  organization_id?: string;
}

export interface SaveCredentialsInput {
  provider: string;
  data: any;
  organizationId?: string;
  connectionName?: string;
}

export const credentialService = {
  /**
   * Check if we have credentials for a provider + organization
   */
  async getStatus(
    provider: string,
    organizationId?: string,
  ): Promise<CredentialStatus> {
    const orgId = organizationId || DEFAULT_ORG_ID;

    // 1. Check Env Vars (Pre-configured) - applies to all orgs
    if (this.hasEnvCredentials(provider)) {
      return {
        connected: true,
        source: "env",
        identity: "Environment Variable (Admin Configured)",
        connection_name: "Admin Default",
        organization_id: orgId,
      };
    }

    // 2. Check Database for org-specific credentials
    try {
      const result = await db.query(
        `SELECT id, created_at, identity, connection_name, organization_id 
         FROM credentials 
         WHERE provider = $1 AND organization_id = $2 
         ORDER BY created_at DESC LIMIT 1`,
        [provider, orgId],
      );
      if (result.rows.length > 0) {
        return {
          connected: true,
          source: "db",
          identity: result.rows[0].identity || "Secure Storage",
          connection_name:
            result.rows[0].connection_name ||
            `${provider.toUpperCase()} Connection`,
          organization_id: result.rows[0].organization_id,
        };
      }
    } catch (error) {
      console.error("Error checking credential status:", error);
    }

    return { connected: false };
  },

  /**
   * Get all credentials for an organization
   */
  async getOrgCredentials(organizationId: string) {
    const result = await db.query(
      `SELECT provider, identity, connection_name, created_at 
       FROM credentials 
       WHERE organization_id = $1 
       ORDER BY provider ASC`,
      [organizationId],
    );
    return result.rows;
  },

  /**
   * Validate and Save new credentials to DB with org context
   */
  async saveCredentials(
    provider: string,
    data: any,
    organizationId?: string,
    connectionName?: string,
  ) {
    const orgId = organizationId || DEFAULT_ORG_ID;

    // 1. Validate
    let validation;
    if (provider === "aws") {
      validation = await validators.validateAWS(
        data.accessKeyId,
        data.secretAccessKey,
        data.region,
      );
    } else if (provider === "azure") {
      validation = await validators.validateAzure(
        data.tenantId,
        data.clientId,
        data.clientSecret,
        data.subscriptionId,
      );
    } else if (provider === "gcp") {
      validation = await validators.validateGCP(
        data.projectId,
        data.serviceAccountKey,
      );
    } else if (provider === "onprem") {
      validation = await validators.validateOnPrem(
        data.host,
        data.user,
        data.sshKey,
      );
    } else {
      throw new Error("Unknown provider");
    }

    if (!validation.valid) {
      throw new Error(`Authentication Failed: ${validation.error}`);
    }

    // 2. Generate connection name if not provided
    const connName =
      connectionName ||
      `${provider.toUpperCase()} - ${validation.identity || "Connection"}`;

    // 3. Encrypt & Save (upsert based on org + provider)
    const encrypted = encryption.encrypt(JSON.stringify(data));

    // Delete existing credential for this org + provider
    await db.query(
      "DELETE FROM credentials WHERE provider = $1 AND organization_id = $2",
      [provider, orgId],
    );

    await db.query(
      `INSERT INTO credentials (provider, encrypted_data, identity, organization_id, connection_name) 
       VALUES ($1, $2, $3, $4, $5)`,
      [provider, encrypted, validation.identity, orgId, connName],
    );

    return { success: true, connection_name: connName };
  },

  /**
   * Disconnect (Delete from DB) for a specific organization
   */
  async disconnect(provider: string, organizationId?: string) {
    const orgId = organizationId || DEFAULT_ORG_ID;

    if (this.hasEnvCredentials(provider)) {
      throw new Error(
        "Cannot disconnect credentials set via Environment Variables.",
      );
    }

    await db.query(
      "DELETE FROM credentials WHERE provider = $1 AND organization_id = $2",
      [provider, orgId],
    );
    return true;
  },

  /**
   * Load decrypted credentials for provisioning
   */
  async loadCredentials(provider: string, organizationId?: string) {
    const orgId = organizationId || DEFAULT_ORG_ID;

    // Check env first
    if (this.hasEnvCredentials(provider)) {
      return this.getEnvCredentials(provider);
    }

    // Load from DB
    const result = await db.query(
      "SELECT encrypted_data FROM credentials WHERE provider = $1 AND organization_id = $2",
      [provider, orgId],
    );

    if (result.rows.length > 0) {
      return JSON.parse(encryption.decrypt(result.rows[0].encrypted_data));
    }

    return null;
  },

  getEnvCredentials(provider: string): any {
    const env = process.env;
    switch (provider) {
      case "aws":
        return {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          region: env.AWS_REGION,
        };
      case "azure":
        return {
          clientId: env.AZURE_CLIENT_ID,
          clientSecret: env.AZURE_CLIENT_SECRET,
          tenantId: env.AZURE_TENANT_ID,
          subscriptionId: env.AZURE_SUBSCRIPTION_ID,
        };
      case "gcp":
        return {
          projectId: env.GCP_PROJECT_ID,
          serviceAccountKey: env.GCP_SERVICE_ACCOUNT_KEY,
        };
      case "onprem":
        return {
          host: env.ONPREM_HOST,
          user: env.ONPREM_USER,
          sshKey: env.ONPREM_SSH_KEY,
        };
      default:
        return null;
    }
  },

  hasEnvCredentials(provider: string): boolean {
    const env = process.env;
    switch (provider) {
      case "aws":
        return !!(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);
      case "azure":
        return !!(env.AZURE_CLIENT_ID && env.AZURE_CLIENT_SECRET);
      case "gcp":
        return !!env.GCP_SERVICE_ACCOUNT_KEY;
      case "onprem":
        return !!(env.ONPREM_HOST && env.ONPREM_SSH_KEY);
      default:
        return false;
    }
  },
};
