"use client";

import { useState, useEffect, useCallback } from "react";
import { clusterApi, type Cluster, type CreateClusterInput } from "@/lib/api";

interface UseClustersReturn {
  clusters: Cluster[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createCluster: (input: CreateClusterInput) => Promise<Cluster>;
  deleteCluster: (id: string) => Promise<void>;
}

export function useClusters(): UseClustersReturn {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClusters = useCallback(async () => {
    try {
      setError(null);
      const data = await clusterApi.getAll();
      setClusters(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch clusters");
      setClusters([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]);

  const createCluster = useCallback(
    async (input: CreateClusterInput): Promise<Cluster> => {
      const newCluster = await clusterApi.create(input);
      setClusters((prev) => [newCluster, ...prev]);
      return newCluster;
    },
    [],
  );

  const deleteCluster = useCallback(async (id: string): Promise<void> => {
    await clusterApi.delete(id);
    setClusters((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return {
    clusters,
    loading,
    error,
    refetch: fetchClusters,
    createCluster,
    deleteCluster,
  };
}
