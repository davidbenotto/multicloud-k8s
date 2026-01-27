"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  organizationApi,
  type OrganizationWithCount,
  setOrgContextGetter,
} from "@/lib/api";

interface OrganizationContextType {
  organizations: OrganizationWithCount[];
  currentOrg: OrganizationWithCount | null;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
  setCurrentOrg: (org: OrganizationWithCount | null) => void;
  setAdminMode: (isAdmin: boolean) => void;
  refetch: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(
  undefined,
);

const STORAGE_KEY = "clusters_current_org";
const ADMIN_KEY = "clusters_admin_mode";

export function OrganizationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [organizations, setOrganizations] = useState<OrganizationWithCount[]>(
    [],
  );
  const [currentOrg, setCurrentOrgState] =
    useState<OrganizationWithCount | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use ref to get current values in the context getter
  const currentOrgRef = useRef(currentOrg);
  const isAdminRef = useRef(isAdmin);

  useEffect(() => {
    currentOrgRef.current = currentOrg;
    isAdminRef.current = isAdmin;
  }, [currentOrg, isAdmin]);

  // Set up the API context getter
  useEffect(() => {
    setOrgContextGetter(() => ({
      orgId: currentOrgRef.current?.id || null,
      isAdmin: isAdminRef.current,
    }));
  }, []);

  const fetchOrganizations = useCallback(async () => {
    try {
      setError(null);
      const data = await organizationApi.getAll();
      setOrganizations(data);

      // Restore saved org from localStorage
      const savedOrgId = localStorage.getItem(STORAGE_KEY);
      const savedAdmin = localStorage.getItem(ADMIN_KEY) === "true";

      if (savedAdmin) {
        setIsAdmin(true);
      } else if (savedOrgId) {
        const savedOrg = data.find((o) => o.id === savedOrgId);
        if (savedOrg) {
          setCurrentOrgState(savedOrg);
        } else if (data.length > 0) {
          // Fallback to first org
          setCurrentOrgState(data[0]);
        }
      } else if (data.length > 0) {
        // Default to first org
        setCurrentOrgState(data[0]);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch organizations",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const setCurrentOrg = useCallback((org: OrganizationWithCount | null) => {
    setCurrentOrgState(org);
    setIsAdmin(false);
    if (org) {
      localStorage.setItem(STORAGE_KEY, org.id);
      localStorage.removeItem(ADMIN_KEY);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const setAdminMode = useCallback(
    (admin: boolean) => {
      setIsAdmin(admin);
      if (admin) {
        setCurrentOrgState(null);
        localStorage.setItem(ADMIN_KEY, "true");
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.removeItem(ADMIN_KEY);
        // Restore first org when exiting admin mode
        if (organizations.length > 0) {
          setCurrentOrgState(organizations[0]);
          localStorage.setItem(STORAGE_KEY, organizations[0].id);
        }
      }
    },
    [organizations],
  );

  const value = useMemo(
    () => ({
      organizations,
      currentOrg,
      isAdmin,
      loading,
      error,
      setCurrentOrg,
      setAdminMode,
      refetch: fetchOrganizations,
    }),
    [
      organizations,
      currentOrg,
      isAdmin,
      loading,
      error,
      setCurrentOrg,
      setAdminMode,
      fetchOrganizations,
    ],
  );

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
