import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { ClientSecretCredential } from "@azure/identity";
import { ComputeManagementClient } from "@azure/arm-compute";
// import { ProjectsClient } from "@google-cloud/resource-manager"; // Simplified for now

export const validators = {
  /**
   * Helper to handle AWS SDK errors (Ported from cloud-deploy-portal)
   */
  handleAWSError(error: any) {
    if (
      error.Code === "AccessDenied" ||
      error.name === "AccessDeniedException"
    ) {
      return `AWS Authorization Failed: Your IAM user does not have permission to perform this action. Error: ${error.message}`;
    }
    if (
      error.Code === "AuthFailure" ||
      error.name === "AuthFailure" ||
      error.name === "InvalidClientTokenId"
    ) {
      return `AWS Authentication Failed: Check your Access Key ID and Secret Access Key.`;
    }
    if (
      error.Code === "UnauthorizedOperation" ||
      error.name === "UnauthorizedOperation"
    ) {
      return `AWS Authorization Failed: Operation not authorized. Check your IAM policy.`;
    }
    if (
      error.Code === "SignatureDoesNotMatch" ||
      error.name === "SignatureDoesNotMatch"
    ) {
      return `AWS Authentication Failed: Signature does not match. Check your Secret Access Key.`;
    }
    if (error.name === "RequestTimeTooSkewed") {
      return `AWS Authentication Failed: Your system time is too different from AWS servers. Please sync your clock.`;
    }
    return error.message;
  },

  /**
   * Validate AWS Credentials using STS GetCallerIdentity
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
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
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
   * Validate Azure Credentials by listing VMs (read-only check)
   */
  async validateAzure(
    tenantId: string,
    clientId: string,
    clientSecret: string,
    subscriptionId: string,
  ) {
    try {
      const credential = new ClientSecretCredential(
        tenantId,
        clientId,
        clientSecret,
      );
      const client = new ComputeManagementClient(credential, subscriptionId);

      // Just try to list items (iterator), failing if auth is bad
      const iterator = client.virtualMachines.listAll();
      await iterator.next(); // Trigger the request

      return {
        valid: true,
        identity: `Azure Sub: ${subscriptionId}`,
      };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  },

  /**
   * Validate GCP Credentials (Mock for MVP, real impl would use Resource Manager)
   */
  async validateGCP(projectId: string, serviceAccountKey: string) {
    // Basic JSON parse check
    try {
      const key = JSON.parse(serviceAccountKey);
      if (!key.project_id || !key.private_key || !key.client_email) {
        throw new Error("Invalid Service Account JSON");
      }
      if (key.project_id !== projectId) {
        throw new Error("Project ID in JSON does not match provided ID");
      }
      return {
        valid: true,
        identity: `GCP Project: ${projectId} (${key.client_email})`,
      };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  },
};
