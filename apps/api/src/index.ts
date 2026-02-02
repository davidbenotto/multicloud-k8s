import express from "express";
import cors from "cors";
import helmet from "helmet";

import { db } from "./services/database";
import { provisioner } from "./services/provisioner";
import { credentialService } from "./services/credentials";
import { organizationService } from "./services/organizations";
import {
  loginWithCloudCredentials,
  validateSession,
  logout,
} from "./services/auth";
import morgan from "morgan";
import { env } from "./utils/validate-env";
import { logger } from "./utils/logger";

const app = express();
const PORT = env.PORT;
const FRONTEND_URL = env.FRONTEND_URL;

// Admin emails that can access all organizations
const ADMIN_EMAILS = (env.ADMIN_EMAILS || "").split(",").filter(Boolean);

app.use(helmet());
app.use(
  morgan("combined", {
    stream: { write: (message) => logger.info(message.trim()) },
  }),
);
app.use(
  cors({
    origin: FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);
app.use(express.json());

// Helper: Get organization context from request
const getOrgContext = (req: express.Request) => {
  const orgId = req.headers["x-organization-id"] as string;
  const userId = req.headers["x-user-id"] as string;
  const isAdmin = req.headers["x-admin-mode"] === "true";
  return { orgId, userId, isAdmin };
};

logger.info(
  `[Current Config] AWS: ${!!env.AWS_ACCESS_KEY_ID} | Azure: ${!!env.AZURE_CLIENT_ID}`,
);
// Use preconfigured credentials if env vars are present (logic handled in services usually, just logging here)
logger.info("[Current Config] Environment validation successful");

// --- Authentication Routes ---

// Login with cloud credentials
app.post("/auth/login", async (req, res) => {
  try {
    const credentials = req.body;

    if (!credentials.provider) {
      return res.status(400).json({ error: "Provider is required" });
    }

    const sessionInfo = await loginWithCloudCredentials(credentials);

    res.json({
      success: true,
      session: sessionInfo,
    });
  } catch (error) {
    logger.error("Login error:", error);
    res.status(401).json({
      error: error instanceof Error ? error.message : "Authentication failed",
    });
  }
});

// Validate current session
app.get("/auth/session", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No session token provided" });
    }

    const sessionToken = authHeader.substring(7);
    const session = await validateSession(sessionToken);

    if (!session) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    // Get organization details
    const org = await organizationService.getById(session.organizationId);

    res.json({
      success: true,
      session: {
        organizationId: session.organizationId,
        organization: org,
        cloudProvider: session.cloudProvider,
        cloudIdentity: session.cloudIdentity,
        isAdmin: session.isAdmin,
      },
    });
  } catch (error) {
    logger.error("Session validation error:", error);
    res.status(500).json({ error: "Failed to validate session" });
  }
});

// Logout
app.post("/auth/logout", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(400).json({ error: "No session token provided" });
    }

    const sessionToken = authHeader.substring(7);
    await logout(sessionToken);

    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    logger.error("Logout error:", error);
    res.status(500).json({ error: "Failed to logout" });
  }
});

// --- Organization Routes ---

// List all organizations
app.get("/organizations", async (req, res) => {
  try {
    const { isAdmin, userId } = getOrgContext(req);

    let organizations;
    if (isAdmin) {
      organizations = await organizationService.getAllAdmin();
    } else if (userId) {
      organizations = await organizationService.getForUser(userId);
    } else {
      organizations = await organizationService.getAll();
    }

    // Get cluster counts
    const counts = await organizationService.getClusterCounts();

    const result = organizations.map((org) => ({
      ...org,
      cluster_count: counts[org.id] || 0,
    }));

    res.json(result);
  } catch (error) {
    console.error("Error fetching organizations:", error);
    res.status(500).json({ error: "Failed to fetch organizations" });
  }
});

// Get single organization
app.get("/organizations/:id", async (req, res) => {
  try {
    const org = await organizationService.getById(req.params.id);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }
    res.json(org);
  } catch (error) {
    logger.error("Error fetching organization:", error);
    res.status(500).json({ error: "Failed to fetch organization" });
  }
});

