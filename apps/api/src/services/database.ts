import { Pool } from "pg";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://clusters:securepassword@localhost:5435/clusters_control_plane",
});

export const db = {
  query: (text: string, params?: any[]) => pool.query(text, params),

  async healthCheck() {
    try {
      await pool.query("SELECT 1");
      return true;
    } catch (error) {
      console.error("Database connection error:", error);
      return false;
    }
  },

  async initSchema() {
    const query = `
      -- Organizations table for multi-tenancy
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create default organization for existing/unassigned clusters
      INSERT INTO organizations (id, name, slug, description)
      VALUES ('00000000-0000-0000-0000-000000000000', 'Default', 'default', 'Default organization for unassigned clusters')
      ON CONFLICT (slug) DO NOTHING;

      CREATE TABLE IF NOT EXISTS clusters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        provider VARCHAR(50) NOT NULL, -- 'aws', 'azure', 'gcp', 'onprem'
        region VARCHAR(64),
        node_count INTEGER DEFAULT 3,
        status VARCHAR(50) DEFAULT 'pending',
        config JSONB DEFAULT '{}',
        organization_id UUID REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000000',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS credentials (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider VARCHAR(50) NOT NULL,
        encrypted_data TEXT NOT NULL,
        identity TEXT,
        organization_id UUID REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000000',
        connection_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Migrations: Ensure columns exist
      DO $$ 
      BEGIN 
        BEGIN
          ALTER TABLE credentials ADD COLUMN identity TEXT;
        EXCEPTION
          WHEN duplicate_column THEN NULL;
        END;
        BEGIN
          ALTER TABLE clusters ADD COLUMN region VARCHAR(64);
        EXCEPTION
          WHEN duplicate_column THEN NULL;
        END;
        BEGIN
          ALTER TABLE clusters ADD COLUMN node_count INTEGER DEFAULT 3;
        EXCEPTION
          WHEN duplicate_column THEN NULL;
        END;
        BEGIN
          ALTER TABLE clusters ADD COLUMN organization_id UUID REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000000';
        EXCEPTION
          WHEN duplicate_column THEN NULL;
        END;
        BEGIN
          ALTER TABLE credentials ADD COLUMN organization_id UUID REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000000';
        EXCEPTION
          WHEN duplicate_column THEN NULL;
        END;
        BEGIN
          ALTER TABLE credentials ADD COLUMN connection_name VARCHAR(255);
        EXCEPTION
          WHEN duplicate_column THEN NULL;
        END;
      END $$;

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_clusters_organization ON clusters(organization_id);
      CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
      CREATE INDEX IF NOT EXISTS idx_organizations_active ON organizations(is_active);
      CREATE INDEX IF NOT EXISTS idx_credentials_organization ON credentials(organization_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_credentials_org_provider ON credentials(organization_id, provider);

      -- Update any existing clusters without organization to default
      UPDATE clusters SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
    `;
    await pool.query(query);
    console.log("✅ Database schema initialized");
  },
};
