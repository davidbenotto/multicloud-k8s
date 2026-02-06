import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import {
  IAMClient,
  ListAccountAliasesCommand,
  SimulatePrincipalPolicyCommand,
} from "@aws-sdk/client-iam";
import { ClientSecretCredential } from "@azure/identity";
import { ResourceManagementClient } from "@azure/arm-resources";
import { AuthorizationManagementClient } from "@azure/arm-authorization";
import { GoogleAuth } from "google-auth-library";
import { randomBytes } from "crypto";
import { db } from "./database";

// Session duration: 24 hours
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

// User role based on cloud IAM permissions
export type UserRole = "admin" | "viewer";

export interface CloudCredentials {
  provider: "aws" | "azure" | "gcp";
  // AWS
  accessKeyId?: string;
  secretAccessKey?: string;
  // Azure
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  subscriptionId?: string; // Needed for role assignment check
  // GCP
  serviceAccountKey?: string;
}

export interface CloudIdentity {
  provider: string;
  accountId?: string;
  tenantId?: string;
  projectId?: string;
  username: string;
  accountName: string;
  role: UserRole; // Detected from cloud IAM
}

export interface SessionInfo {
  sessionToken: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  user: {
    name: string;
    provider: string;
    role: UserRole;
  };
  expiresAt: Date;
}

/**
 * Validate AWS credentials and extract account information
 */
