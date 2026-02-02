"use client";

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from "react";
import { organizationApi } from "@/lib/api";
import type { OrganizationWithCount } from "@/lib/api/organizations";
import { useAuth } from "./AuthContext";

interface OrganizationContextType {
  organizations: OrganizationWithCount[];
  currentOrg: OrganizationWithCount | null;
  setCurrentOrg: (org: OrganizationWithCount) => void;
  isAdmin: boolean;
  loading: boolean;
  refetch: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(
  undefined,
);

export function OrganizationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, isAuthenticated } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationWithCount[]>(
    [],
  );
  const [currentOrg, setCurrentOrg] = useState<OrganizationWithCount | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  // Admin state comes from session
  const isAdmin = session?.isAdmin || false;

  // Fetch organizations when authenticated
  const fetchOrganizations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await organizationApi.getAll();
      setOrganizations(data);

      // Auto-select first organization or session's organization
      if (session?.organization) {
        const sessionOrg = data.find((o) => o.id === session.organization.id);
        if (sessionOrg) {
          setCurrentOrg(sessionOrg);
        } else if (data.length > 0) {
          setCurrentOrg(data[0]);
        }
      } else if (data.length > 0) {
        setCurrentOrg(data[0]);
      }
    } catch (error) {
      console.error("Failed to fetch organizations:", error);
    } finally {
      setLoading(false);
    }
  }, [session]);

  // Fetch organizations when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchOrganizations();
    } else {
      setOrganizations([]);
      setCurrentOrg(null);
      setLoading(false);
    }
  }, [isAuthenticated, fetchOrganizations]);

  const value = {
    organizations,
    currentOrg,
    setCurrentOrg,
    isAdmin,
    loading,
    refetch: fetchOrganizations,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error(
      "useOrganization must be used within an OrganizationProvider",
    );
  }
  return context;
}
