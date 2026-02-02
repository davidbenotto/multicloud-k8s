import { db } from "./database";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  description?: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  description?: string;
  is_active?: boolean;
}

export const organizationService = {
  /**
   * Get all organizations
   */
  async getAll(): Promise<Organization[]> {
    const result = await db.query(
      "SELECT * FROM organizations WHERE is_active = true ORDER BY name ASC",
    );
    return result.rows;
  },

  /**
   * Get all organizations including inactive (admin only)
   */
  async getAllAdmin(): Promise<Organization[]> {
    const result = await db.query(
      "SELECT * FROM organizations ORDER BY created_at DESC",
    );
    return result.rows;
  },

  /**
   * Get organizations for a specific user (based on user_organizations mapping)
   */
  async getForUser(userId: string): Promise<Organization[]> {
    const result = await db.query(
      `SELECT o.* FROM organizations o
       INNER JOIN user_organizations uo ON o.id = uo.organization_id
       WHERE uo.user_id = $1 AND o.is_active = true
       ORDER BY o.name ASC`,
      [userId],
    );
    return result.rows;
  },

  /**
   * Get organization by ID
   */
  async getById(id: string): Promise<Organization | null> {
    const result = await db.query("SELECT * FROM organizations WHERE id = $1", [
      id,
    ]);
    return result.rows[0] || null;
  },

  /**
   * Get organization by slug
   */
  async getBySlug(slug: string): Promise<Organization | null> {
    const result = await db.query(
      "SELECT * FROM organizations WHERE slug = $1",
      [slug],
    );
    return result.rows[0] || null;
  },

  /**
   * Create a new organization
   */
  async create(input: CreateOrganizationInput): Promise<Organization> {
    // Validate slug format (alphanumeric, lowercase, hyphens only)
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(input.slug)) {
      throw new Error(
        "Slug must contain only lowercase letters, numbers, and hyphens",
      );
    }

    const result = await db.query(
      `INSERT INTO organizations (name, slug, description) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [input.name, input.slug.toLowerCase(), input.description || null],
    );
    return result.rows[0];
  },

  /**
   * Update an organization
   */
  async update(
    id: string,
    input: UpdateOrganizationInput,
  ): Promise<Organization> {
    // Prevent updating the default organization's active status
    if (
      id === "00000000-0000-0000-0000-000000000000" &&
      input.is_active === false
    ) {
      throw new Error("Cannot deactivate the default organization");
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(input.is_active);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await db.query(
      `UPDATE organizations SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    if (result.rows.length === 0) {
      throw new Error("Organization not found");
    }

    return result.rows[0];
  },

  /**
   * Delete (deactivate) an organization
   */
  async delete(id: string): Promise<void> {
    // Prevent deleting the default organization
    if (id === "00000000-0000-0000-0000-000000000000") {
      throw new Error("Cannot delete the default organization");
    }

    // Check if organization has clusters
    const clusterCheck = await db.query(
      "SELECT COUNT(*) as count FROM clusters WHERE organization_id = $1",
      [id],
    );

    if (parseInt(clusterCheck.rows[0].count) > 0) {
      throw new Error(
        "Cannot delete organization with existing clusters. Please delete or reassign clusters first.",
      );
    }

    await db.query(
      "UPDATE organizations SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [id],
    );
  },

  /**
   * Get cluster count per organization
   */
  async getClusterCounts(): Promise<Record<string, number>> {
    const result = await db.query(
      `SELECT organization_id, COUNT(*) as count 
       FROM clusters 
       GROUP BY organization_id`,
    );

    const counts: Record<string, number> = {};
    for (const row of result.rows) {
      counts[row.organization_id] = parseInt(row.count);
    }
    return counts;
  },
};