async function validateAWSCredentials(
  credentials: CloudCredentials,
): Promise<CloudIdentity> {
  try {
    const awsCredentials = {
      accessKeyId: credentials.accessKeyId!,
      secretAccessKey: credentials.secretAccessKey!,
    };

    const stsClient = new STSClient({ credentials: awsCredentials });
    const identity = await stsClient.send(new GetCallerIdentityCommand({}));

    // Extract account ID
    const accountId = identity.Account!;
    const userArn = identity.Arn!;

    // Try to get friendly account alias
    let accountName = `AWS-${accountId}`;
    const iamClient = new IAMClient({ credentials: awsCredentials });

    try {
      const aliases = await iamClient.send(new ListAccountAliasesCommand({}));
      if (aliases.AccountAliases && aliases.AccountAliases.length > 0) {
        accountName = aliases.AccountAliases[0];
      }
    } catch (error) {
      // IAM access might not be available, use default name
    }

    // Detect role: Check if user can create/delete EKS clusters
    let role: UserRole = "viewer";
    try {
      const eksAdminActions = [
        "eks:CreateCluster",
        "eks:DeleteCluster",
        "eks:UpdateClusterConfig",
      ];

      const simulation = await iamClient.send(
        new SimulatePrincipalPolicyCommand({
          PolicySourceArn: userArn,
          ActionNames: eksAdminActions,
        }),
      );

      // If all actions are allowed, user is admin
      const allAllowed = simulation.EvaluationResults?.every(
        (result) => result.EvalDecision === "allowed",
      );

      if (allAllowed) {
        role = "admin";
      }
    } catch (error) {
      // If simulation fails (no permission to simulate), default to viewer
      console.log("IAM simulation not available, defaulting to viewer role");
    }

    // Extract username from ARN
    const username = userArn.split("/").pop() || "aws-user";

    return {
      provider: "aws",
      accountId,
      username,
      accountName,
      role,
    };
  } catch (error) {
    throw new Error(
      `Invalid AWS credentials: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Validate Azure credentials and extract tenant information
 */
async function validateAzureCredentials(
  credentials: CloudCredentials,
): Promise<CloudIdentity> {
  try {
    const credential = new ClientSecretCredential(
      credentials.tenantId!,
      credentials.clientId!,
      credentials.clientSecret!,
    );

    // Try to get a token to validate credentials
    const tokenResponse = await credential.getToken(
      "https://management.azure.com/.default",
    );

    if (!tokenResponse) {
      throw new Error("Failed to obtain token");
    }

    const tenantId = credentials.tenantId!;
    const accountName = `Azure-${tenantId.substring(0, 8)}`;
    const username = credentials.clientId!;

    // Detect role: Check role assignments if subscription ID is provided
    let role: UserRole = "viewer";

    if (credentials.subscriptionId) {
      try {
        const authClient = new AuthorizationManagementClient(
          credential,
          credentials.subscriptionId,
        );

        // List role assignments for the service principal
        const assignments = authClient.roleAssignments.listForSubscription();

        // Admin roles in Azure
        const adminRoleNames = ["Owner", "Contributor"];

        for await (const assignment of assignments) {
          // Get the role definition to check the name
          if (assignment.principalId === credentials.clientId) {
            // Check if role definition contains admin permissions
            const roleDefId = assignment.roleDefinitionId?.split("/").pop();
            if (roleDefId) {
              const roleDef = await authClient.roleDefinitions.getById(
                assignment.roleDefinitionId!,
              );
              if (
                roleDef.roleName &&
                adminRoleNames.includes(roleDef.roleName)
              ) {
                role = "admin";
                break;
              }
            }
          }
        }
      } catch (error) {
        // If role check fails, default to viewer
        console.log(
          "Azure role check not available, defaulting to viewer role",
        );
      }
    }

    return {
      provider: "azure",
      tenantId,
      username,
      accountName,
      role,
    };
  } catch (error) {
    throw new Error(
      `Invalid Azure credentials: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Validate GCP credentials and extract project information
 */
async function validateGCPCredentials(
  credentials: CloudCredentials,
): Promise<CloudIdentity> {
  try {
    const serviceAccountKey = JSON.parse(credentials.serviceAccountKey!);

    const auth = new GoogleAuth({
      credentials: serviceAccountKey,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });

    // Get auth client to validate
    const client = await auth.getClient();

    const projectId = serviceAccountKey.project_id;
    const username = serviceAccountKey.client_email || "gcp-user";
    const accountName = `GCP-${projectId}`;

    // Detect role: Check if service account can create/delete GKE clusters
    let role: UserRole = "viewer";

    try {
      // Use the Cloud Resource Manager API to test IAM permissions
      const accessToken = await client.getAccessToken();

      const adminPermissions = [
        "container.clusters.create",
        "container.clusters.delete",
        "container.clusters.update",
      ];

      const response = await fetch(
        `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:testIamPermissions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ permissions: adminPermissions }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        // If all admin permissions are granted, user is admin
        if (data.permissions?.length === adminPermissions.length) {
          role = "admin";
        }
      }
    } catch (error) {
      // If permission check fails, default to viewer
      console.log(
        "GCP permission check not available, defaulting to viewer role",
      );
    }

    return {
      provider: "gcp",
      projectId,
      username,
      accountName,
      role,
    };
  } catch (error) {
    throw new Error(
      `Invalid GCP credentials: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Find or create organization based on cloud identity
 */
async function findOrCreateOrganization(identity: CloudIdentity): Promise<{
  id: string;
  name: string;
  slug: string;
}> {
  const accountId =
    identity.accountId || identity.tenantId || identity.projectId;

  // Try to find existing organization
  const existing = await db.query(
    `SELECT id, name, slug FROM organizations 
     WHERE cloud_provider = $1 AND cloud_account_id = $2`,
    [identity.provider, accountId],
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  // Create new organization
  const slug = identity.accountName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const result = await db.query(
    `INSERT INTO organizations (name, slug, cloud_provider, cloud_account_id, cloud_account_name)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (slug) DO UPDATE SET 
       cloud_provider = EXCLUDED.cloud_provider,
       cloud_account_id = EXCLUDED.cloud_account_id,
       cloud_account_name = EXCLUDED.cloud_account_name
     RETURNING id, name, slug`,
    [
      identity.accountName,
      slug,
      identity.provider,
      accountId,
      identity.accountName,
    ],
  );

  return result.rows[0];
}

/**
 * Generate a secure random token
 */
function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Create a new user session
 */
async function createSession(
  organizationId: string,
  identity: CloudIdentity,
): Promise<string> {
  const sessionToken = generateSessionToken();
  const accountId =
    identity.accountId || identity.tenantId || identity.projectId;
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.query(
    `INSERT INTO user_sessions 
     (session_token, organization_id, cloud_provider, cloud_identity, cloud_account_id, cloud_role, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      sessionToken,
      organizationId,
      identity.provider,
      identity.username,
      accountId,
      identity.role,
      expiresAt,
    ],
  );

  return sessionToken;
}

/**
 * Main login function - validates credentials and creates session
 */
export async function loginWithCloudCredentials(
  credentials: CloudCredentials,
): Promise<SessionInfo> {
  // Step 1: Validate credentials with cloud provider
  let identity: CloudIdentity;

  if (credentials.provider === "aws") {
    identity = await validateAWSCredentials(credentials);
  } else if (credentials.provider === "azure") {
    identity = await validateAzureCredentials(credentials);
  } else if (credentials.provider === "gcp") {
    identity = await validateGCPCredentials(credentials);
  } else {
    throw new Error("Invalid cloud provider");
  }

  // Step 2: Find or create organization
  const organization = await findOrCreateOrganization(identity);

  // Step 3: Create session token
  const sessionToken = await createSession(organization.id, identity);

  // Step 4: Return session info
  return {
    sessionToken,
    organization,
    user: {
      name: identity.username,
      provider: identity.provider,
      role: identity.role,
    },
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
  };
}

/**
 * Validate session token and return session info
 */
export async function validateSession(sessionToken: string): Promise<{
  sessionId: string;
  organizationId: string;
  cloudProvider: string;
  cloudIdentity: string;
  cloudAccountId: string;
  role: UserRole;
  isAdmin: boolean;
} | null> {
  const result = await db.query(
    `SELECT id, organization_id, cloud_provider, cloud_identity, cloud_account_id, cloud_role 
     FROM user_sessions 
     WHERE session_token = $1 AND expires_at > NOW()`,
    [sessionToken],
  );

  if (result.rows.length === 0) {
    return null;
  }

  const session = result.rows[0];
  const role: UserRole = session.cloud_role || "viewer";

  return {
    sessionId: session.id,
    organizationId: session.organization_id,
    cloudProvider: session.cloud_provider,
    cloudIdentity: session.cloud_identity,
    cloudAccountId: session.cloud_account_id,
    role,
    isAdmin: role === "admin",
  };
}

/**
 * Check if cloud account is in admin whitelist
 */
function isAdminCloudAccount(provider: string, accountId: string): boolean {
  const adminAccounts = (process.env.ADMIN_CLOUD_ACCOUNTS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  return adminAccounts.includes(accountId);
}

/**
 * Logout - invalidate session token
 */
export async function logout(sessionToken: string): Promise<void> {
  await db.query(`DELETE FROM user_sessions WHERE session_token = $1`, [
    sessionToken,
  ]);
}

/**
 * Cleanup expired sessions (should be run periodically)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db.query(
    `DELETE FROM user_sessions WHERE expires_at < NOW()`,
  );
  return result.rowCount || 0;
}
