import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { IAMClient, ListAccountAliasesCommand } from "@aws-sdk/client-iam";
import { ClientSecretCredential } from "@azure/identity";
import { GoogleAuth } from "google-auth-library";
import { randomBytes } from "crypto";
import { db } from "./database";

// Session duration: 24 hours
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

export interface CloudCredentials {
  provider: "aws" | "azure" | "gcp";
  // AWS
  accessKeyId?: string;
  secretAccessKey?: string;
  // Azure
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
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
    const stsClient = new STSClient({
      credentials: {
        accessKeyId: credentials.accessKeyId!,
        secretAccessKey: credentials.secretAccessKey!,
      },
    });

    const identity = await stsClient.send(new GetCallerIdentityCommand({}));

    // Extract account ID
    const accountId = identity.Account!;

    // Try to get friendly account alias
    let accountName = `AWS-${accountId}`;
    try {
      const iamClient = new IAMClient({
        credentials: {
          accessKeyId: credentials.accessKeyId!,
          secretAccessKey: credentials.secretAccessKey!,
        },
      });
      const aliases = await iamClient.send(new ListAccountAliasesCommand({}));
      if (aliases.AccountAliases && aliases.AccountAliases.length > 0) {
        accountName = aliases.AccountAliases[0];
      }
    } catch (error) {
      // IAM access might not be available, use default name
    }

    // Extract username from ARN
    const username = identity.Arn?.split("/").pop() || "aws-user";

    return {
      provider: "aws",
      accountId,
      username,
      accountName,
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

    return {
      provider: "azure",
      tenantId,
      username,
      accountName,
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
    await auth.getClient();

    const projectId = serviceAccountKey.project_id;
    const username = serviceAccountKey.client_email || "gcp-user";
    const accountName = `GCP-${projectId}`;

    return {
      provider: "gcp",
      projectId,
      username,
      accountName,
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
     (session_token, organization_id, cloud_provider, cloud_identity, cloud_account_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      sessionToken,
      organizationId,
      identity.provider,
      identity.username,
      accountId,
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
  isAdmin: boolean;
} | null> {
  const result = await db.query(
    `SELECT id, organization_id, cloud_provider, cloud_identity, cloud_account_id 
     FROM user_sessions 
     WHERE session_token = $1 AND expires_at > NOW()`,
    [sessionToken],
  );

  if (result.rows.length === 0) {
    return null;
  }

  const session = result.rows[0];

  // Determine if admin based on cloud account whitelist
  const isAdmin = isAdminCloudAccount(
    session.cloud_provider,
    session.cloud_account_id,
  );

  return {
    sessionId: session.id,
    organizationId: session.organization_id,
    cloudProvider: session.cloud_provider,
    cloudIdentity: session.cloud_identity,
    cloudAccountId: session.cloud_account_id,
    isAdmin,
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