// Create organization
app.post("/organizations", async (req, res) => {
  try {
    const { name, slug, description } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: "Name and slug are required" });
    }

    const org = await organizationService.create({ name, slug, description });
    res.status(201).json(org);
  } catch (error: any) {
    logger.error("Error creating organization:", error);
    if (error.code === "23505") {
      // Unique violation
      return res
        .status(409)
        .json({ error: "Organization with this slug already exists" });
    }
    res
      .status(500)
      .json({ error: error.message || "Failed to create organization" });
  }
});

// Update organization
app.put("/organizations/:id", async (req, res) => {
  try {
    const { name, description, is_active } = req.body;
    const org = await organizationService.update(req.params.id, {
      name,
      description,
      is_active,
    });
    res.json(org);
  } catch (error: any) {
    logger.error("Error updating organization:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to update organization" });
  }
});

// Delete organization
app.delete("/organizations/:id", async (req, res) => {
  try {
    await organizationService.delete(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    logger.error("Error deleting organization:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to delete organization" });
  }
});

// --- Credential Routes (with organization context) ---

// Get credential status for org
app.get("/credentials/:provider", async (req, res) => {
  const { orgId } = getOrgContext(req);
  const status = await credentialService.getStatus(
    req.params.provider,
    orgId || undefined,
  );
  res.json(status);
});

// Get all credentials for an organization
app.get("/credentials", async (req, res) => {
  const { orgId } = getOrgContext(req);
  if (!orgId) {
    return res.status(400).json({ error: "Organization context required" });
  }
  try {
    const credentials = await credentialService.getOrgCredentials(orgId);
    res.json(credentials);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch credentials" });
  }
});

// Connect credentials for org
app.post("/credentials/:provider/connect", async (req, res) => {
  const { orgId } = getOrgContext(req);
  const { connection_name, ...credentialData } = req.body;

  try {
    const result = await credentialService.saveCredentials(
      req.params.provider,
      credentialData,
      orgId || undefined,
      connection_name,
    );
    res.json(result);
  } catch (error: any) {
    res
      .status(500)
      .json({ error: error.message || "Failed to save credentials" });
  }
});

// Disconnect credentials for org
app.post("/credentials/:provider/disconnect", async (req, res) => {
  const { orgId } = getOrgContext(req);
  try {
    await credentialService.disconnect(req.params.provider, orgId || undefined);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/health", async (req, res) => {
  const dbHealth = await db.healthCheck();
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "clusters-control-plane",
    database: dbHealth ? "connected" : "disconnected",
  });
});

// --- Cluster Routes (with organization filtering) ---

// List clusters (filtered by organization or all for admin)
app.get("/clusters", async (req, res) => {
  try {
    const { orgId, isAdmin } = getOrgContext(req);

    let query: string;
    let params: any[] = [];

    if (isAdmin && !orgId) {
      // Admin mode: return all clusters with organization info
      query = `
        SELECT c.*, o.name as organization_name, o.slug as organization_slug
        FROM clusters c
        LEFT JOIN organizations o ON c.organization_id = o.id
        ORDER BY c.created_at DESC
      `;
    } else if (orgId) {
      // Filter by specific organization
      query = `
        SELECT c.*, o.name as organization_name, o.slug as organization_slug
        FROM clusters c
        LEFT JOIN organizations o ON c.organization_id = o.id
        WHERE c.organization_id = $1
        ORDER BY c.created_at DESC
      `;
      params = [orgId];
    } else {
      // No org context - return default org clusters
      query = `
        SELECT c.*, o.name as organization_name, o.slug as organization_slug
        FROM clusters c
        LEFT JOIN organizations o ON c.organization_id = o.id
        WHERE c.organization_id = '00000000-0000-0000-0000-000000000000'
        ORDER BY c.created_at DESC
      `;
    }

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    logger.error("Error fetching clusters:", error);
    res.status(500).json({ error: "Failed to fetch clusters" });
  }
});

