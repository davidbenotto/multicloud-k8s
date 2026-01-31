import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { ClientSecretCredential } from "@azure/identity";
import { ResourceManagementClient } from "@azure/arm-resources";
import { GoogleAuth } from "google-auth-library";
import { NodeSSH } from "node-ssh";

export const validators = {
  /**
   * Helper to handle AWS SDK errors
   */
  handleAWSError(error: any) {
    if (
      error.Code === "AccessDenied" ||
      error.name === "AccessDeniedException"
    ) {
      return `AWS Authorization Failed: IAM user missing permissions. ${error.message}`;
    }
    if (
      error.Code === "AuthFailure" ||
      error.name === "AuthFailure" ||
      error.name === "InvalidClientTokenId"
    ) {
      return `AWS Authentication Failed: Invalid Access Key ID or Secret Access Key.`;
    }
    if (
      error.Code === "SignatureDoesNotMatch" ||
      error.name === "SignatureDoesNotMatch"
    ) {
      return `AWS Authentication Failed: Invalid Secret Access Key.`;
    }
    return `AWS Error: ${error.message}`;
  },

  /**
   * Validate AWS Credentials using STS
   */
  async validateAWS(
    accessKeyId: string,
    secretAccessKey: string,
    region: string = "us-east-1",
  ) {
    console.log(`[Validation] Validating AWS Creds (Region: ${region})...`);
    try {
      const client = new STSClient({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
      const response = await client.send(new GetCallerIdentityCommand({}));
      console.log("[Validation] AWS Success:", response.Account);
      return {
        valid: true,
        identity: `AWS Account: ${response.Account}`,
        details: { arn: response.Arn, userId: response.UserId },
      };
    } catch (error: any) {
      console.error("[Validation] AWS Failed:", error);
      return { valid: false, error: this.handleAWSError(error) };
    }
  },

  /**
   * Validate Azure Credentials by listing Resource Groups (lighter than VMs)
   */
  async validateAzure(
    tenantId: string,
    clientId: string,
    clientSecret: string,
    subscriptionId: string,
  ) {
    console.log(
      `[Validation] Validating Azure Creds (Sub: ${subscriptionId})...`,
    );
    try {
      const credential = new ClientSecretCredential(
        tenantId,
        clientId,
        clientSecret,
      );
      const client = new ResourceManagementClient(credential, subscriptionId);

      // Try to list the first resource group to verify access
      const iterator = client.resourceGroups.list();
      await iterator.next(); // Trigger request

      return {
        valid: true,
        identity: `Azure Sub: ${subscriptionId}`,
      };
    } catch (error: any) {
      console.error("[Validation] Azure Failed:", error.message);
      return { valid: false, error: `Azure Error: ${error.message}` };
    }
  },

  /**
   * Validate GCP Credentials by authenticating and getting project info
   */
  async validateGCP(projectId: string, serviceAccountKey: string) {
    console.log(`[Validation] Validating GCP Creds (Project: ${projectId})...`);
    try {
      let key;
      try {
        key = JSON.parse(serviceAccountKey);
      } catch (e) {
        return {
          valid: false,
          error: "Invalid JSON format for Service Account Key",
        };
      }

      if (key.project_id && key.project_id !== projectId) {
        return {
          valid: false,
          error: `Key Project ID (${key.project_id}) does not match provided Project ID (${projectId})`,
        };
      }

      const auth = new GoogleAuth({
        credentials: {
          client_email: key.client_email,
          private_key: key.private_key,
        },
        projectId: projectId,
      });

      // Verify credentials by getting an access token
      const client = await auth.getClient();
      const accessToken = await client.getAccessToken();

      if (!accessToken.token) {
        throw new Error("Failed to retrieve access token");
      }

      return {
        valid: true,
        identity: `GCP Project: ${projectId} (${key.client_email})`,
      };
    } catch (error: any) {
      console.error("[Validation] GCP Failed:", error.message);
      return { valid: false, error: `GCP Error: ${error.message}` };
    }
  },

  /**
   * Validate OnPrem Credentials by attempting SSH connection
   */
  async validateOnPrem(host: string, user: string, sshKey: string) {
    console.log(
      `[Validation] Validating OnPrem (Host: ${host}, User: ${user})...`,
    );
    const ssh = new NodeSSH();
    try {
      await ssh.connect({
        host,
        username: user,
        privateKey: sshKey,
        readyTimeout: 5000, // Short timeout for validation
      });

      // Run a simple command to ensure shell access
      const result = await ssh.execCommand('echo "Connection Successful"');
      ssh.dispose();

      if (result.stdout.trim() !== "Connection Successful") {
        return {
          valid: false,
          error: "SSH connected but command execution failed",
        };
      }

      return { valid: true, identity: `user@${host}` };
    } catch (error: any) {
      console.error("[Validation] OnPrem Failed:", error.message);
      return { valid: false, error: `SSH Connection Failed: ${error.message}` };
    }
  },
};