// Create new cluster (with organization assignment)
app.post("/clusters", async (req, res) => {
  const config = req.body;
  const { orgId, isAdmin } = getOrgContext(req);

  if (!config.name || !config.provider) {
    return res.status(400).json({ error: "Missing name or provider" });
  }

  // Determine Organization ID based on RBAC
  let organizationId = "00000000-0000-0000-0000-000000000000";

  if (isAdmin) {
    // Admin can specify any org, or default to header, or default to System
    organizationId = config.organization_id || orgId || organizationId;
  } else if (orgId) {
    // Regular user is locked to their header context
    organizationId = orgId;
    if (config.organization_id && config.organization_id !== orgId) {
      return res
        .status(403)
        .json({ error: "Cannot create clusters for other organizations" });
    }
  }

  // Verify organization exists
  const orgCheck = await organizationService.getById(organizationId);
  if (!orgCheck) {
    return res.status(400).json({ error: "Invalid organization" });
  }

  // Build the full config with region and nodeCount
  const clusterConfig = {
    name: config.name,
    provider: config.provider,
    region: config.region || null,
    nodeCount: config.nodeCount || 3,
  };

  try {
    const result = await db.query(
      "INSERT INTO clusters (name, provider, region, status, config, organization_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [
        clusterConfig.name,
        clusterConfig.provider,
        clusterConfig.region,
        "pending",
        clusterConfig,
        organizationId,
      ],
    );
    const newCluster = result.rows[0];

    // Load org-scoped credentials for provisioning
    const credentials = await credentialService.loadCredentials(
      config.provider,
      organizationId,
    );

    if (!credentials) {
      logger.warn(
        `[API] No credentials found for ${config.provider} in org ${organizationId}`,
      );
    }

    logger.info(
      `[API] Triggering provisioning for cluster ${newCluster.id} (org: ${organizationId}) with credentials: ${credentials ? Object.keys(credentials).join(", ") : "none"}`,
    );
    provisioner.provisionCluster(newCluster, credentials || {});

    res.json(newCluster);
  } catch (error) {
    logger.error("Error creating cluster:", error);
    res.status(500).json({ error: "Failed to create cluster" });
  }
});

// Get Kubeconfig
app.get("/clusters/:id/kubeconfig", async (req, res) => {
  try {
    const { orgId, isAdmin } = getOrgContext(req);

    // Verify access
    if (!isAdmin && orgId) {
      const clusterCheck = await db.query(
        "SELECT organization_id FROM clusters WHERE id = $1",
        [req.params.id],
      );
      if (clusterCheck.rows.length === 0) {
        return res.status(404).json({ error: "Cluster not found" });
      }
      if (clusterCheck.rows[0].organization_id !== orgId) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    const kubeconfig = await provisioner.getKubeconfig(req.params.id);
    res.setHeader("Content-Type", "application/x-yaml");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="kubeconfig-${req.params.id}.yaml"`,
    );
    res.send(kubeconfig);
  } catch (error: any) {
    logger.error("Error retrieving kubeconfig:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete Cluster (with organization verification)
app.delete("/clusters/:id", async (req, res) => {
  try {
    const { orgId, isAdmin } = getOrgContext(req);

    // If not admin, verify the cluster belongs to the organization
    if (!isAdmin && orgId) {
      const clusterCheck = await db.query(
        "SELECT organization_id FROM clusters WHERE id = $1",
        [req.params.id],
      );

      if (clusterCheck.rows.length === 0) {
        return res.status(404).json({ error: "Cluster not found" });
      }

      if (clusterCheck.rows[0].organization_id !== orgId) {
        return res.status(403).json({ error: "Access denied to this cluster" });
      }
    }

    await provisioner.destroyCluster(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    logger.error("Error destroying cluster:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, async () => {
  logger.info(`🚀 Control Plane running on http://localhost:${PORT}`);
  await db.initSchema();
});
